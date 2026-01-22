import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { revealInFinder } from '../utils/pathUtils';
import type { SessionView } from '../types';
import './Sidebar.css';

interface SidebarProps {
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onOpenSettings: () => void;
  onOpenSkills: () => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  sessionId: string | null;
  sessionCwd: string | null;
}

function getStatusColor(status: SessionView['status']): string {
  switch (status) {
    case 'running':
      return '#f59e0b';
    case 'completed':
      return '#22c55e';
    case 'error':
      return '#ef4444';
    default:
      return '#94a3b8';
  }
}

function formatTime(timestamp?: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

export function Sidebar({ onNewSession, onDeleteSession, onOpenSettings, onOpenSkills }: SidebarProps) {
  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const setActiveSessionId = useAppStore((s) => s.setActiveSessionId);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    sessionId: null,
    sessionCwd: null,
  });

  const sessionList = Object.values(sessions).sort(
    (a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)
  );

  const handleContextMenu = useCallback((e: React.MouseEvent, session: SessionView) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      sessionId: session.id,
      sessionCwd: session.cwd || null,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  // Close context menu when clicking anywhere outside
  useEffect(() => {
    if (!contextMenu.visible) return;

    const handleClickOutside = () => {
      closeContextMenu();
    };

    // Add listener on next tick to avoid immediate trigger
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [contextMenu.visible, closeContextMenu]);

  const handleOpenInFinder = useCallback(() => {
    if (contextMenu.sessionCwd) {
      revealInFinder(contextMenu.sessionCwd);
    }
    closeContextMenu();
  }, [contextMenu.sessionCwd, closeContextMenu]);

  const handleDeleteFromMenu = useCallback(() => {
    if (contextMenu.sessionId) {
      onDeleteSession(contextMenu.sessionId);
    }
    closeContextMenu();
  }, [contextMenu.sessionId, onDeleteSession, closeContextMenu]);

  return (
    <aside className="sidebar" onClick={closeContextMenu}>
      <div className="sidebar-header" data-tauri-drag-region="true">
        <div className="sidebar-brand">
          <img src="/icon-64.png" alt="ClaudeBench" className="sidebar-logo" />
          <h1 className="sidebar-title">ClaudeBench</h1>
        </div>
        <button className="new-session-btn" onClick={onNewSession}>
          + New Session
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <h2 className="nav-section-title">SESSIONS</h2>
          {sessionList.length === 0 ? (
            <div className="empty-state">
              No sessions yet
            </div>
          ) : (
            <ul className="session-list">
              {sessionList.map((session) => (
                <li key={session.id}>
                  <div
                    className={`session-item ${activeSessionId === session.id ? 'active' : ''}`}
                    onClick={() => setActiveSessionId(session.id)}
                    onContextMenu={(e) => handleContextMenu(e, session)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setActiveSessionId(session.id);
                      }
                    }}
                  >
                    <div className="session-status">
                      <span
                        className="status-indicator"
                        style={{ background: getStatusColor(session.status) }}
                      />
                    </div>
                    <div className="session-info">
                      <span className="session-title">
                        {session.title || 'Untitled'}
                      </span>
                      <span className="session-meta">
                        {session.cwd && (
                          <span className="session-cwd" title={session.cwd}>
                            {session.cwd.split('/').pop()}
                          </span>
                        )}
                        <span className="session-time">
                          {formatTime(session.updatedAt ?? session.createdAt)}
                        </span>
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="footer-buttons">
          <button className="footer-btn skills-btn" onClick={onOpenSkills} title="Skills">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            Skills
          </button>
          <button className="footer-btn settings-btn" onClick={onOpenSettings} title="Settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
        <span className="version">v0.1.4</span>
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.sessionCwd && (
            <button className="context-menu-item" onClick={handleOpenInFinder}>
              <span className="context-menu-icon">📁</span>
              Open in Finder
            </button>
          )}
          <button className="context-menu-item danger" onClick={handleDeleteFromMenu}>
            <span className="context-menu-icon">🗑</span>
            Delete Session
          </button>
        </div>
      )}
    </aside>
  );
}
