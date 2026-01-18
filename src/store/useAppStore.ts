import { create } from 'zustand';
import type { ServerEvent, SessionView, ClaudeSettings, SessionMode, Attachment, PermissionSettings } from '../types';

interface AppState {
  sessions: Record<string, SessionView>;
  activeSessionId: string | null;
  prompt: string;
  cwd: string;
  pendingStart: boolean;
  globalError: string | null;
  sessionsLoaded: boolean;
  showStartModal: boolean;
  historyRequested: Set<string>;
  claudeSettings: ClaudeSettings | null;
  permissionSettings: PermissionSettings | null;

  // New UX state
  mode: SessionMode;
  model: string;
  attachments: Attachment[];

  setPrompt: (prompt: string) => void;
  setCwd: (cwd: string) => void;
  setPendingStart: (pending: boolean) => void;
  setGlobalError: (error: string | null) => void;
  setShowStartModal: (show: boolean) => void;
  setActiveSessionId: (id: string | null) => void;
  markHistoryRequested: (sessionId: string) => void;
  resolvePermissionRequest: (sessionId: string, toolUseId: string) => void;
  handleServerEvent: (event: ServerEvent) => void;

  // New UX actions
  setMode: (mode: SessionMode) => void;
  setModel: (model: string) => void;
  addAttachment: (attachment: Attachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
}

function createSession(id: string): SessionView {
  return {
    id,
    title: '',
    status: 'idle',
    messages: [],
    permissionRequests: [],
    hydrated: false,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  sessions: {},
  activeSessionId: null,
  prompt: '',
  cwd: '',
  pendingStart: false,
  globalError: null,
  sessionsLoaded: false,
  showStartModal: false,
  historyRequested: new Set(),
  claudeSettings: null,
  permissionSettings: null,

  // New UX state
  mode: 'agent',
  model: 'sonnet',
  attachments: [],

  setPrompt: (prompt) => set({ prompt }),
  setCwd: (cwd) => set({ cwd }),
  setPendingStart: (pendingStart) => set({ pendingStart }),
  setGlobalError: (globalError) => set({ globalError }),
  setShowStartModal: (showStartModal) => set({ showStartModal }),
  setActiveSessionId: (id) => set({ activeSessionId: id }),

  // New UX actions
  setMode: (mode) => set({ mode }),
  setModel: (model) => set({ model }),
  addAttachment: (attachment) =>
    set((state) => ({ attachments: [...state.attachments, attachment] })),
  removeAttachment: (id) =>
    set((state) => ({ attachments: state.attachments.filter((a) => a.id !== id) })),
  clearAttachments: () => set({ attachments: [] }),

  markHistoryRequested: (sessionId) => {
    set((state) => {
      const next = new Set(state.historyRequested);
      next.add(sessionId);
      return { historyRequested: next };
    });
  },

  resolvePermissionRequest: (sessionId, toolUseId) => {
    set((state) => {
      const existing = state.sessions[sessionId];
      if (!existing) return {};
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...existing,
            permissionRequests: existing.permissionRequests.filter(
              (req) => req.toolUseId !== toolUseId
            ),
          },
        },
      };
    });
  },

  handleServerEvent: (event) => {
    const state = get();

    switch (event.type) {
      case 'session.list': {
        const nextSessions: Record<string, SessionView> = {};
        for (const session of event.payload.sessions) {
          const existing = state.sessions[session.id] ?? createSession(session.id);
          nextSessions[session.id] = {
            ...existing,
            status: session.status,
            title: session.title,
            cwd: session.cwd,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
          };
        }

        set({ sessions: nextSessions, sessionsLoaded: true });

        const hasSessions = event.payload.sessions.length > 0;
        set({ showStartModal: !hasSessions });

        if (!hasSessions) {
          get().setActiveSessionId(null);
        }

        if (!state.activeSessionId && event.payload.sessions.length > 0) {
          const sorted = [...event.payload.sessions].sort((a, b) => {
            const aTime = a.updatedAt ?? a.createdAt ?? 0;
            const bTime = b.updatedAt ?? b.createdAt ?? 0;
            return bTime - aTime;
          });
          const latestSession = sorted[0];
          if (latestSession) {
            get().setActiveSessionId(latestSession.id);
          }
        }
        break;
      }

      case 'session.history': {
        const { sessionId, messages, status } = event.payload;
        set((state) => {
          const existing = state.sessions[sessionId] ?? createSession(sessionId);
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: { ...existing, status, messages, hydrated: true },
            },
          };
        });
        break;
      }

      case 'session.status': {
        const { sessionId, status, title, cwd } = event.payload;
        set((state) => {
          const existing = state.sessions[sessionId] ?? createSession(sessionId);
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...existing,
                status,
                title: title ?? existing.title,
                cwd: cwd ?? existing.cwd,
                updatedAt: Date.now(),
              },
            },
          };
        });

        if (state.pendingStart) {
          get().setActiveSessionId(sessionId);
          set({ pendingStart: false, showStartModal: false });
        }
        break;
      }

      case 'session.deleted': {
        const { sessionId } = event.payload;
        const currentState = get();
        if (!currentState.sessions[sessionId]) break;

        const nextSessions = { ...currentState.sessions };
        delete nextSessions[sessionId];
        set({
          sessions: nextSessions,
          showStartModal: Object.keys(nextSessions).length === 0,
        });

        if (currentState.activeSessionId === sessionId) {
          const remaining = Object.values(nextSessions).sort(
            (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
          );
          get().setActiveSessionId(remaining[0]?.id ?? null);
        }
        break;
      }

      case 'stream.message': {
        const { sessionId, message } = event.payload;
        const msgType = (message as any)?.type;

        // Handle stream_event messages - merge text deltas into last assistant message
        if (msgType === 'stream_event') {
          const streamEvent = message as any;
          const delta = streamEvent?.event?.delta;

          // Only process text deltas
          if (delta?.type === 'text_delta' && delta?.text) {
            set((state) => {
              const existing = state.sessions[sessionId] ?? createSession(sessionId);
              const messages = [...existing.messages];
              const lastMsg = messages[messages.length - 1] as any;

              // If last message is assistant (streaming), append to its last text content
              if (lastMsg?.type === 'assistant' && lastMsg?._streaming && Array.isArray(lastMsg?.message?.content)) {
                const content = lastMsg.message.content;
                const lastContent = content[content.length - 1];

                if (lastContent?.type === 'text') {
                  // Append to existing text
                  lastContent.text = (lastContent.text || '') + delta.text;
                } else {
                  // Add new text block
                  content.push({ type: 'text', text: delta.text });
                }

                messages[messages.length - 1] = { ...lastMsg };
              } else {
                // Create new streaming assistant message with text
                messages.push({
                  type: 'assistant',
                  _streaming: true, // Mark as streaming
                  message: {
                    content: [{ type: 'text', text: delta.text }],
                  },
                });
              }

              return {
                sessions: {
                  ...state.sessions,
                  [sessionId]: { ...existing, messages },
                },
              };
            });
          }
          // Ignore other stream events (content_block_start, etc.)
          break;
        }

        // For complete assistant messages, replace the streaming message
        if (msgType === 'assistant') {
          set((state) => {
            const existing = state.sessions[sessionId] ?? createSession(sessionId);
            const messages = [...existing.messages];
            const lastMsg = messages[messages.length - 1] as any;

            // If last message was streaming, replace it with the complete message
            if (lastMsg?.type === 'assistant' && lastMsg?._streaming) {
              messages[messages.length - 1] = message;
            } else {
              messages.push(message);
            }

            return {
              sessions: {
                ...state.sessions,
                [sessionId]: { ...existing, messages },
              },
            };
          });
          break;
        }

        // Other messages - just append
        set((state) => {
          const existing = state.sessions[sessionId] ?? createSession(sessionId);
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...existing,
                messages: [...existing.messages, message],
              },
            },
          };
        });
        break;
      }

      case 'stream.user_prompt': {
        const { sessionId, prompt } = event.payload;
        set((state) => {
          const existing = state.sessions[sessionId] ?? createSession(sessionId);
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...existing,
                messages: [...existing.messages, { type: 'user_prompt', prompt }],
              },
            },
          };
        });
        break;
      }

      case 'permission.request': {
        const { sessionId, toolUseId, toolName, input } = event.payload;
        set((state) => {
          const existing = state.sessions[sessionId] ?? createSession(sessionId);
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...existing,
                permissionRequests: [
                  ...existing.permissionRequests,
                  { toolUseId, toolName, input },
                ],
              },
            },
          };
        });
        break;
      }

      case 'settings.loaded': {
        set({
          claudeSettings: {
            loaded: event.payload.loaded,
            path: event.payload.path,
            hasApiKey: event.payload.hasApiKey,
            model: event.payload.model,
          },
        });
        break;
      }

      case 'settings.permission': {
        set({
          permissionSettings: event.payload,
        });
        break;
      }

      case 'runner.error': {
        set({ globalError: event.payload.message });
        break;
      }
    }
  },
}));
