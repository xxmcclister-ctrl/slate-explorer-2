import assert from 'node:assert/strict';
import test from 'node:test';
import type { FileEntry } from '../../electron/types';
import {
  classifyEntryCategory,
  computeBatchRenamePreview,
  computeMarqueeRect,
  computeSelection,
  createExplorerTab,
  filterEntriesByOptions,
  formatBytes,
  formatEntryDisplayName,
  getFolderViewPreference,
  getParentPath,
  groupEntries,
  invertSelection,
  isSecureFolderPath,
  joinPath,
  navigateTabHistory,
  normalizeFolderPrefKey,
  normalizeViewMode,
  parseBreadcrumbs,
  pushUndoOperation,
  rectsIntersect,
  setFolderViewPreference,
  shiftRedoOperation,
  shiftUndoOperation,
  shouldAutoLockSecureFolder,
  sortEntries,
  stepTabHistory,
  validateEntryName,
  type FolderViewPref,
} from './explorerLogic';

function makeEntry(overrides: Partial<FileEntry> & { name: string }): FileEntry {
  return {
    name: overrides.name,
    path: overrides.path ?? `C:\\Test\\${overrides.name}`,
    parentPath: 'C:\\Test',
    extension: overrides.isDirectory ? '' : '.txt',
    isDirectory: overrides.isDirectory ?? false,
    isSymlink: false,
    isHidden: overrides.isHidden ?? false,
    isReadOnly: false,
    isSystem: false,
    inaccessible: false,
    size: overrides.size ?? 100,
    createdAt: overrides.createdAt ?? 1000,
    modifiedAt: overrides.modifiedAt ?? 1000,
    accessedAt: overrides.accessedAt ?? 1000,
    typeLabel: overrides.typeLabel ?? (overrides.isDirectory ? 'File folder' : 'Text Document'),
    isImage: false,
  };
}

test('formatBytes formats byte sizes cleanly', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1024), '1.00 KB');
  assert.equal(formatBytes(15 * 1024 * 1024), '15.0 MB');
  assert.equal(formatBytes(250 * 1024 * 1024 * 1024), '250 GB');
});

test('parseBreadcrumbs and getParentPath handle Windows, UNC, and POSIX paths accurately', () => {
  const win = parseBreadcrumbs('C:\\Users\\Jordan\\Documents');
  assert.deepEqual(win, [
    { label: 'C:', path: 'C:\\' },
    { label: 'Users', path: 'C:\\Users' },
    { label: 'Jordan', path: 'C:\\Users\\Jordan' },
    { label: 'Documents', path: 'C:\\Users\\Jordan\\Documents' },
  ]);
  assert.equal(getParentPath('C:\\Users\\Jordan\\Documents'), 'C:\\Users\\Jordan');
  assert.equal(getParentPath('C:\\Users'), 'C:\\');
  assert.equal(getParentPath('C:\\'), null);

  const unc = parseBreadcrumbs('\\\\fileserver\\shared\\finance');
  assert.deepEqual(unc, [
    { label: '\\\\fileserver\\shared', path: '\\\\fileserver\\shared' },
    { label: 'finance', path: '\\\\fileserver\\shared\\finance' },
  ]);

  const posix = parseBreadcrumbs('/home/jordan/projects');
  assert.deepEqual(posix, [
    { label: '/', path: '/' },
    { label: 'home', path: '/home' },
    { label: 'jordan', path: '/home/jordan' },
    { label: 'projects', path: '/home/jordan/projects' },
  ]);
  assert.equal(getParentPath('/'), null);
  assert.equal(joinPath('C:\\Users', 'Docs'), 'C:\\Users\\Docs');
  assert.equal(joinPath('/home/user/', 'Docs'), '/home/user/Docs');
  assert.deepEqual(parseBreadcrumbs('shell:RecycleBinFolder'), [
    { label: 'Recycle Bin', path: 'shell:RecycleBinFolder' },
  ]);
  assert.equal(getParentPath('shell:RecycleBinFolder'), null);

  assert.deepEqual(parseBreadcrumbs('shell:SecureFolder'), [
    { label: 'Secure Folder', path: 'shell:SecureFolder' },
  ]);
  assert.equal(getParentPath('shell:SecureFolder'), null);
  assert.deepEqual(parseBreadcrumbs('shell:SecureFolder/Private/Tax'), [
    { label: 'Secure Folder', path: 'shell:SecureFolder' },
    { label: 'Private', path: 'shell:SecureFolder/Private' },
    { label: 'Tax', path: 'shell:SecureFolder/Private/Tax' },
  ]);
  assert.equal(getParentPath('shell:SecureFolder/Private'), 'shell:SecureFolder');
  assert.equal(joinPath('shell:SecureFolder', 'Notes.txt'), 'shell:SecureFolder/Notes.txt');
});

test('validateEntryName enforces Windows filename rules', () => {
  assert.equal(validateEntryName('Report 2026.pdf'), null);
  assert.ok(validateEntryName(''));
  assert.ok(validateEntryName('bad:name.txt'));
  assert.ok(validateEntryName('trailingdot.'));
  assert.ok(validateEntryName('CON'));
  assert.ok(validateEntryName('nul.txt'));
});

test('sortEntries keeps folders before files and sorts naturally across fields', () => {
  const entries = [
    makeEntry({ name: 'file10.txt', size: 10, createdAt: 500 }),
    makeEntry({ name: 'Zebra', isDirectory: true, createdAt: 900 }),
    makeEntry({ name: 'file2.txt', size: 200, createdAt: 1200 }),
    makeEntry({ name: 'Alpha', isDirectory: true, createdAt: 100 }),
  ];

  const byNameAsc = sortEntries(entries, 'name', 'asc').map((e) => e.name);
  assert.deepEqual(byNameAsc, ['Alpha', 'Zebra', 'file2.txt', 'file10.txt']);

  const bySizeDesc = sortEntries(entries, 'size', 'desc').map((e) => e.name);
  assert.deepEqual(bySizeDesc, ['Zebra', 'Alpha', 'file2.txt', 'file10.txt']);

  const byCreatedAsc = sortEntries(entries, 'createdAt', 'asc').map((e) => e.name);
  assert.deepEqual(byCreatedAsc, ['Alpha', 'Zebra', 'file10.txt', 'file2.txt']);
});

test('computeSelection handles single, Ctrl toggle, and Shift range selection', () => {
  const entries = [
    makeEntry({ name: 'A', path: 'p/A' }),
    makeEntry({ name: 'B', path: 'p/B' }),
    makeEntry({ name: 'C', path: 'p/C' }),
    makeEntry({ name: 'D', path: 'p/D' }),
  ];

  const s1 = computeSelection(entries, new Set(), 'p/B', 'single', null);
  assert.deepEqual([...s1.selected], ['p/B']);
  assert.equal(s1.nextAnchor, 'p/B');

  const s2 = computeSelection(entries, s1.selected, 'p/D', 'toggle', s1.nextAnchor);
  assert.deepEqual([...s2.selected].sort(), ['p/B', 'p/D']);

  const s3 = computeSelection(entries, s2.selected, 'p/D', 'range', 'p/B');
  assert.deepEqual([...s3.selected], ['p/B', 'p/C', 'p/D']);
  assert.equal(s3.nextAnchor, 'p/B');
});

test('marquee rect calculation and intersection detect overlapping items', () => {
  const marquee = computeMarqueeRect({ x: 100, y: 120 }, { x: 20, y: 40 });
  assert.deepEqual(marquee, { left: 20, top: 40, right: 100, bottom: 120 });
  assert.equal(rectsIntersect(marquee, { left: 80, top: 80, right: 150, bottom: 150 }), true);
  assert.equal(rectsIntersect(marquee, { left: 120, top: 140, right: 200, bottom: 200 }), false);
});

test('per-folder view preferences support all 8 modes and normalize compact to list', () => {
  let prefs: Record<string, FolderViewPref> = {};

  assert.equal(normalizeViewMode('compact'), 'list');
  assert.equal(normalizeViewMode('extra-large'), 'extra-large');
  assert.equal(normalizeFolderPrefKey('C:\\Users\\Jordan\\Pictures\\'), 'c:\\users\\jordan\\pictures');

  assert.deepEqual(getFolderViewPreference(prefs, 'C:\\Users\\Jordan\\Pictures'), {
    viewMode: 'details',
  });

  prefs = setFolderViewPreference(prefs, 'C:\\Users\\Jordan\\Pictures', 'extra-large');
  assert.equal(getFolderViewPreference(prefs, 'C:\\Users\\Jordan\\Pictures').viewMode, 'extra-large');

  prefs = setFolderViewPreference(prefs, 'C:\\Users\\Jordan\\Documents', 'compact');
  assert.equal(getFolderViewPreference(prefs, 'C:\\Users\\Jordan\\Documents').viewMode, 'list');

  prefs = setFolderViewPreference(prefs, 'C:\\Users\\Jordan\\Pictures', 'details');
  assert.equal(getFolderViewPreference(prefs, 'C:\\Users\\Jordan\\Pictures').viewMode, 'details');
});

test('category filters, hidden items toggle, extension display, invert selection, and groupEntries', () => {
  const folder = makeEntry({ name: 'Docs', isDirectory: true, path: 'p/Docs' });
  const hiddenDot = makeEntry({ name: '.env', isHidden: true, path: 'p/.env' });
  hiddenDot.extension = '.env';
  const tsFile = makeEntry({ name: 'index.ts', path: 'p/index.ts', size: 2048 });
  tsFile.extension = '.ts';
  const imgFile = makeEntry({ name: 'photo.png', path: 'p/photo.png', size: 2 * 1024 * 1024 });
  imgFile.extension = '.png';
  imgFile.isImage = true;

  const all = [folder, hiddenDot, tsFile, imgFile];
  assert.equal(classifyEntryCategory(tsFile), 'code');
  assert.equal(classifyEntryCategory(imgFile), 'images');

  assert.deepEqual(
    filterEntriesByOptions(all, { showHidden: false, categoryFilter: 'all' }).map((e) => e.name),
    ['Docs', 'index.ts', 'photo.png'],
  );
  assert.deepEqual(
    filterEntriesByOptions(all, { showHidden: true, categoryFilter: 'code' }).map((e) => e.name),
    ['index.ts'],
  );

  assert.equal(formatEntryDisplayName(tsFile, false), 'index');
  assert.equal(formatEntryDisplayName(tsFile, true), 'index.ts');
  assert.equal(formatEntryDisplayName(hiddenDot, false), '.env');
  assert.equal(formatEntryDisplayName(folder, false), 'Docs');

  const inverted = invertSelection(all, new Set(['p/Docs', 'p/index.ts']));
  assert.deepEqual([...inverted].sort(), ['p/.env', 'p/photo.png']);

  const sizeGroups = groupEntries(all, 'size').map((g) => g.label);
  assert.deepEqual(sizeGroups, ['Folders', 'Tiny (< 16 KB)', 'Medium (1 MB – 128 MB)']);
});

test('batch rename engine previews find/replace, numbering, case transform, and collisions', () => {
  const entries = [
    makeEntry({ name: 'draft report.txt', path: 'p/draft report.txt' }),
    makeEntry({ name: 'draft notes.txt', path: 'p/draft notes.txt' }),
  ];

  const rows = computeBatchRenamePreview(entries, {
    find: 'draft ',
    replace: '',
    useRegex: false,
    caseSensitive: false,
    prefix: 'final_',
    suffix: '',
    caseTransform: 'lower',
    addNumbering: true,
    startNumber: 1,
    padLength: 2,
    preserveExtension: true,
  });

  assert.equal(rows[0].newName, 'final_report_01.txt');
  assert.equal(rows[1].newName, 'final_notes_02.txt');
  assert.equal(rows[0].error, null);
  assert.equal(rows[1].error, null);

  // Collision check when two items map to identical name
  const collisionRows = computeBatchRenamePreview(entries, {
    find: '.*',
    replace: 'same',
    useRegex: true,
    caseSensitive: false,
    prefix: '',
    suffix: '',
    caseTransform: 'none',
    addNumbering: false,
    startNumber: 1,
    padLength: 2,
    preserveExtension: true,
  });
  assert.equal(collisionRows[0].error, 'Duplicate name in batch');
  assert.equal(collisionRows[1].error, 'Duplicate name in batch');
});

test('undo/redo stack and multi-tab navigation manage history transitions accurately', () => {
  let undoState = { undoStack: [], redoStack: [] } as ReturnType<typeof pushUndoOperation>;
  undoState = pushUndoOperation(undoState, {
    kind: 'rename',
    label: 'Rename a.txt -> b.txt',
    fromPath: '/tmp/a.txt',
    toPath: '/tmp/b.txt',
    timestamp: 100,
  });
  assert.equal(undoState.undoStack.length, 1);

  const undone = shiftUndoOperation(undoState);
  assert.equal(undone.op?.kind, 'rename');
  assert.equal(undone.nextState.undoStack.length, 0);
  assert.equal(undone.nextState.redoStack.length, 1);

  const redone = shiftRedoOperation(undone.nextState);
  assert.equal(redone.op?.kind, 'rename');
  assert.equal(redone.nextState.undoStack.length, 1);
  assert.equal(redone.nextState.redoStack.length, 0);

  let tab = createExplorerTab('/home/user', 't1');
  tab = navigateTabHistory(tab, '/home/user/Documents');
  assert.equal(tab.title, 'Documents');
  assert.equal(tab.historyIndex, 1);

  const back = stepTabHistory(tab, -1);
  assert.equal(back.targetPath, '/home/user');
  assert.equal(back.tab.title, 'user');
});

test('isSecureFolderPath and shouldAutoLockSecureFolder enforce lock on leave and stay unlocked inside subfolders', () => {
  assert.equal(isSecureFolderPath('shell:SecureFolder'), true);
  assert.equal(isSecureFolderPath('shell:securefolder/Private/Taxes'), true);
  assert.equal(isSecureFolderPath('shell:SecureFolder\\Notes'), true);
  assert.equal(isSecureFolderPath('C:\\Users\\Jordan\\Documents'), false);
  assert.equal(isSecureFolderPath(''), false);

  // Staying inside subfolders keeps vault unlocked
  assert.equal(
    shouldAutoLockSecureFolder(['shell:SecureFolder'], ['shell:SecureFolder/Private']),
    false,
  );
  assert.equal(
    shouldAutoLockSecureFolder(['shell:SecureFolder/Private'], ['shell:SecureFolder']),
    false,
  );

  // Leaving via navigation, tab switch, or closing window auto-locks
  assert.equal(
    shouldAutoLockSecureFolder(['shell:SecureFolder'], ['/home/user/Documents']),
    true,
  );
  assert.equal(
    shouldAutoLockSecureFolder(['shell:SecureFolder/Private'], ['/home/user']),
    true,
  );
  assert.equal(shouldAutoLockSecureFolder(['shell:SecureFolder'], []), true);

  // Dual pane keeps vault unlocked while at least one visible pane remains inside
  assert.equal(
    shouldAutoLockSecureFolder(
      ['shell:SecureFolder', '/home/user'],
      ['shell:SecureFolder', '/home/user/Downloads'],
    ),
    false,
  );
  assert.equal(
    shouldAutoLockSecureFolder(
      ['/home/user', 'shell:SecureFolder'],
      ['/home/user'],
    ),
    true,
  );
  assert.equal(
    shouldAutoLockSecureFolder(['/home/user'], ['/home/user/Documents']),
    false,
  );
});
