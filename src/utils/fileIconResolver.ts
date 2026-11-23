import type { FileEntry } from '../../electron/types';

export type FileIconKind =
  | 'folder'
  | 'pdf'
  | 'word'
  | 'spreadsheet'
  | 'presentation'
  | 'markdown'
  | 'text'
  | 'image'
  | 'vector'
  | 'video'
  | 'audio'
  | 'archive'
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'rust'
  | 'go'
  | 'c-cpp'
  | 'java'
  | 'csharp'
  | 'html'
  | 'css'
  | 'json'
  | 'config'
  | 'database'
  | 'shell'
  | 'executable'
  | 'font'
  | 'security'
  | 'disk'
  | 'code'
  | 'generic';

export type FileIconCategory =
  | 'folder'
  | 'document'
  | 'media'
  | 'code'
  | 'data'
  | 'archive'
  | 'system'
  | 'generic';

export interface FileIconDescriptor {
  kind: FileIconKind;
  badge: string;
  label: string;
  category: FileIconCategory;
  strokeClass: string;
  docFillClass: string;
  badgeBgClass: string;
  badgeTextClass: string;
  tintBgClass: string;
}

export type FileIconEntryInput = Pick<
  FileEntry,
  'name' | 'extension' | 'isDirectory' | 'isImage'
>;

const DESCRIPTORS: Record<FileIconKind, Omit<FileIconDescriptor, 'kind' | 'badge' | 'label'>> = {
  folder: {
    category: 'folder',
    strokeClass: 'text-amber-400',
    docFillClass: 'fill-amber-400/20',
    badgeBgClass: 'bg-amber-500',
    badgeTextClass: 'text-amber-950',
    tintBgClass: 'bg-amber-500/10 border-amber-500/20',
  },
  pdf: {
    category: 'document',
    strokeClass: 'text-rose-500 dark:text-rose-400',
    docFillClass: 'fill-rose-500/15',
    badgeBgClass: 'bg-rose-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-rose-500/10 border-rose-500/20',
  },
  word: {
    category: 'document',
    strokeClass: 'text-blue-600 dark:text-blue-400',
    docFillClass: 'fill-blue-500/15',
    badgeBgClass: 'bg-blue-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-blue-500/10 border-blue-500/20',
  },
  spreadsheet: {
    category: 'data',
    strokeClass: 'text-emerald-600 dark:text-emerald-400',
    docFillClass: 'fill-emerald-500/15',
    badgeBgClass: 'bg-emerald-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-emerald-500/10 border-emerald-500/20',
  },
  presentation: {
    category: 'document',
    strokeClass: 'text-orange-600 dark:text-orange-400',
    docFillClass: 'fill-orange-500/15',
    badgeBgClass: 'bg-orange-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-orange-500/10 border-orange-500/20',
  },
  markdown: {
    category: 'document',
    strokeClass: 'text-sky-600 dark:text-sky-400',
    docFillClass: 'fill-sky-500/15',
    badgeBgClass: 'bg-sky-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-sky-500/10 border-sky-500/20',
  },
  text: {
    category: 'document',
    strokeClass: 'text-slate-600 dark:text-slate-300',
    docFillClass: 'fill-slate-400/15',
    badgeBgClass: 'bg-slate-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-slate-500/10 border-slate-500/20',
  },
  image: {
    category: 'media',
    strokeClass: 'text-cyan-600 dark:text-cyan-400',
    docFillClass: 'fill-cyan-500/15',
    badgeBgClass: 'bg-cyan-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-cyan-500/10 border-cyan-500/20',
  },
  vector: {
    category: 'media',
    strokeClass: 'text-fuchsia-600 dark:text-fuchsia-400',
    docFillClass: 'fill-fuchsia-500/15',
    badgeBgClass: 'bg-fuchsia-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-fuchsia-500/10 border-fuchsia-500/20',
  },
  video: {
    category: 'media',
    strokeClass: 'text-violet-600 dark:text-violet-400',
    docFillClass: 'fill-violet-500/15',
    badgeBgClass: 'bg-violet-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-violet-500/10 border-violet-500/20',
  },
  audio: {
    category: 'media',
    strokeClass: 'text-pink-600 dark:text-pink-400',
    docFillClass: 'fill-pink-500/15',
    badgeBgClass: 'bg-pink-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-pink-500/10 border-pink-500/20',
  },
  archive: {
    category: 'archive',
    strokeClass: 'text-amber-600 dark:text-amber-400',
    docFillClass: 'fill-amber-500/18',
    badgeBgClass: 'bg-amber-500',
    badgeTextClass: 'text-amber-950',
    tintBgClass: 'bg-amber-500/10 border-amber-500/20',
  },
  typescript: {
    category: 'code',
    strokeClass: 'text-blue-600 dark:text-sky-400',
    docFillClass: 'fill-blue-500/15',
    badgeBgClass: 'bg-blue-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-blue-500/10 border-blue-500/20',
  },
  javascript: {
    category: 'code',
    strokeClass: 'text-yellow-600 dark:text-yellow-400',
    docFillClass: 'fill-yellow-400/18',
    badgeBgClass: 'bg-yellow-400',
    badgeTextClass: 'text-yellow-950',
    tintBgClass: 'bg-yellow-500/10 border-yellow-500/20',
  },
  python: {
    category: 'code',
    strokeClass: 'text-indigo-600 dark:text-indigo-400',
    docFillClass: 'fill-indigo-500/15',
    badgeBgClass: 'bg-indigo-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-indigo-500/10 border-indigo-500/20',
  },
  rust: {
    category: 'code',
    strokeClass: 'text-orange-600 dark:text-orange-400',
    docFillClass: 'fill-orange-500/15',
    badgeBgClass: 'bg-orange-700',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-orange-500/10 border-orange-500/20',
  },
  go: {
    category: 'code',
    strokeClass: 'text-cyan-600 dark:text-cyan-300',
    docFillClass: 'fill-cyan-500/15',
    badgeBgClass: 'bg-cyan-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-cyan-500/10 border-cyan-500/20',
  },
  'c-cpp': {
    category: 'code',
    strokeClass: 'text-sky-600 dark:text-blue-400',
    docFillClass: 'fill-blue-500/15',
    badgeBgClass: 'bg-blue-700',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-blue-500/10 border-blue-500/20',
  },
  java: {
    category: 'code',
    strokeClass: 'text-red-600 dark:text-red-400',
    docFillClass: 'fill-red-500/15',
    badgeBgClass: 'bg-red-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-red-500/10 border-red-500/20',
  },
  csharp: {
    category: 'code',
    strokeClass: 'text-purple-600 dark:text-purple-400',
    docFillClass: 'fill-purple-500/15',
    badgeBgClass: 'bg-purple-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-purple-500/10 border-purple-500/20',
  },
  html: {
    category: 'code',
    strokeClass: 'text-orange-600 dark:text-orange-400',
    docFillClass: 'fill-orange-500/15',
    badgeBgClass: 'bg-orange-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-orange-500/10 border-orange-500/20',
  },
  css: {
    category: 'code',
    strokeClass: 'text-indigo-600 dark:text-violet-400',
    docFillClass: 'fill-violet-500/15',
    badgeBgClass: 'bg-violet-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-violet-500/10 border-violet-500/20',
  },
  json: {
    category: 'data',
    strokeClass: 'text-amber-600 dark:text-amber-300',
    docFillClass: 'fill-amber-400/15',
    badgeBgClass: 'bg-amber-500',
    badgeTextClass: 'text-amber-950',
    tintBgClass: 'bg-amber-500/10 border-amber-500/20',
  },
  config: {
    category: 'system',
    strokeClass: 'text-teal-600 dark:text-teal-400',
    docFillClass: 'fill-teal-500/15',
    badgeBgClass: 'bg-teal-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-teal-500/10 border-teal-500/20',
  },
  database: {
    category: 'data',
    strokeClass: 'text-cyan-600 dark:text-teal-300',
    docFillClass: 'fill-teal-500/15',
    badgeBgClass: 'bg-teal-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-teal-500/10 border-teal-500/20',
  },
  shell: {
    category: 'system',
    strokeClass: 'text-emerald-600 dark:text-emerald-400',
    docFillClass: 'fill-emerald-500/15',
    badgeBgClass: 'bg-emerald-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-emerald-500/10 border-emerald-500/20',
  },
  executable: {
    category: 'system',
    strokeClass: 'text-sky-600 dark:text-cyan-400',
    docFillClass: 'fill-cyan-500/15',
    badgeBgClass: 'bg-slate-700',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-cyan-500/10 border-cyan-500/20',
  },
  font: {
    category: 'media',
    strokeClass: 'text-rose-600 dark:text-pink-400',
    docFillClass: 'fill-pink-500/15',
    badgeBgClass: 'bg-rose-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-pink-500/10 border-pink-500/20',
  },
  security: {
    category: 'system',
    strokeClass: 'text-yellow-600 dark:text-amber-300',
    docFillClass: 'fill-amber-400/15',
    badgeBgClass: 'bg-amber-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-amber-500/10 border-amber-500/20',
  },
  disk: {
    category: 'system',
    strokeClass: 'text-indigo-600 dark:text-indigo-400',
    docFillClass: 'fill-indigo-500/15',
    badgeBgClass: 'bg-indigo-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-indigo-500/10 border-indigo-500/20',
  },
  code: {
    category: 'code',
    strokeClass: 'text-blue-600 dark:text-blue-400',
    docFillClass: 'fill-blue-500/15',
    badgeBgClass: 'bg-blue-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-blue-500/10 border-blue-500/20',
  },
  generic: {
    category: 'generic',
    strokeClass: 'text-zinc-500 dark:text-zinc-400',
    docFillClass: 'fill-zinc-400/10',
    badgeBgClass: 'bg-zinc-600',
    badgeTextClass: 'text-white',
    tintBgClass: 'bg-zinc-500/10 border-zinc-500/15',
  },
};

function makeDescriptor(
  kind: FileIconKind,
  badge: string,
  label: string,
): FileIconDescriptor {
  return {
    kind,
    badge,
    label,
    ...DESCRIPTORS[kind],
  };
}

function cleanExtBadge(ext: string, maxLen = 4): string {
  const cleaned = ext.replace(/^\./, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned.slice(0, maxLen);
}

function normalizeExtension(name: string, extension?: string): string {
  const raw = (extension || '').trim().toLowerCase();
  if (raw) {
    return raw.startsWith('.') ? raw : `.${raw}`;
  }
  const lower = name.trim().toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot > 0 && dot < lower.length - 1) {
    return lower.slice(dot);
  }
  return '';
}

const SHELL_DOTFILES = new Set([
  '.bashrc',
  '.bash_profile',
  '.bash_aliases',
  '.bash_logout',
  '.zshrc',
  '.zprofile',
  '.zshenv',
  '.profile',
  '.kshrc',
  'gradlew',
]);

const CONFIG_DOTFILES = new Set([
  '.gitignore',
  '.gitattributes',
  '.gitmodules',
  '.dockerignore',
  '.npmignore',
  '.eslintignore',
  '.prettierignore',
  '.editorconfig',
  '.npmrc',
  '.nvmrc',
  '.prettierrc',
  '.eslintrc',
  'dockerfile',
  'makefile',
  'cmakelists.txt',
]);

const LOCK_FILENAMES = new Set([
  'package-lock.json',
  'bun.lock',
  'bun.lockb',
  'yarn.lock',
  'pnpm-lock.yaml',
  'cargo.lock',
  'poetry.lock',
  'composer.lock',
  'gemfile.lock',
]);

export function resolveFileIcon(entry: FileIconEntryInput): FileIconDescriptor {
  if (entry.isDirectory) {
    return makeDescriptor('folder', '', 'Folder');
  }

  const lowerName = entry.name.trim().toLowerCase();

  if (SHELL_DOTFILES.has(lowerName)) {
    return makeDescriptor('shell', 'SH', 'Shell Configuration');
  }

  if (lowerName === '.env' || lowerName.startsWith('.env.')) {
    return makeDescriptor('security', 'ENV', 'Environment Config');
  }

  if (LOCK_FILENAMES.has(lowerName)) {
    return makeDescriptor('config', 'LCK', 'Lockfile');
  }

  if (CONFIG_DOTFILES.has(lowerName) || lowerName.startsWith('docker-compose.')) {
    const badge = lowerName === 'dockerfile' || lowerName.startsWith('docker-compose.') ? 'DKR' : 'CFG';
    return makeDescriptor('config', badge, 'Configuration File');
  }

  if (lowerName === 'license' || lowerName === 'license.txt' || lowerName === 'copying') {
    return makeDescriptor('text', 'LIC', 'License Document');
  }

  if (
    lowerName.endsWith('.tar.gz') ||
    lowerName.endsWith('.tar.bz2') ||
    lowerName.endsWith('.tar.xz') ||
    lowerName.endsWith('.tar.zst') ||
    lowerName.endsWith('.tgz')
  ) {
    return makeDescriptor('archive', 'TAR', 'Compressed Tarball');
  }

  const ext = normalizeExtension(entry.name, entry.extension);

  if (ext === '.pdf') {
    return makeDescriptor('pdf', 'PDF', 'PDF Document');
  }

  if (ext === '.doc' || ext === '.docx' || ext === '.odt' || ext === '.pages') {
    return makeDescriptor('word', 'DOC', 'Word Document');
  }
  if (ext === '.rtf') {
    return makeDescriptor('word', 'RTF', 'Rich Text Document');
  }

  if (ext === '.xls' || ext === '.xlsx' || ext === '.ods' || ext === '.numbers') {
    return makeDescriptor('spreadsheet', 'XLS', 'Spreadsheet');
  }
  if (ext === '.csv') {
    return makeDescriptor('spreadsheet', 'CSV', 'CSV Spreadsheet');
  }
  if (ext === '.tsv') {
    return makeDescriptor('spreadsheet', 'TSV', 'TSV Spreadsheet');
  }

  if (ext === '.ppt' || ext === '.pptx' || ext === '.odp' || ext === '.keynote') {
    return makeDescriptor('presentation', 'PPT', 'Presentation');
  }

  if (ext === '.md' || ext === '.mdx' || ext === '.markdown') {
    return makeDescriptor('markdown', 'MD', 'Markdown Document');
  }

  if (ext === '.txt') {
    return makeDescriptor('text', 'TXT', 'Text Document');
  }
  if (ext === '.log' || ext === '.nfo') {
    return makeDescriptor('text', 'LOG', 'Log File');
  }

  if (ext === '.svg' || ext === '.ai' || ext === '.eps' || ext === '.fig') {
    return makeDescriptor('vector', cleanExtBadge(ext, 3) || 'SVG', 'Vector Graphic');
  }

  if (
    entry.isImage ||
    ext === '.png' ||
    ext === '.jpg' ||
    ext === '.jpeg' ||
    ext === '.webp' ||
    ext === '.gif' ||
    ext === '.bmp' ||
    ext === '.ico' ||
    ext === '.avif' ||
    ext === '.tif' ||
    ext === '.tiff' ||
    ext === '.heic'
  ) {
    const imgBadge =
      ext === '.jpeg' ? 'JPG' : ext === '.tiff' ? 'TIF' : cleanExtBadge(ext, 4) || 'IMG';
    return makeDescriptor('image', imgBadge, 'Image File');
  }

  if (
    ext === '.mp4' ||
    ext === '.mkv' ||
    ext === '.mov' ||
    ext === '.avi' ||
    ext === '.webm' ||
    ext === '.wmv' ||
    ext === '.flv' ||
    ext === '.m4v' ||
    ext === '.mpg' ||
    ext === '.mpeg'
  ) {
    return makeDescriptor('video', cleanExtBadge(ext, 3) || 'VID', 'Video File');
  }

  if (
    ext === '.mp3' ||
    ext === '.wav' ||
    ext === '.flac' ||
    ext === '.ogg' ||
    ext === '.aac' ||
    ext === '.m4a' ||
    ext === '.opus' ||
    ext === '.wma' ||
    ext === '.aiff'
  ) {
    return makeDescriptor('audio', cleanExtBadge(ext, 3) || 'AUD', 'Audio File');
  }

  if (
    ext === '.zip' ||
    ext === '.7z' ||
    ext === '.rar' ||
    ext === '.tar' ||
    ext === '.gz' ||
    ext === '.bz2' ||
    ext === '.xz' ||
    ext === '.zst' ||
    ext === '.cab'
  ) {
    return makeDescriptor('archive', cleanExtBadge(ext, 3) || 'ZIP', 'Archive');
  }

  if (ext === '.tsx') {
    return makeDescriptor('typescript', 'TSX', 'TypeScript React');
  }
  if (ext === '.ts' || ext === '.mts' || ext === '.cts') {
    return makeDescriptor('typescript', 'TS', 'TypeScript Source');
  }

  if (ext === '.jsx') {
    return makeDescriptor('javascript', 'JSX', 'JavaScript React');
  }
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
    return makeDescriptor('javascript', 'JS', 'JavaScript Source');
  }

  if (ext === '.py' || ext === '.pyw' || ext === '.pyi') {
    return makeDescriptor('python', 'PY', 'Python Script');
  }
  if (ext === '.ipynb') {
    return makeDescriptor('python', 'NB', 'Jupyter Notebook');
  }

  if (ext === '.rs') {
    return makeDescriptor('rust', 'RS', 'Rust Source');
  }

  if (ext === '.go') {
    return makeDescriptor('go', 'GO', 'Go Source');
  }

  if (ext === '.c') {
    return makeDescriptor('c-cpp', 'C', 'C Source');
  }
  if (ext === '.h' || ext === '.hpp') {
    return makeDescriptor('c-cpp', 'H', 'C/C++ Header');
  }
  if (ext === '.cpp' || ext === '.cc' || ext === '.cxx') {
    return makeDescriptor('c-cpp', 'C++', 'C++ Source');
  }

  if (ext === '.java') {
    return makeDescriptor('java', 'JAV', 'Java Source');
  }
  if (ext === '.kt' || ext === '.kts') {
    return makeDescriptor('java', 'KT', 'Kotlin Source');
  }

  if (ext === '.cs') {
    return makeDescriptor('csharp', 'C#', 'C# Source');
  }

  if (ext === '.html' || ext === '.htm' || ext === '.xhtml') {
    return makeDescriptor('html', 'HTML', 'HTML Document');
  }

  if (ext === '.css') {
    return makeDescriptor('css', 'CSS', 'Stylesheet');
  }
  if (ext === '.scss' || ext === '.sass' || ext === '.less') {
    return makeDescriptor('css', cleanExtBadge(ext, 3), 'Stylesheet');
  }

  if (ext === '.json' || ext === '.jsonc' || ext === '.json5') {
    return makeDescriptor('json', 'JSON', 'JSON Data');
  }

  if (
    ext === '.yml' ||
    ext === '.yaml' ||
    ext === '.toml' ||
    ext === '.xml' ||
    ext === '.ini' ||
    ext === '.conf' ||
    ext === '.cfg' ||
    ext === '.properties' ||
    ext === '.lock'
  ) {
    const cfgBadge =
      ext === '.yaml' || ext === '.yml'
        ? 'YML'
        : ext === '.toml'
          ? 'TML'
          : ext === '.xml'
            ? 'XML'
            : ext === '.lock'
              ? 'LCK'
              : 'CFG';
    return makeDescriptor('config', cfgBadge, 'Configuration File');
  }

  if (ext === '.sql') {
    return makeDescriptor('database', 'SQL', 'SQL Script');
  }
  if (ext === '.db' || ext === '.sqlite' || ext === '.sqlite3' || ext === '.mdb' || ext === '.parquet') {
    return makeDescriptor('database', 'DB', 'Database File');
  }

  if (ext === '.sh' || ext === '.bash' || ext === '.zsh' || ext === '.fish') {
    return makeDescriptor('shell', 'SH', 'Shell Script');
  }
  if (ext === '.ps1') {
    return makeDescriptor('shell', 'PS1', 'PowerShell Script');
  }
  if (ext === '.bat' || ext === '.cmd') {
    return makeDescriptor('shell', 'BAT', 'Batch Script');
  }

  if (
    ext === '.exe' ||
    ext === '.msi' ||
    ext === '.appimage' ||
    ext === '.deb' ||
    ext === '.rpm' ||
    ext === '.apk' ||
    ext === '.bin' ||
    ext === '.dll' ||
    ext === '.so' ||
    ext === '.dylib'
  ) {
    return makeDescriptor('executable', cleanExtBadge(ext, 3) || 'BIN', 'Executable / Binary');
  }

  if (ext === '.ttf' || ext === '.otf' || ext === '.woff' || ext === '.woff2' || ext === '.eot') {
    return makeDescriptor('font', 'FNT', 'Font File');
  }

  if (
    ext === '.pem' ||
    ext === '.key' ||
    ext === '.crt' ||
    ext === '.cer' ||
    ext === '.pub' ||
    ext === '.gpg' ||
    ext === '.pfx' ||
    ext === '.p12' ||
    ext === '.env'
  ) {
    return makeDescriptor('security', ext === '.env' ? 'ENV' : 'KEY', 'Key / Certificate');
  }

  if (ext === '.iso' || ext === '.dmg' || ext === '.img' || ext === '.vhd' || ext === '.vhdx' || ext === '.vmdk') {
    return makeDescriptor('disk', cleanExtBadge(ext, 3) || 'ISO', 'Disk Image');
  }

  if (
    ext === '.php' ||
    ext === '.rb' ||
    ext === '.swift' ||
    ext === '.dart' ||
    ext === '.lua' ||
    ext === '.r' ||
    ext === '.scala' ||
    ext === '.vue' ||
    ext === '.svelte' ||
    ext === '.astro' ||
    ext === '.graphql' ||
    ext === '.gql' ||
    ext === '.prisma' ||
    ext === '.zig' ||
    ext === '.ex' ||
    ext === '.erl' ||
    ext === '.clj'
  ) {
    return makeDescriptor('code', cleanExtBadge(ext, 3) || 'CODE', 'Source Code');
  }

  const fallbackBadge = ext ? cleanExtBadge(ext, 3) : '';
  return makeDescriptor('generic', fallbackBadge, 'File');
}
