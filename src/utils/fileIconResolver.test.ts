import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFileIcon, type FileIconEntryInput } from './fileIconResolver';

function entry(
  name: string,
  opts: Partial<FileIconEntryInput> = {},
): FileIconEntryInput {
  const dot = name.lastIndexOf('.');
  const inferredExt = !opts.isDirectory && dot > 0 ? name.slice(dot) : '';
  return {
    name,
    extension: opts.extension ?? inferredExt,
    isDirectory: opts.isDirectory ?? false,
    isImage: opts.isImage ?? false,
  };
}

test('folders resolve distinctly from files', () => {
  const dir = resolveFileIcon(entry('Documents', { isDirectory: true }));
  assert.equal(dir.kind, 'folder');
  assert.equal(dir.badge, '');
  assert.equal(dir.category, 'folder');
});

test('office and document extensions get distinct kinds and badges', () => {
  const pdf = resolveFileIcon(entry('Quarterly_Report.pdf'));
  assert.equal(pdf.kind, 'pdf');
  assert.equal(pdf.badge, 'PDF');

  const doc = resolveFileIcon(entry('Proposal.docx'));
  assert.equal(doc.kind, 'word');
  assert.equal(doc.badge, 'DOC');

  const xls = resolveFileIcon(entry('Budget.xlsx'));
  assert.equal(xls.kind, 'spreadsheet');
  assert.equal(xls.badge, 'XLS');

  const csv = resolveFileIcon(entry('Export.csv'));
  assert.equal(csv.kind, 'spreadsheet');
  assert.equal(csv.badge, 'CSV');

  const ppt = resolveFileIcon(entry('Deck.pptx'));
  assert.equal(ppt.kind, 'presentation');
  assert.equal(ppt.badge, 'PPT');

  const md = resolveFileIcon(entry('README.md'));
  assert.equal(md.kind, 'markdown');
  assert.equal(md.badge, 'MD');

  const txt = resolveFileIcon(entry('notes.txt'));
  assert.equal(txt.kind, 'text');
  assert.equal(txt.badge, 'TXT');
});

test('media types separate raster images, vectors, video, and audio', () => {
  const png = resolveFileIcon(entry('photo.png', { isImage: true }));
  assert.equal(png.kind, 'image');
  assert.equal(png.badge, 'PNG');

  const jpeg = resolveFileIcon(entry('camera.jpeg', { isImage: true }));
  assert.equal(jpeg.kind, 'image');
  assert.equal(jpeg.badge, 'JPG');

  const svg = resolveFileIcon(entry('logo.svg'));
  assert.equal(svg.kind, 'vector');
  assert.equal(svg.badge, 'SVG');

  const mp4 = resolveFileIcon(entry('trailer.mp4'));
  assert.equal(mp4.kind, 'video');
  assert.equal(mp4.badge, 'MP4');

  const mp3 = resolveFileIcon(entry('track.mp3'));
  assert.equal(mp3.kind, 'audio');
  assert.equal(mp3.badge, 'MP3');
});

test('programming languages and web assets receive distinct code icons', () => {
  assert.equal(resolveFileIcon(entry('App.tsx')).badge, 'TSX');
  assert.equal(resolveFileIcon(entry('themeRegistry.ts')).kind, 'typescript');
  assert.equal(resolveFileIcon(entry('index.js')).kind, 'javascript');
  assert.equal(resolveFileIcon(entry('main.py')).kind, 'python');
  assert.equal(resolveFileIcon(entry('lib.rs')).kind, 'rust');
  assert.equal(resolveFileIcon(entry('server.go')).kind, 'go');
  assert.equal(resolveFileIcon(entry('index.html')).kind, 'html');
  assert.equal(resolveFileIcon(entry('index.css')).kind, 'css');
  assert.equal(resolveFileIcon(entry('package.json')).kind, 'json');
  assert.equal(resolveFileIcon(entry('schema.sql')).kind, 'database');
  assert.equal(resolveFileIcon(entry('deploy.sh')).kind, 'shell');
});

test('dotfiles, compound archives, locks, and unknown files resolve accurately', () => {
  const bashrc = resolveFileIcon(entry('.bashrc', { extension: '' }));
  assert.equal(bashrc.kind, 'shell');
  assert.equal(bashrc.badge, 'SH');

  const profile = resolveFileIcon(entry('.profile', { extension: '' }));
  assert.equal(profile.kind, 'shell');

  const gitignore = resolveFileIcon(entry('.gitignore', { extension: '' }));
  assert.equal(gitignore.kind, 'config');
  assert.equal(gitignore.badge, 'CFG');

  const envFile = resolveFileIcon(entry('.env.local', { extension: '' }));
  assert.equal(envFile.kind, 'security');
  assert.equal(envFile.badge, 'ENV');

  const lockFile = resolveFileIcon(entry('package-lock.json'));
  assert.equal(lockFile.kind, 'config');
  assert.equal(lockFile.badge, 'LCK');

  const tarGz = resolveFileIcon(entry('backup.tar.gz', { extension: '.gz' }));
  assert.equal(tarGz.kind, 'archive');
  assert.equal(tarGz.badge, 'TAR');

  const unknown = resolveFileIcon(entry('mystery_blob', { extension: '' }));
  assert.equal(unknown.kind, 'generic');
  assert.equal(unknown.badge, '');
});
