import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Sidebar } from './components/Sidebar';
import { ChatPanel } from './components/ChatPanel';
import { ChatInputArea } from './components/chat-input';
import { WelcomeView } from './components/WelcomeView';
import { SettingsPanel } from './components/SettingsPanel';
import { SkillsPage } from './components/skills';
import { SetupDialog } from './components/SetupDialog';
import { useSidecar } from './hooks/useSidecar';
import { useAppStore } from './store/useAppStore';
import type { PermissionResult } from './types';
import './App.css';

function App() {
  const { start, send } = useSidecar();
  const [showSettings, setShowSettings] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [envStatus, setEnvStatus] = useState<{
    hasClaudeCode: boolean;
    missingSkills: string[];
  } | null>(null);
  const initRef = useRef(false);

  // Expose send function globally for components that don't have access to the hook
  useEffect(() => {
    window.sidecarSend = send;
    return () => {
      window.sidecarSend = undefined;
    };
  }, [send]);

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
          // Check environment status
          send({ type: 'env.check' });
        }
      } catch (e) {
        console.error('Failed to initialize:', e);
      }
    };
    init();
  }, [start, send]);

  // Listen for environment status from sidecar
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type === 'env.status') {
          const { hasClaudeCode, missingSkills } = data.payload;
          setEnvStatus({ hasClaudeCode, missingSkills });
          // Show setup dialog if Claude Code is missing or skills need to be installed
          if (!hasClaudeCode || missingSkills.length > 0) {
            // Check if user has dismissed before (using localStorage)
            const dismissed = localStorage.getItem('setupDismissed');
            if (!dismissed) {
              setShowSetup(true);
            }
          }
        } else if (data.type === 'skills.bundled.installed') {
          // Skills installed, refresh skills list and close dialog
          send({ type: 'skills.list', payload: {} });
          setShowSetup(false);
        }
      } catch {
        // Ignore parse errors
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [send]);

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
    setShowSkills(false);
  }, []);

  const handleOpenSkills = useCallback(() => {
    setShowSkills(true);
    setShowSettings(false);
  }, []);

  const handleCloseSkills = useCallback(() => {
    setShowSkills(false);
  }, []);

  const handleInstallBundledSkills = useCallback(() => {
    send({ type: 'skills.installBundled' });
  }, [send]);

  const handleDismissSetup = useCallback(() => {
    setShowSetup(false);
    localStorage.setItem('setupDismissed', 'true');
  }, []);

  const handleUseSkill = useCallback(() => {
    // Just close skills page - pendingSkill is already set by SkillShortcuts
    setShowSkills(false);
    // Clear active session to show welcome page with pre-filled input
    setActiveSessionId(null);
  }, [setActiveSessionId]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    send({ type: 'session.delete', payload: { sessionId } });
  }, [send]);

  const setPendingStart = useAppStore((s) => s.setPendingStart);

  const attachments = useAppStore((s) => s.attachments);
  const clearAttachments = useAppStore((s) => s.clearAttachments);

  const handleSendMessage = useCallback((prompt: string) => {
    // 如果没有选择工作目录，提示用户先选择
    if (!cwd) {
      // 触发 RepoSelector 展开并显示提示
      useAppStore.getState().setShowCwdPrompt(true);
      return;
    }

    const currentCwd = cwd;
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
        onOpenSkills={handleOpenSkills}
      />

      <main className="main-content">
        <div
          className="titlebar-drag-region"
          data-tauri-drag-region="true"
          onMouseDown={(e) => e.stopPropagation()}
        />
        {showSkills ? (
          <SkillsPage onClose={handleCloseSkills} onUseSkill={handleUseSkill} />
        ) : showWelcome ? (
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

      {showSetup && envStatus && (
        <SetupDialog
          hasClaudeCode={envStatus.hasClaudeCode}
          missingSkills={envStatus.missingSkills}
          onInstallSkills={handleInstallBundledSkills}
          onDismiss={handleDismissSetup}
        />
      )}
    </div>
  );
}

export default App;
