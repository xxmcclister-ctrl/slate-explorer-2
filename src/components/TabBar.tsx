import React, { useEffect, useState } from 'react';
import {
  FolderOpen,
  Minus,
  Plus,
  Square,
  X,
} from 'lucide-react';
import type { DesktopBridgeAPI } from '../../electron/types';
import type { ExplorerTab } from '../utils/explorerLogic';

interface WindowCaptionControlsProps {
  isWindowMaximized?: boolean;
  bridge: DesktopBridgeAPI;
  onWindowMinimize?: () => void;
  onWindowMaximizeToggle?: () => void;
  onWindowClose?: () => void;
}

export const WindowCaptionControls: React.FC<WindowCaptionControlsProps> = ({
  isWindowMaximized,
  bridge,
  onWindowMinimize,
  onWindowMaximizeToggle,
  onWindowClose,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (bridge.windowControls) {
      bridge.windowControls.isMaximized().then(setIsMaximized).catch(() => {});
    }
  }, [bridge]);

  const maximized = bridge.windowControls ? isMaximized : Boolean(isWindowMaximized);

  return (
    <div className="flex items-center gap-0.5 shrink-0 app-no-drag ml-auto">
      <button
        type="button"
        onClick={() => {
          if (bridge.windowControls) bridge.windowControls.minimize();
          else onWindowMinimize?.();
        }}
        aria-label="Minimize window"
        title="Minimize"
        className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)] transition-colors"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={async () => {
          if (bridge.windowControls) {
            const max = await bridge.windowControls.maximizeToggle();
            setIsMaximized(Boolean(max));
          } else {
            onWindowMaximizeToggle?.();
          }
        }}
        aria-label={maximized ? 'Shrink window' : 'Maximize window'}
        title={maximized ? 'Restore Down' : 'Maximize'}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)] transition-colors"
      >
        {maximized ? (
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <rect x="2.5" y="5" width="8.5" height="8.5" rx="1.6" />
            <path d="M5.5 5V3.9A1.4 1.4 0 0 1 6.9 2.5h5.2a1.4 1.4 0 0 1 1.4 1.4v5.2a1.4 1.4 0 0 1-1.4 1.4H11" />
          </svg>
        ) : (
          <Square className="w-3 h-3" />
        )}
      </button>
      <button
        type="button"
        onClick={() => {
          if (bridge.windowControls) bridge.windowControls.close();
          else onWindowClose?.();
        }}
        aria-label="Close window"
        title="Close"
        className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--win-text-muted)] hover:text-white hover:bg-rose-600/90 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

interface TabBarProps {
  tabs: ExplorerTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onNewTab: () => void;
  onCloseTab: (tabId: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onNewTab,
  onCloseTab,
}) => {
  return (
    <div
      role="tablist"
      aria-label="Explorer tabs"
      className="flex items-center gap-1 px-1.5 pt-0 pb-1.5 overflow-x-auto shrink-0 select-none"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`group flex items-center gap-1.5 h-8 pl-2.5 pr-1.5 rounded-xl border transition-colors max-w-[200px] min-w-[110px] shrink-0 ${
              active
                ? 'bg-[var(--win-surface)] border-[var(--win-border-strong)] text-[var(--win-text)] shadow-xs'
                : 'bg-transparent border-transparent text-[var(--win-text-muted)] hover:bg-[var(--win-hover)] hover:text-[var(--win-text)]'
            }`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelectTab(tab.id)}
              onMouseDown={(e) => {
                if (e.button === 1 && tabs.length > 1) {
                  e.preventDefault();
                  onCloseTab(tab.id);
                }
              }}
              title={tab.history[tab.historyIndex] || tab.title}
              className="flex items-center gap-1.5 flex-1 min-w-0 text-left text-xs font-medium whitespace-nowrap"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="truncate">{tab.title}</span>
            </button>
            {tabs.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                aria-label={`Close tab ${tab.title}`}
                title="Close tab (Ctrl+W)"
                className="p-0.5 rounded-md opacity-60 group-hover:opacity-100 hover:bg-[var(--win-active)] transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={onNewTab}
        aria-label="New tab"
        title="New tab (Ctrl+T)"
        className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)] shrink-0 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

