import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';

import { ArtifactPreview } from './components/artifacts';
import { ArtifactsPanel } from './components/ArtifactsPanel';
import { ChatInputArea } from './components/chat-input';
import { ChatPanel } from './components/ChatPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { SetupDialog } from './components/SetupDialog';
import { Sidebar } from './components/Sidebar';
import { SkillsPage } from './components/skills';
import { WelcomeView } from './components/WelcomeView';
import { useSidecar } from './hooks/useSidecar';
import { useAppStore } from './store/useAppStore';
import type { PermissionResult } from './types';

import './App.css';

function App() {
  const { start, send } = useSidecar();
  const [showSettings, setShowSettings] = useState(false);
  const [showArtifacts, setShowArtifacts] = useState(false);
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

  // Intercept all external links and open in default browser
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Check if it's an external link (http/https)
      if (href.startsWith('http://') || href.startsWith('https://')) {
        e.preventDefault();
        e.stopPropagation();
        openUrl(href).catch(console.error);
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

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
    setShowSkills(false);
    setShowArtifacts(false);
    setShowSettings(false);
  }, [setActiveSessionId]);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
    setShowSkills(false);
    setShowArtifacts(false);
  }, []);

  const handleOpenSkills = useCallback(() => {
    setShowSkills(true);
    setShowSettings(false);
    setShowArtifacts(false);
  }, []);

  const handleCloseSkills = useCallback(() => {
    setShowSkills(false);
  }, []);

  const handleOpenArtifacts = useCallback(() => {
    setShowArtifacts(true);
    setShowSettings(false);
    setShowSkills(false);
  }, []);

  const handleSelectSession = useCallback(() => {
    setShowSkills(false);
    setShowArtifacts(false);
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

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      send({ type: 'session.delete', payload: { sessionId } });
    },
    [send]
  );

  const setPendingStart = useAppStore((s) => s.setPendingStart);

  const attachments = useAppStore((s) => s.attachments);
  const clearAttachments = useAppStore((s) => s.clearAttachments);

  const handleSendMessage = useCallback(
    (prompt: string) => {
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
    },
    [activeSessionId, sessions, send, cwd, setPendingStart, attachments, clearAttachments]
  );

  const handleStopSession = useCallback(() => {
    if (!activeSessionId) return;
    send({ type: 'session.stop', payload: { sessionId: activeSessionId } });
  }, [activeSessionId, send]);

  const handlePermissionResponse = useCallback(
    (
      sessionId: string,
      toolUseId: string,
      result: PermissionResult,
      toolName?: string,
      input?: unknown,
      remember?: boolean
    ) => {
      send({
        type: 'permission.response',
        payload: {
          sessionId,
          toolUseId,
          result,
          toolName,
          input,
          remember,
          rememberBehavior: remember
            ? result.behavior === 'allow'
              ? 'always_allow'
              : 'always_deny'
            : undefined,
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
    const userMessages = activeSession.messages.filter((m) => m.type !== 'system');
    return userMessages.length === 0;
  }, [activeSession]);

  // Preview panel state
  const previewArtifact = useAppStore((s) => s.previewArtifact);
  const setPreviewArtifact = useAppStore((s) => s.setPreviewArtifact);
  const previewSessionId = previewArtifact?.sessionId ?? activeSessionId;
  const previewSessionArtifacts = previewSessionId
    ? (sessions[previewSessionId]?.artifacts ?? [])
    : [];
  const previewIndex = previewArtifact
    ? previewSessionArtifacts.findIndex((a) => a.id === previewArtifact.id)
    : -1;
  const hasPrevArtifact = previewIndex > 0;
  const hasNextArtifact = previewIndex >= 0 && previewIndex < previewSessionArtifacts.length - 1;

  return (
    <div className="app">
      <Sidebar
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        onSelectSession={handleSelectSession}
        onOpenArtifacts={handleOpenArtifacts}
        onOpenSettings={handleOpenSettings}
        onOpenSkills={handleOpenSkills}
      />

      <main className={`main-content ${previewArtifact ? 'with-preview' : ''}`}>
        <div
          className="titlebar-drag-region"
          data-tauri-drag-region="true"
          onMouseDown={(e) => e.stopPropagation()}
        />
        <div className="content-area">
          <div className="chat-area">
            {showSkills ? (
              <SkillsPage onClose={handleCloseSkills} onUseSkill={handleUseSkill} />
            ) : showWelcome ? (
              <WelcomeView onSend={handleSendMessage} onStop={handleStopSession} />
            ) : (
              <>
                <ChatPanel onPermissionResponse={handlePermissionResponse} />
                <ChatInputArea onSend={handleSendMessage} onStop={handleStopSession} />
              </>
            )}
          </div>
          {previewArtifact && (
            <div className="preview-area">
              <ArtifactPreview
                artifact={previewArtifact}
                onClose={() => setPreviewArtifact(null)}
                onPrev={() => {
                  if (!hasPrevArtifact) return;
                  const prev = previewSessionArtifacts[previewIndex - 1];
                  if (prev) setPreviewArtifact(prev);
                }}
                onNext={() => {
                  if (!hasNextArtifact) return;
                  const next = previewSessionArtifacts[previewIndex + 1];
                  if (next) setPreviewArtifact(next);
                }}
                onOpenList={() => setShowArtifacts(true)}
                hasPrev={hasPrevArtifact}
                hasNext={hasNextArtifact}
              />
            </div>
          )}
        </div>
      </main>

      {showArtifacts && (
        <>
          <div className="settings-overlay" onClick={() => setShowArtifacts(false)} />
          <ArtifactsPanel onClose={() => setShowArtifacts(false)} />
        </>
      )}

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
