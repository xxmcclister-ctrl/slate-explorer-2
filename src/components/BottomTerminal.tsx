import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  FolderSync,
  Terminal as TerminalIcon,
  Trash2,
} from 'lucide-react';
import { getFsBridge } from '../services/fsBridge';

interface BottomTerminalProps {
  currentPath: string;
  homeDir?: string;
  onRefreshDirectory: () => void;
}

interface TerminalEntry {
  id: string;
  cwd: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

function getRealExplorerPath(currentPath: string, homeDir?: string): string {
  const trimmed = (currentPath || '').trim();
  if (trimmed && !trimmed.toLowerCase().startsWith('shell:')) {
    return trimmed;
  }
  return (homeDir || '').trim() || '/';
}

export const BottomTerminal: React.FC<BottomTerminalProps> = ({
  currentPath,
  homeDir,
  onRefreshDirectory,
}) => {
  const bridge = useMemo(() => getFsBridge(), []);
  const [expanded, setExpanded] = useState(false);
  const [panelHeight, setPanelHeight] = useState(260);
  const [terminalCwd, setTerminalCwd] = useState(() =>
    getRealExplorerPath(currentPath, homeDir),
  );
  const [inputValue, setInputValue] = useState('');
  const [running, setRunning] = useState(false);
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState(-1);

  const footerRef = useRef<HTMLElement>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragStartRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const realExplorerPath = useMemo(
    () => getRealExplorerPath(currentPath, homeDir),
    [currentPath, homeDir],
  );

  // Always stay synced with whatever real folder the user navigates to in Explorer
  useEffect(() => {
    setTerminalCwd(realExplorerPath);
  }, [realExplorerPath]);

  useEffect(() => {
    if (footerRef.current) {
      footerRef.current.style.setProperty('--terminal-panel-height', `${panelHeight}px`);
    }
  }, [panelHeight]);

  useEffect(() => {
    if (!expanded) return;
    outputEndRef.current?.scrollIntoView({ block: 'end' });
  }, [entries, expanded]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const deltaY = dragStartRef.current.startY - e.clientY;
      const next = Math.min(540, Math.max(170, dragStartRef.current.startHeight + deltaY));
      setPanelHeight(next);
    };
    const handleMouseUp = () => {
      dragStartRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleExpandToggle = () => {
    if (!expanded) {
      setTerminalCwd(realExplorerPath);
      setExpanded(true);
      setTimeout(() => inputRef.current?.focus(), 40);
    } else {
      setExpanded(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || running) return;

    if (trimmed === 'clear' || trimmed === 'cls') {
      setEntries([]);
      setInputValue('');
      setCmdHistory((prev) => [trimmed, ...prev.slice(0, 49)]);
      setHistoryCursor(-1);
      return;
    }

    const activeCwd = terminalCwd || realExplorerPath;
    setRunning(true);
    setInputValue('');
    setCmdHistory((prev) => [trimmed, ...prev.slice(0, 49)]);
    setHistoryCursor(-1);

    try {
      let result;
      if (bridge.execTerminalCommand) {
        result = await bridge.execTerminalCommand(trimmed, activeCwd);
      } else {
        const res = await bridge.openInTerminal(activeCwd);
        result = {
          ok: res.ok,
          stdout: res.message || '',
          stderr: res.ok ? '' : res.message || 'Terminal bridge unavailable.',
          exitCode: res.ok ? 0 : 1,
          cwd: activeCwd,
        };
      }

      setEntries((prev) => [
        ...prev.slice(-99),
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          cwd: activeCwd,
          command: trimmed,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        },
      ]);

      if (result.cwd) {
        setTerminalCwd(result.cwd);
      }

      onRefreshDirectory();
    } catch (err) {
      setEntries((prev) => [
        ...prev.slice(-99),
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          cwd: activeCwd,
          command: trimmed,
          stdout: '',
          stderr: (err as Error).message || 'Failed to execute command.',
          exitCode: 1,
        },
      ]);
    } finally {
      setRunning(false);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      setEntries([]);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setExpanded(false);
      return;
    }
    if (e.key === 'ArrowUp') {
      if (cmdHistory.length === 0) return;
      e.preventDefault();
      const nextIdx = Math.min(historyCursor + 1, cmdHistory.length - 1);
      setHistoryCursor(nextIdx);
      setInputValue(cmdHistory[nextIdx] ?? '');
      return;
    }
    if (e.key === 'ArrowDown') {
      if (cmdHistory.length === 0 || historyCursor < 0) return;
      e.preventDefault();
      const nextIdx = historyCursor - 1;
      setHistoryCursor(nextIdx);
      setInputValue(nextIdx >= 0 ? cmdHistory[nextIdx] ?? '' : '');
    }
  };

  const isSyncedWithExplorer = terminalCwd === realExplorerPath;

  return (
    <footer
      ref={footerRef}
      aria-label="Integrated terminal"
      data-testid="bottom-terminal"
      data-expanded={expanded ? 'true' : 'false'}
      className={`relative z-10 mx-1.5 mb-1.5 bg-[var(--win-chrome)] border ${
        expanded ? 'border-[var(--win-border-strong)] h-[var(--terminal-panel-height,260px)]' : 'border-[var(--win-border)] h-9'
      } rounded-2xl flex flex-col overflow-hidden shrink-0 select-none transition-[height] duration-150`}
    >
      {expanded && (
        <>
          {/* Drag handle along top edge to resize upward panel height */}
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize terminal height"
            onMouseDown={(e) => {
              e.preventDefault();
              dragStartRef.current = { startY: e.clientY, startHeight: panelHeight };
            }}
            className="h-1.5 w-full cursor-ns-resize flex items-center justify-center hover:bg-blue-500/20 transition-colors shrink-0"
          >
            <span className="w-10 h-0.5 rounded-full bg-[var(--win-border-strong)]" />
          </div>

          {/* Expanded Header Bar */}
          <div className="h-8 px-3 border-b border-[var(--win-border)] flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-expanded="true"
              aria-label="Collapse terminal"
              className="flex items-center gap-2 min-w-0 text-left hover:text-[var(--win-text)] transition-colors"
            >
              <TerminalIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-xs font-semibold text-[var(--win-text)] shrink-0">Terminal</span>
              <span
                data-testid="terminal-cwd"
                title={terminalCwd}
                className="px-2 py-0.5 rounded-lg bg-[var(--win-surface)] border border-[var(--win-border)] text-[11px] font-mono-tabular text-[var(--win-text-muted)] truncate max-w-[480px]"
              >
                {terminalCwd}
              </span>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              {!isSyncedWithExplorer && (
                <button
                  type="button"
                  onClick={() => setTerminalCwd(realExplorerPath)}
                  title={`Sync terminal to ${realExplorerPath}`}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--win-surface)] hover:bg-[var(--win-hover)] border border-[var(--win-border)] text-[11px] text-blue-400 transition-colors"
                >
                  <FolderSync className="w-3 h-3" />
                  <span>Sync folder</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setEntries([])}
                aria-label="Clear terminal output"
                title="Clear output (Ctrl+L)"
                className="p-1 rounded-lg text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label="Collapse terminal drawer"
                title="Collapse terminal"
                className="p-1 rounded-lg text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)] transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scrollable Output History */}
          <div
            onClick={() => inputRef.current?.focus()}
            className="flex-1 min-h-0 overflow-y-auto px-3.5 py-2.5 bg-[var(--win-surface)] font-mono-tabular text-xs select-text space-y-2.5"
          >
            <div className="text-[11px] text-[var(--win-text-faint)]">
              Connected to <span className="text-[var(--win-text-muted)]">{realExplorerPath}</span> — shell commands run in your live filesystem.
            </div>
            {entries.map((item) => (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center gap-1.5 text-[var(--win-text)]">
                  <span className="text-emerald-400 shrink-0">{item.cwd} $</span>
                  <span className="font-medium break-all">{item.command}</span>
                </div>
                {item.stdout && (
                  <pre className="whitespace-pre-wrap break-words text-[var(--win-text-muted)] leading-relaxed pl-2 border-l border-[var(--win-border)]">
                    {item.stdout}
                  </pre>
                )}
                {item.stderr && (
                  <pre className="whitespace-pre-wrap break-words text-rose-400 leading-relaxed pl-2 border-l border-rose-500/40">
                    {item.stderr}
                  </pre>
                )}
              </div>
            ))}
            <div ref={outputEndRef} />
          </div>

          {/* Command Prompt Input */}
          <form
            onSubmit={handleSubmit}
            className="px-3.5 py-2 bg-[var(--win-surface)] border-t border-[var(--win-border)] flex items-center gap-2 font-mono-tabular text-xs shrink-0"
          >
            <span className="text-emerald-400 font-semibold shrink-0 max-w-[260px] truncate" title={terminalCwd}>
              {terminalCwd} $
            </span>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              disabled={running}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Terminal command input"
              placeholder={running ? 'Running command...' : 'Enter command (pwd, ls, mkdir, touch, cd...)'}
              className="flex-1 min-w-0 bg-transparent text-[var(--win-text)] placeholder-[var(--win-text-faint)] focus:outline-none disabled:opacity-50"
            />
          </form>
        </>
      )}

      {!expanded && (
        <button
          type="button"
          onClick={handleExpandToggle}
          aria-expanded="false"
          aria-label="Open terminal"
          data-testid="terminal-toggle-bar"
          className="w-full h-full px-3.5 flex items-center justify-between gap-3 text-left hover:bg-[var(--win-hover)] transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <TerminalIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-xs font-medium text-[var(--win-text)] shrink-0">Terminal</span>
            <span
              data-testid="terminal-cwd"
              title={terminalCwd}
              className="px-2 py-0.5 rounded-lg bg-[var(--win-surface)] border border-[var(--win-border)] text-[11px] font-mono-tabular text-[var(--win-text-muted)] truncate max-w-[520px]"
            >
              {terminalCwd}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--win-text-muted)] shrink-0">
            <span>Click to expand</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </div>
        </button>
      )}
    </footer>
  );
};
