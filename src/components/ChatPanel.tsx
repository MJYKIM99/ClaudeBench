import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileCode, Folder, Info, MessageSquare } from 'lucide-react';

import { useAppStore } from '../store/useAppStore';
import type { PermissionResult, StreamMessage, SystemMessage } from '../types';
import { revealInFinder } from '../utils/pathUtils';
import { DecisionPanel } from './DecisionPanel';
import { MessageCard } from './MessageCard';

import './ChatPanel.css';

interface ChatPanelProps {
  onPermissionResponse?: (
    sessionId: string,
    toolUseId: string,
    result: PermissionResult,
    toolName?: string,
    input?: unknown,
    remember?: boolean
  ) => void;
  onOpenArtifacts?: () => void;
}

interface MessageGroup {
  userPrompt: StreamMessage;
  responses: StreamMessage[];
}

function groupMessages(messages: StreamMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  for (const message of messages) {
    if (message.type === 'user_prompt') {
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = { userPrompt: message, responses: [] };
    } else if (currentGroup) {
      currentGroup.responses.push(message);
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

export function ChatPanel({ onPermissionResponse, onOpenArtifacts }: ChatPanelProps) {
  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const resolvePermissionRequest = useAppStore((s) => s.resolvePermissionRequest);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showInfo, setShowInfo] = useState(false);

  const session = activeSessionId ? sessions[activeSessionId] : null;
  const messages = session?.messages;
  const artifacts = session?.artifacts ?? [];
  const artifactCount = artifacts.length;

  // Extract system info from messages
  const systemInfo = useMemo(() => {
    if (!messages) return null;
    const systemMsg = messages.find((m): m is SystemMessage => m.type === 'system');
    return systemMsg || null;
  }, [messages]);

  // Filter out system messages for display
  const displayMessages = useMemo(() => {
    if (!messages) return [];
    return messages.filter((m) => m.type !== 'system');
  }, [messages]);

  // Group messages by user prompt
  const messageGroups = useMemo(() => {
    return groupMessages(displayMessages);
  }, [displayMessages]);

  // Get pending permission requests
  const permissionRequests = session?.permissionRequests || [];

  // Smart auto-scroll: only scroll to bottom if user is near the bottom
  const isNearBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      // Consider "near bottom" if within 100px of the bottom
      isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current && isNearBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, permissionRequests.length]);

  const handlePermissionSubmit = useCallback(
    (
      toolUseId: string,
      result: PermissionResult,
      toolName?: string,
      input?: unknown,
      remember?: boolean
    ) => {
      if (!activeSessionId) return;

      // Remove from local state
      resolvePermissionRequest(activeSessionId, toolUseId);

      // Send to sidecar
      if (onPermissionResponse) {
        onPermissionResponse(activeSessionId, toolUseId, result, toolName, input, remember);
      }
    },
    [activeSessionId, resolvePermissionRequest, onPermissionResponse]
  );

  if (!session) {
    return (
      <div className="chat-panel">
        <div className="chat-empty">
          <div className="chat-empty-icon">
            <MessageSquare size={48} strokeWidth={1.5} />
          </div>
          <h3>No Session Selected</h3>
          <p>Create a new session or select one from the sidebar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-header" data-tauri-drag-region="true">
        <div className="chat-header-left" data-tauri-drag-region="true">
          <h2 className="chat-title" data-tauri-drag-region="true">
            {session.title || 'Untitled Session'}
          </h2>
          {session.cwd && (
            <span
              className="chat-cwd clickable"
              title={`${session.cwd} (Click to open in Finder)`}
              onClick={() => revealInFinder(session.cwd!)}
            >
              <Folder size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              {session.cwd}
            </span>
          )}
        </div>
        <div className="chat-header-right">
          {artifactCount > 0 && onOpenArtifacts && (
            <button
              className="info-btn artifacts-btn"
              onClick={onOpenArtifacts}
              title={`${artifactCount} artifact${artifactCount > 1 ? 's' : ''}`}
            >
              <FileCode size={14} />
              <span className="artifacts-count">{artifactCount}</span>
            </button>
          )}
          {session.status === 'running' && <span className="status-badge running">Running</span>}
          {systemInfo && (
            <button
              className="info-btn"
              onClick={() => setShowInfo(!showInfo)}
              title="Session Info"
            >
              <Info size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Session Info Popup */}
      {showInfo && systemInfo && (
        <div className="session-info-popup">
          <div className="info-popup-header">
            <span>Session Info</span>
            <button onClick={() => setShowInfo(false)}>×</button>
          </div>
          <div className="info-popup-content">
            {systemInfo.session_id && (
              <div className="info-row">
                <span className="info-label">Session ID</span>
                <span className="info-value mono">{systemInfo.session_id}</span>
              </div>
            )}
            {systemInfo.model && (
              <div className="info-row">
                <span className="info-label">Model</span>
                <span className="info-value">{systemInfo.model}</span>
              </div>
            )}
            {systemInfo.permissionMode && (
              <div className="info-row">
                <span className="info-label">Permission</span>
                <span className="info-value">{systemInfo.permissionMode}</span>
              </div>
            )}
            {systemInfo.cwd && (
              <div className="info-row">
                <span className="info-label">Directory</span>
                <span className="info-value mono">{systemInfo.cwd}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="chat-messages" ref={scrollRef} onScroll={handleScroll}>
        {displayMessages.length === 0 && permissionRequests.length === 0 ? (
          <div className="chat-start">
            <p>Start a conversation...</p>
          </div>
        ) : (
          <>
            {messageGroups.map((group, groupIndex) => {
              const isLastGroup = groupIndex === messageGroups.length - 1;
              const allResponses = group.responses;
              const isWaitingForResponse =
                isLastGroup && allResponses.length === 0 && session.status === 'running';

              return (
                <div key={groupIndex} className="message-group">
                  <MessageCard
                    message={group.userPrompt}
                    isLast={false}
                    isRunning={session.status === 'running'}
                    isSticky={true}
                  />
                  {allResponses.map((message, responseIndex) => {
                    const isLastMessage =
                      isLastGroup &&
                      responseIndex === allResponses.length - 1 &&
                      permissionRequests.length === 0;
                    return (
                      <MessageCard
                        key={responseIndex}
                        message={message}
                        isLast={isLastMessage}
                        isRunning={session.status === 'running'}
                      />
                    );
                  })}
                  {isWaitingForResponse && (
                    <div className="agent-loading">
                      <div className="loading-indicator">
                        <span className="loading-dot"></span>
                        <span className="loading-dot"></span>
                        <span className="loading-dot"></span>
                      </div>
                      <span className="loading-text">Agent is thinking...</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Permission requests at the end */}
            {permissionRequests.map((request) => (
              <DecisionPanel
                key={request.toolUseId}
                request={request}
                onSubmit={(result, remember) =>
                  handlePermissionSubmit(
                    request.toolUseId,
                    result,
                    request.toolName,
                    request.input,
                    remember
                  )
                }
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
