import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Sidebar } from './components/Sidebar';
import { ChatPanel } from './components/ChatPanel';
import { ChatInputArea } from './components/chat-input';
import { WelcomeView } from './components/WelcomeView';
import { SettingsPanel } from './components/SettingsPanel';
import { useSidecar } from './hooks/useSidecar';
import { useAppStore } from './store/useAppStore';
import type { PermissionResult } from './types';
import './App.css';

function App() {
  const { start, send } = useSidecar();
  const [showSettings, setShowSettings] = useState(false);
  const initRef = useRef(false);

  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const sessions = useAppStore((s) => s.sessions);
  const globalError = useAppStore((s) => s.globalError);
  const setGlobalError = useAppStore((s) => s.setGlobalError);
  const setActiveSessionId = useAppStore((s) => s.setActiveSessionId);
  const cwd = useAppStore((s) => s.cwd);

  // Auto-start sidecar on mount - with StrictMode guard
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      try {
        const nodeInfo = await invoke<{ found: boolean }>('detect_node');
        if (nodeInfo.found) {
          await start();
          // Request session list after connection
          send({ type: 'session.list' });
        }
      } catch (e) {
        console.error('Failed to initialize:', e);
      }
    };
    init();
  }, [start, send]);

  // Auto-load session history when switching sessions
  useEffect(() => {
    if (!activeSessionId) return;

    const session = sessions[activeSessionId];
    const { historyRequested, markHistoryRequested } = useAppStore.getState();

    // If session exists but not hydrated and history not yet requested
    if (session && !session.hydrated && !historyRequested.has(activeSessionId)) {
      markHistoryRequested(activeSessionId);
      send({ type: 'session.history', payload: { sessionId: activeSessionId } });
    }
  }, [activeSessionId, sessions, send]);

  const handleNewSession = useCallback(() => {
    // Clear active session to show welcome page
    setActiveSessionId(null);
  }, [setActiveSessionId]);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const handleDeleteSession = useCallback((sessionId: string) => {
    send({ type: 'session.delete', payload: { sessionId } });
  }, [send]);

  const setPendingStart = useAppStore((s) => s.setPendingStart);

  const attachments = useAppStore((s) => s.attachments);
  const clearAttachments = useAppStore((s) => s.clearAttachments);

  const handleSendMessage = useCallback((prompt: string) => {
    const currentCwd = cwd || '/';
    const currentAttachments = attachments.length > 0 ? [...attachments] : undefined;

    // Clear attachments after capturing them
    if (currentAttachments) {
      clearAttachments();
    }

    if (!activeSessionId) {
      // No active session - start a new one from welcome page
      setPendingStart(true);
      send({
        type: 'session.start',
        payload: {
          title: prompt.slice(0, 50),
          prompt,
          cwd: currentCwd,
          attachments: currentAttachments,
        },
      });
      return;
    }

    const session = sessions[activeSessionId];
    if (!session) return;

    if (session.messages.length === 0) {
      // First message - start session
      send({
        type: 'session.start',
        payload: {
          title: prompt.slice(0, 50),
          prompt,
          cwd: session.cwd || currentCwd,
          attachments: currentAttachments,
        },
      });
    } else {
      // Continue session
      send({
        type: 'session.continue',
        payload: {
          sessionId: activeSessionId,
          prompt,
          attachments: currentAttachments,
        },
      });
    }
  }, [activeSessionId, sessions, send, cwd, setPendingStart, attachments, clearAttachments]);

  const handleStopSession = useCallback(() => {
    if (!activeSessionId) return;
    send({ type: 'session.stop', payload: { sessionId: activeSessionId } });
  }, [activeSessionId, send]);

  const handlePermissionResponse = useCallback(
    (sessionId: string, toolUseId: string, result: PermissionResult, toolName?: string, input?: unknown, remember?: boolean) => {
      send({
        type: 'permission.response',
        payload: {
          sessionId,
          toolUseId,
          result,
          toolName,
          input,
          remember,
          rememberBehavior: remember ? (result.behavior === 'allow' ? 'always_allow' : 'always_deny') : undefined,
        },
      });
    },
    [send]
  );

  // Determine if we should show welcome view (no messages in current session)
  const activeSession = activeSessionId ? sessions[activeSessionId] : null;
  const showWelcome = useMemo(() => {
    if (!activeSession) return true;
    // Filter out system messages
    const userMessages = activeSession.messages.filter(
      (m) => (m as any).type !== 'system'
    );
    return userMessages.length === 0;
  }, [activeSession]);

  return (
    <div className="app">
      <Sidebar
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        onOpenSettings={handleOpenSettings}
      />

      <main className="main-content">
        {showWelcome ? (
          <WelcomeView onSend={handleSendMessage} onStop={handleStopSession} />
        ) : (
          <>
            <ChatPanel onPermissionResponse={handlePermissionResponse} />
            <ChatInputArea
              onSend={handleSendMessage}
              onStop={handleStopSession}
            />
          </>
        )}
      </main>

      {showSettings && (
        <>
          <div className="settings-overlay" onClick={() => setShowSettings(false)} />
          <SettingsPanel onClose={() => setShowSettings(false)} />
        </>
      )}

      {globalError && (
        <div className="global-error">
          <span>{globalError}</span>
          <button onClick={() => setGlobalError(null)}>×</button>
        </div>
      )}
    </div>
  );
}

export default App;
