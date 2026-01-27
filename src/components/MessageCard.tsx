import { Component, ReactNode, useCallback, useState } from 'react';
import { Check, Copy, Eye } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useAppStore } from '../store/useAppStore';
import type {
  Artifact,
  AssistantMessage,
  MessageContent,
  ResultMessage,
  StreamMessage,
  SystemMessage,
  ToolResultContent,
  ToolUseContent,
  UserMessage,
} from '../types';
import { saveArtifact } from '../utils/fileUtils';
import { revealInFinder } from '../utils/pathUtils';
import { TextShimmer } from './tool-display';

import './MessageCard.css';

interface MessageCardProps {
  message: StreamMessage;
  isLast?: boolean;
  isRunning?: boolean;
  isSticky?: boolean;
}

// Status indicator dot
function StatusDot({
  variant = 'accent',
  isActive = false,
}: {
  variant?: 'accent' | 'success' | 'error';
  isActive?: boolean;
}) {
  const colorClass = variant === 'success' ? 'success' : variant === 'error' ? 'error' : 'accent';
  return <span className={`status-dot ${colorClass} ${isActive ? 'active' : ''}`} />;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getStringValue(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

// Get tool-specific info for display
function getToolInfo(tool: ToolUseContent): string | null {
  const input = tool.input;
  switch (tool.name) {
    case 'Bash':
      return getStringValue(input, 'command') ?? getStringValue(input, 'description');
    case 'Read':
    case 'Write':
    case 'Edit':
      return getStringValue(input, 'file_path');
    case 'Glob':
    case 'Grep':
      return getStringValue(input, 'pattern');
    case 'Task':
      return getStringValue(input, 'description');
    case 'WebFetch':
      return getStringValue(input, 'url');
    case 'WebSearch':
      return getStringValue(input, 'query');
    case 'TodoWrite': {
      const todos = input['todos'];
      const count = Array.isArray(todos) ? todos.length : 0;
      return `${count} items`;
    }
    case 'NotebookEdit':
      return getStringValue(input, 'notebook_path');
    case 'AskUserQuestion': {
      const questions = input['questions'];
      if (!Array.isArray(questions)) return '0 questions';

      const first = questions[0];
      if (isRecord(first)) {
        const question = first['question'];
        if (typeof question === 'string') return question;
      }
      return `${questions.length} questions`;
    }
    case 'EnterPlanMode':
    case 'ExitPlanMode':
      return null;
    case 'Skill':
      return getStringValue(input, 'skill');
    case 'KillShell':
      return getStringValue(input, 'shell_id');
    case 'TaskOutput':
      return getStringValue(input, 'task_id');
    default:
      return null;
  }
}

// Error boundary for individual message cards
class MessageErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="message-card error">
          <div className="message-badge">Error</div>
          <div className="message-content">
            <p>Failed to render message</p>
            <pre className="error-details">{this.state.error?.message}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function MessageCard({
  message,
  isLast = false,
  isRunning = false,
  isSticky = false,
}: MessageCardProps) {
  if (!message || typeof message !== 'object') {
    return null;
  }

  return (
    <MessageErrorBoundary>
      <MessageCardInner
        message={message}
        isLast={isLast}
        isRunning={isRunning}
        isSticky={isSticky}
      />
    </MessageErrorBoundary>
  );
}

function MessageCardInner({ message, isLast, isRunning, isSticky }: MessageCardProps) {
  const showIndicator = isLast && isRunning;

  switch (message.type) {
    case 'user_prompt':
      return (
        <UserPromptCard prompt={message.prompt} showIndicator={showIndicator} isSticky={isSticky} />
      );
    case 'system':
      return <SystemCard message={message} showIndicator={showIndicator} />;
    case 'assistant':
      return <AssistantCard message={message} showIndicator={showIndicator} />;
    case 'user':
      return <ToolResultCard message={message} />;
    case 'result':
      return <ResultCard message={message} />;
    default:
      return null;
  }
}

function UserPromptCard({
  prompt,
  showIndicator,
  isSticky,
}: {
  prompt: string;
  showIndicator?: boolean;
  isSticky?: boolean;
}) {
  const stickyClass = isSticky ? 'sticky' : '';
  return (
    <div className={`message-card user-prompt ${stickyClass}`}>
      <div className="message-header">
        {showIndicator && <StatusDot variant="success" isActive />}
        <span className="header-label">You</span>
      </div>
      <div className="message-body">
        <MarkdownBlock text={prompt || ''} />
      </div>
    </div>
  );
}

function SystemCard({
  message,
  showIndicator,
}: {
  message: SystemMessage;
  showIndicator?: boolean;
}) {
  return (
    <div className="message-card system-init">
      <div className="message-header">
        {showIndicator && <StatusDot variant="success" isActive />}
        <span className="header-label">System Init</span>
      </div>
      <div className="system-info">
        {message?.session_id && (
          <div className="info-row">
            <span className="info-label">Session ID</span>
            <span className="info-value">{message.session_id}</span>
          </div>
        )}
        {message?.model && (
          <div className="info-row">
            <span className="info-label">Model</span>
            <span className="info-value">{message.model}</span>
          </div>
        )}
        {message?.permissionMode && (
          <div className="info-row">
            <span className="info-label">Permission Mode</span>
            <span className="info-value">{message.permissionMode}</span>
          </div>
        )}
        {message?.cwd && (
          <div className="info-row">
            <span className="info-label">Working Directory</span>
            <span className="info-value mono">{message.cwd}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Extract previewable artifacts from tool_use blocks
function extractPreviewableArtifacts(content: MessageContent[]): Array<{
  title: string;
  type: Artifact['type'];
  language: string;
  content: string;
  filePath: string;
}> {
  const artifacts: Array<{
    title: string;
    type: Artifact['type'];
    language: string;
    content: string;
    filePath: string;
  }> = [];

  for (const block of content) {
    if (block.type === 'tool_use' && block.name === 'Write') {
      const filePath = getStringValue(block.input, 'file_path') ?? '';
      const fileContent = getStringValue(block.input, 'content') ?? '';

      if (!filePath || !fileContent) continue;

      const ext = filePath.split('.').pop()?.toLowerCase();
      let previewType: Artifact['type'] | null = null;

      // HTML files
      if (ext === 'html' || ext === 'htm') previewType = 'html';
      else if (ext === 'svg') previewType = 'html';
      // Mermaid diagrams
      else if (ext === 'mmd' || filePath.includes('mermaid')) previewType = 'mermaid';
      // Markdown files
      else if (ext === 'md' || ext === 'markdown') previewType = 'markdown';
      // CSV files
      else if (ext === 'csv') previewType = 'csv';
      // Image files (base64 data URLs or file paths)
      else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext || ''))
        previewType = 'image';
      // Check content for HTML
      else if (fileContent.trim().startsWith('<!DOCTYPE') || fileContent.trim().startsWith('<html'))
        previewType = 'html';

      if (previewType) {
        artifacts.push({
          title: filePath.split('/').pop() || filePath,
          type: previewType,
          language: ext || previewType,
          content: fileContent,
          filePath,
        });
      }
    }
  }

  return artifacts;
}

function AssistantCard({
  message,
  showIndicator,
}: {
  message: AssistantMessage;
  showIndicator?: boolean;
}) {
  const content = message.message?.content;
  if (!content || content.length === 0) return null;

  // Extract previewable artifacts for display at the end
  const previewableArtifacts = !showIndicator ? extractPreviewableArtifacts(content) : [];

  return (
    <>
      {content.map((block, index) => {
        const isLastContent = index === content.length - 1;
        const showDot = isLastContent && showIndicator;

        if (block.type === 'thinking') {
          return (
            <ThinkingBlock
              key={`thinking-${index}`}
              text={block.thinking || ''}
              showIndicator={showDot}
            />
          );
        }

        if (block.type === 'text') {
          return (
            <TextBlock key={`text-${index}`} text={block.text || ''} showIndicator={showDot} />
          );
        }

        if (block.type === 'tool_use') {
          return <ToolUseCard key={`tool-${index}`} tool={block} showIndicator={showDot} />;
        }

        return null;
      })}
      {previewableArtifacts.length > 0 && (
        <PreviewableArtifactsCard artifacts={previewableArtifacts} />
      )}
    </>
  );
}

function TextBlock({ text, showIndicator }: { text: string; showIndicator?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const sessions = useAppStore((s) => s.sessions);
  const cwd = activeSessionId ? sessions[activeSessionId]?.cwd : null;

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    },
    [text]
  );

  const handleSave = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!cwd) return;

      try {
        const filePath = await saveArtifact(cwd, text);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        revealInFinder(filePath);
      } catch (err) {
        console.error('Failed to save:', err);
      }
    },
    [text, cwd]
  );

  if (!text) return null;

  return (
    <div className={`message-card assistant-text ${showIndicator ? 'streaming' : ''}`}>
      <div className="message-header">
        {showIndicator && <StatusDot variant="success" isActive />}
        {showIndicator ? (
          <TextShimmer isActive={true}>
            <span className="header-label">Assistant</span>
          </TextShimmer>
        ) : (
          <span className="header-label">Assistant</span>
        )}
        <div className="message-actions">
          <button className="action-btn copy-btn" onClick={handleCopy} title="Copy message">
            {copied ? '✓' : '⎘'}
          </button>
          {cwd && (
            <button className="action-btn save-btn" onClick={handleSave} title="Save as Markdown">
              {saved ? '✓' : '↓'}
            </button>
          )}
        </div>
      </div>
      <div className="message-body">
        <MarkdownBlock text={text} />
        {showIndicator && <span className="streaming-cursor" />}
      </div>
      {showIndicator && <div className="running-indicator" />}
    </div>
  );
}

function MarkdownBlock({ text }: { text: string }) {
  const setPreviewArtifact = useAppStore((s) => s.setPreviewArtifact);
  const activeSessionId = useAppStore((s) => s.activeSessionId);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // 检测 Cmd+Click 在代码块或路径上
    if (e.metaKey) {
      const target = e.target as HTMLElement;
      const codeElement = target.closest('code');

      if (codeElement) {
        const content = codeElement.textContent || '';
        // 检查是否是路径
        if (content.match(/^(\/|~\/)[^\s]+$/)) {
          e.preventDefault();
          e.stopPropagation();
          revealInFinder(content);
        }
      }
    }
  }, []);

  const handlePreview = useCallback(
    (language: string, code: string) => {
      let type: Artifact['type'] = 'code';
      if (language === 'html' || language === 'svg') {
        type = 'html';
      } else if (language === 'mermaid') {
        type = 'mermaid';
      }
      setPreviewArtifact({
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}`,
        sessionId: activeSessionId || undefined,
        type,
        language,
        content: code,
        title: language ? `${language.toUpperCase()} Preview` : 'Code Preview',
        createdAt: Date.now(),
        source: 'user',
      });
    },
    [activeSessionId, setPreviewArtifact]
  );

  if (!text) return null;

  return (
    <div className="markdown-block" onClick={handleClick}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const code = String(children).replace(/\n$/, '');
            const isBlock = className?.includes('language-');
            const isPreviewable = ['html', 'svg', 'mermaid'].includes(language);

            if (isBlock) {
              return (
                <div className="code-block-wrapper">
                  <div className="code-block-header">
                    <span className="code-block-lang">{language || 'code'}</span>
                    <div className="code-block-actions">
                      {isPreviewable && (
                        <button
                          className="code-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(language, code);
                          }}
                          title="Preview"
                        >
                          <Eye size={14} />
                        </button>
                      )}
                      <CopyButton code={code} />
                    </div>
                  </div>
                  <pre className="code-block-content">
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                </div>
              );
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

// Previewable artifacts card - shown at end of assistant message
function PreviewableArtifactsCard({
  artifacts,
}: {
  artifacts: Array<{
    title: string;
    type: Artifact['type'];
    language: string;
    content: string;
    filePath: string;
  }>;
}) {
  const setPreviewArtifact = useAppStore((s) => s.setPreviewArtifact);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const sessionArtifacts = useAppStore((s) =>
    activeSessionId ? (s.sessions[activeSessionId]?.artifacts ?? []) : []
  );

  const handlePreview = useCallback(
    (artifact: {
      title: string;
      type: Artifact['type'];
      language: string;
      content: string;
      filePath: string;
    }) => {
      let existing: Artifact | undefined;
      if (activeSessionId) {
        for (let i = sessionArtifacts.length - 1; i >= 0; i--) {
          const candidate = sessionArtifacts[i];
          if (
            candidate.type === artifact.type &&
            candidate.meta?.['filePath'] === artifact.filePath
          ) {
            existing = candidate;
            break;
          }
        }
      }

      if (existing) {
        setPreviewArtifact(existing);
        return;
      }

      setPreviewArtifact({
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}`,
        sessionId: activeSessionId || undefined,
        type: artifact.type,
        language: artifact.language,
        content: artifact.content,
        title: artifact.title,
        createdAt: Date.now(),
        source: 'user',
        meta: { filePath: artifact.filePath },
      });
    },
    [activeSessionId, sessionArtifacts, setPreviewArtifact]
  );

  return (
    <div className="message-card preview-artifacts-card">
      <div className="preview-artifacts-header">
        <Eye size={14} />
        <span>Preview Available</span>
      </div>
      <div className="preview-artifacts-list">
        {artifacts.map((artifact, index) => (
          <button
            key={index}
            className="preview-artifact-item"
            onClick={() => handlePreview(artifact)}
          >
            <span className="preview-artifact-icon">
              {artifact.type === 'html' ? '🌐' : artifact.type === 'mermaid' ? '📊' : '📄'}
            </span>
            <span className="preview-artifact-title">{artifact.title}</span>
            <span className="preview-artifact-action">
              <Eye size={14} />
              Preview
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    },
    [code]
  );

  return (
    <button className="code-action-btn" onClick={handleCopy} title="Copy code">
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function ThinkingBlock({ text, showIndicator }: { text: string; showIndicator?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!text) return null;

  const preview = text.slice(0, 100);

  return (
    <div
      className={`message-card thinking-card ${showIndicator ? 'streaming' : ''}`}
      onClick={() => setIsOpen(!isOpen)}
    >
      <div className="thinking-header">
        {showIndicator && <StatusDot variant="success" isActive />}
        <span className="thinking-icon">{isOpen ? '▼' : '▶'}</span>
        {showIndicator ? (
          <TextShimmer isActive={true}>
            <span className="header-label">Thinking</span>
          </TextShimmer>
        ) : (
          <span className="header-label">Thinking</span>
        )}
        {!isOpen && <span className="thinking-preview">{preview}...</span>}
      </div>
      {isOpen && <pre className="thinking-content">{text}</pre>}
      {showIndicator && <div className="running-indicator" />}
    </div>
  );
}

function ToolUseCard({ tool, showIndicator }: { tool: ToolUseContent; showIndicator?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const toolInfo = getToolInfo(tool);

  // Determine tool status icon
  const statusIcon = showIndicator ? (
    <span className="tool-status-icon running">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
        <circle
          cx="6"
          cy="6"
          r="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="20"
          strokeDashoffset="5"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 6 6"
            to="360 6 6"
            dur="1s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
    </span>
  ) : (
    <span className="tool-status-icon completed">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
        <circle cx="6" cy="6" r="5" />
      </svg>
    </span>
  );

  return (
    <div
      className="message-card tool-use-card tool-use-compact"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="tool-header-compact">
        {statusIcon}
        {showIndicator ? (
          <TextShimmer isActive={true}>
            <span className="tool-name-compact">{tool.name}</span>
          </TextShimmer>
        ) : (
          <span className="tool-name-compact">{tool.name}</span>
        )}
        {toolInfo && (
          <>
            <span className="tool-separator">•</span>
            <span className="tool-info-compact">{toolInfo}</span>
          </>
        )}
        <span className="expand-icon-compact">{isExpanded ? '▼' : '▶'}</span>
      </div>
      {isExpanded && (
        <div className="tool-details">
          <pre className="tool-input">{JSON.stringify(tool.input, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function ToolResultCard({ message }: { message: UserMessage }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const results = message?.message?.content;

  if (!results || !Array.isArray(results) || results.length === 0) {
    return null;
  }

  const successCount = results.filter((r) => !r.is_error).length;
  const errorCount = results.filter((r) => r.is_error).length;
  const hasError = errorCount > 0;

  // Simple summary
  const statusText = hasError
    ? `${errorCount} error${errorCount > 1 ? 's' : ''}`
    : `${successCount} result${successCount > 1 ? 's' : ''}`;

  return (
    <div
      className={`message-card tool-result-card ${hasError ? 'has-error' : ''}`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="result-header">
        <StatusDot variant={hasError ? 'error' : 'success'} />
        <span className="result-summary">{statusText}</span>
        <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
      </div>
      {isExpanded && (
        <div className="result-details">
          {results.map((result: ToolResultContent, index: number) => {
            if (!result) return null;

            let content = '';
            try {
              content =
                typeof result.content === 'string'
                  ? result.content
                  : Array.isArray(result.content)
                    ? result.content.map((c) => c.text).join('\n')
                    : JSON.stringify(result.content);
            } catch {
              content = '[Unable to parse]';
            }

            const maxLen = 500;
            const truncated = content.length > maxLen;
            const displayContent = truncated ? content.slice(0, maxLen) + '...' : content;

            return (
              <div key={index} className={`result-item ${result.is_error ? 'error' : ''}`}>
                <pre>{displayContent}</pre>
                {truncated && <span className="truncate-note">({content.length} chars total)</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResultCard({ message }: { message: ResultMessage }) {
  const isSuccess = message?.subtype === 'success';
  const duration = message?.duration_ms ? (message.duration_ms / 1000).toFixed(1) : null;
  const cost = message?.total_cost_usd?.toFixed(4);
  const inputTokens = message?.usage?.input_tokens;
  const outputTokens = message?.usage?.output_tokens;

  const formatTokens = (tokens: number | undefined) => {
    if (typeof tokens !== 'number') return '-';
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
    return String(tokens);
  };

  // Compact inline format like 1Code
  return (
    <div className={`session-result-compact ${isSuccess ? 'success' : 'error'}`}>
      <span className="result-icon">{isSuccess ? '✓' : '✗'}</span>
      {duration && <span className="result-stat">{duration}s</span>}
      {cost && <span className="result-stat result-cost">${cost}</span>}
      {inputTokens && <span className="result-stat">{formatTokens(inputTokens)} in</span>}
      {outputTokens && <span className="result-stat">{formatTokens(outputTokens)} out</span>}
    </div>
  );
}
