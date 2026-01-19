import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { MessageCard } from './MessageCard';
import { DecisionPanel } from './DecisionPanel';
import { revealInFinder } from '../utils/pathUtils';
import type { SystemMessage, PermissionResult, StreamMessage } from '../types';
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
}

interface MessageGroup {
  userPrompt: StreamMessage;
  responses: StreamMessage[];
}

function groupMessages(messages: StreamMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  for (const message of messages) {
    if ((message as any).type === 'user_prompt') {
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

export function ChatPanel({ onPermissionResponse }: ChatPanelProps) {
  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const resolvePermissionRequest = useAppStore((s) => s.resolvePermissionRequest);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showInfo, setShowInfo] = useState(false);

  const session = activeSessionId ? sessions[activeSessionId] : null;

  // Extract system info from messages
  const systemInfo = useMemo(() => {
    if (!session?.messages) return null;
    const systemMsg = session.messages.find(
      (m): m is SystemMessage => (m as any).type === 'system'
    );
    return systemMsg || null;
  }, [session?.messages]);

  // Filter out system messages for display
  const displayMessages = useMemo(() => {
    if (!session?.messages) return [];
    return session.messages.filter((m) => (m as any).type !== 'system');
  }, [session?.messages]);

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
  }, [session?.messages, permissionRequests.length]);

  const handlePermissionSubmit = useCallback(
    (toolUseId: string, result: PermissionResult, toolName?: string, input?: unknown, remember?: boolean) => {
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
          <div className="chat-empty-icon">💬</div>
          <h3>No Session Selected</h3>
          <p>Create a new session or select one from the sidebar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-left">
          <h2 className="chat-title">{session.title || 'Untitled Session'}</h2>
          {session.cwd && (
            <span
              className="chat-cwd clickable"
              title={`${session.cwd} (Click to open in Finder)`}
              onClick={() => revealInFinder(session.cwd!)}
            >
              📁 {session.cwd}
            </span>
          )}
        </div>
        <div className="chat-header-right">
          {session.status === 'running' && (
            <span className="status-badge running">Running</span>
          )}
          {systemInfo && (
            <button
              className="info-btn"
              onClick={() => setShowInfo(!showInfo)}
              title="Session Info"
            >
              ⓘ
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

              return (
                <div key={groupIndex} className="message-group">
                  <MessageCard
                    message={group.userPrompt}
                    isLast={false}
                    isRunning={session.status === 'running'}
                    isSticky={true}
                  />
                  {allResponses.map((message, responseIndex) => {
                    const isLastMessage = isLastGroup &&
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
                </div>
              );
            })}

            {/* Permission requests at the end */}
            {permissionRequests.map((request) => (
              <DecisionPanel
                key={request.toolUseId}
                request={request}
                onSubmit={(result, remember) => handlePermissionSubmit(
                  request.toolUseId,
                  result,
                  request.toolName,
                  request.input,
                  remember
                )}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
