// Session types
export type SessionStatus = 'idle' | 'running' | 'completed' | 'error';
export type SessionMode = 'agent' | 'plan';

export interface Attachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  content?: string; // base64
  mimeType?: string;
  size?: number;
}

export interface SessionInfo {
  id: string;
  title: string;
  status: SessionStatus;
  cwd?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface SessionView extends SessionInfo {
  messages: StreamMessage[];
  permissionRequests: PermissionRequest[];
  hydrated: boolean;
}

export interface PermissionRequest {
  toolUseId: string;
  toolName: string;
  input: unknown;
}

// Message types
export type StreamMessage =
  | UserPromptMessage
  | SDKMessage;

export interface UserPromptMessage {
  type: 'user_prompt';
  prompt: string;
}

// SDK Message types (simplified from @anthropic-ai/claude-agent-sdk)
export type SDKMessage =
  | SystemMessage
  | AssistantMessage
  | UserMessage
  | ResultMessage
  | StreamEventMessage;

export interface SystemMessage {
  type: 'system';
  subtype: 'init';
  session_id: string;
  model?: string;
  cwd?: string;
  permissionMode?: string;
}

export interface AssistantMessage {
  type: 'assistant';
  message: {
    content: MessageContent[];
  };
  _streaming?: boolean; // Internal flag for streaming state
}

export interface UserMessage {
  type: 'user';
  message: {
    content: ToolResultContent[];
  };
}

export interface ResultMessage {
  type: 'result';
  subtype: 'success' | 'error';
  session_id?: string;
  duration_ms?: number;
  duration_api_ms?: number;
  total_cost_usd?: number;
  num_turns?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export interface StreamEventMessage {
  type: 'stream_event';
  event: {
    type: string;
    delta?: {
      type: string;
      text?: string;
      partial_json?: string;
    };
    index?: number;
    content_block?: {
      type: string;
      text?: string;
    };
  };
  parent_tool_use_id: string | null;
}

// Content types
export type MessageContent =
  | TextContent
  | ThinkingContent
  | ToolUseContent;

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ThinkingContent {
  type: 'thinking';
  thinking: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<{ type: string; text: string }>;
  is_error?: boolean;
}

// Event types
export type ClientEvent =
  | { type: 'session.list' }
  | { type: 'session.start'; payload: { title: string; prompt: string; cwd?: string; allowedTools?: string; attachments?: Attachment[] } }
  | { type: 'session.continue'; payload: { sessionId: string; prompt: string; attachments?: Attachment[] } }
  | { type: 'session.stop'; payload: { sessionId: string } }
  | { type: 'session.delete'; payload: { sessionId: string } }
  | { type: 'session.history'; payload: { sessionId: string } }
  | { type: 'permission.response'; payload: { sessionId: string; toolUseId: string; result: PermissionResult; toolName?: string; input?: unknown; remember?: boolean; rememberBehavior?: 'always_allow' | 'always_deny' } }
  | { type: 'settings.get' }
  | { type: 'settings.update'; payload: { permissionMode?: PermissionMode; protectedPaths?: string[] } }
  | { type: 'settings.permission.clear' }
  | { type: 'skills.list'; payload?: { cwd?: string } }
  | { type: 'skills.install'; payload: { url: string } }
  | { type: 'skills.delete'; payload: { path: string } }
  | { type: 'skills.open'; payload: { path: string } }
  | { type: 'skills.openReferenceFolder'; payload?: { path?: string } }
  | { type: 'skills.installBundled' }
  | { type: 'env.check' };

export type ServerEvent =
  | { type: 'session.list'; payload: { sessions: SessionInfo[] } }
  | { type: 'session.status'; payload: { sessionId: string; status: SessionStatus; title?: string; cwd?: string } }
  | { type: 'session.history'; payload: { sessionId: string; messages: StreamMessage[]; status: SessionStatus } }
  | { type: 'session.deleted'; payload: { sessionId: string } }
  | { type: 'stream.message'; payload: { sessionId: string; message: SDKMessage } }
  | { type: 'stream.user_prompt'; payload: { sessionId: string; prompt: string } }
  | { type: 'permission.request'; payload: { sessionId: string; toolUseId: string; toolName: string; input: unknown; isProtectedPath?: boolean } }
  | { type: 'settings.loaded'; payload: { loaded: boolean; path: string | null; hasApiKey: boolean; model?: string } }
  | { type: 'settings.permission'; payload: PermissionSettings }
  | { type: 'skills.list'; payload: { skills: SkillInfo[] } }
  | { type: 'runner.error'; payload: { message: string } };

export interface ClaudeSettings {
  loaded: boolean;
  path: string | null;
  hasApiKey: boolean;
  model?: string;
}

// Permission types
export type PermissionMode = 'interactive' | 'auto-safe' | 'bypass';

export interface PermissionPolicy {
  id: number;
  tool_name: string;
  path_pattern: string | null;
  behavior: 'always_allow' | 'always_deny' | 'ask';
  created_at: number;
  updated_at: number;
}

export interface PermissionSettings {
  permissionMode: PermissionMode;
  protectedPaths: string[];
  policies: PermissionPolicy[];
}

export interface PermissionResult {
  behavior: 'allow' | 'deny';
  updatedInput?: unknown;
}

// Skill types
export type SkillCategory =
  | 'file-management'
  | 'content-creation'
  | 'productivity'
  | 'learning'
  | 'lifestyle'
  | 'development'
  | 'other';

export interface SkillInfo {
  name: string;
  description?: string;
  path: string;
  source: 'global' | 'project';
  category?: SkillCategory;
  icon?: string;
  tags?: string[];
  author?: string;
  version?: string;
  enabled?: boolean;
}

export const SKILL_CATEGORIES: Record<SkillCategory, { name: string; iconType: string; color: string }> = {
  'file-management': { name: 'Files', iconType: 'folder', color: '#3B82F6' },
  'content-creation': { name: 'Content', iconType: 'pen', color: '#8B5CF6' },
  'productivity': { name: 'Productivity', iconType: 'zap', color: '#F59E0B' },
  'learning': { name: 'Learning', iconType: 'book', color: '#10B981' },
  'lifestyle': { name: 'Lifestyle', iconType: 'home', color: '#EC4899' },
  'development': { name: 'Development', iconType: 'code', color: '#6366F1' },
  'other': { name: 'Other', iconType: 'tool', color: '#6B7280' },
};
