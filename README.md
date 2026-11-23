# Slate Explorer

A native Windows dark-mode File Explorer built with **React**, **TypeScript**, **Tailwind CSS**, and **Electron** (`contextBridge` + `ipcMain` + Node.js `fs`).

## Architecture

- **`electron/main.ts`**: Electron main process creating a frameless dark-mode `BrowserWindow` (`#141416`, rounded corners) and registering privileged IPC handlers (`fs:*`, `os:*`, `window:*`) plus the `local-thumb://` protocol for image thumbnails.
- **`electron/preload.ts`**: Strict `contextBridge.exposeInMainWorld('electronAPI', ...)` exposing only typed operations to the renderer (`nodeIntegration: false`, `contextIsolation: true`).
- **`electron/fsService.ts`**: Real OS filesystem & Windows shell service:
  - **Windows Drives**: Queries `Win32_LogicalDisk` via PowerShell (`Get-CimInstance`) with volume labels, drive types (`Local Disk`, `Network Drive`, `Removable Disk`), filesystem (`NTFS`, `exFAT`), and exact capacity/free bytes.
  - **Known Folders**: Resolves real Windows Quick Access paths (`Desktop`, `Documents`, `Downloads`, `Pictures`, `Music`, `Videos`, `Home`) via `.NET [Environment]::GetFolderPath`.
  - **Directory Operations**: Batched async `readdir` + `lstat` with per-entry `EPERM`/`EACCES` resilience, recursive search, path autocomplete, Recycle Bin deletion (`shell.trashItem`), permanent deletion, native file opening (`shell.openPath`), Windows "Open with..." (`rundll32.exe shell32.dll,OpenAs_RunDLL`), native shell icons (`app.getFileIcon`), and Windows attributes (`attrib`).
- **`server.ts`**: Express + Vite development/preview server exposing `/api/fs/*` over the exact same `electron/fsService.ts` module when running outside Electron.
- **`src/`**: Virtualized (`@tanstack/react-virtual`) React UI with Details, Tiles, and Compact views, multi-select + marquee lasso selection, drag-and-drop move/copy, inline rename, context menus, and Properties inspector.

## Run on Windows

1. **Install web dependencies**:
   ```bash
   npm install
   ```

2. **Install Electron & Windows builder toolchain**:
   ```bash
   npm run electron:setup
   ```

3. **Launch native Windows desktop app in development**:
   ```bash
   npm run electron:dev
   ```

4. **Build Windows Installer (`.exe` NSIS & Portable)**:
   ```bash
   npm run electron:build
   ```

## Keyboard Shortcuts

- `Ctrl+L` — Edit path in address bar
- `Ctrl+F` — Focus search bar
- `Ctrl+Shift+N` — Create new folder
- `Ctrl+C` / `Ctrl+X` / `Ctrl+V` — Copy / Cut / Paste
- `Ctrl+D` — Duplicate selected items
- `Ctrl+A` — Select all items
- `F2` — Inline rename
- `Delete` / `Shift+Delete` — Move to Recycle Bin / Permanent delete
- `Alt+Enter` — Toggle Properties inspector
- `Alt+Left` / `Alt+Right` / `Alt+Up` — Back / Forward / Parent folder
- `F5` — Refresh directory & drives
