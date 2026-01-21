import { Component, ReactNode, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TextShimmer } from './tool-display';
import { revealInFinder } from '../utils/pathUtils';
import { saveArtifact } from '../utils/fileUtils';
import { useAppStore } from '../store/useAppStore';
import type { StreamMessage, AssistantMessage, UserMessage, ResultMessage, SystemMessage, ToolUseContent, ToolResultContent } from '../types';
import './MessageCard.css';

interface MessageCardProps {
  message: StreamMessage;
  isLast?: boolean;
  isRunning?: boolean;
  isSticky?: boolean;
}

// Status indicator dot
function StatusDot({ variant = 'accent', isActive = false }: { variant?: 'accent' | 'success' | 'error'; isActive?: boolean }) {
  const colorClass = variant === 'success' ? 'success' : variant === 'error' ? 'error' : 'accent';
  return (
    <span className={`status-dot ${colorClass} ${isActive ? 'active' : ''}`} />
  );
}

// Get tool-specific info for display
function getToolInfo(tool: ToolUseContent): string | null {
  const input = tool.input as Record<string, any>;
  switch (tool.name) {
    case 'Bash':
      return input?.command || input?.description || null;
    case 'Read':
    case 'Write':
    case 'Edit':
      return input?.file_path || null;
    case 'Glob':
    case 'Grep':
      return input?.pattern || null;
    case 'Task':
      return input?.description || null;
    case 'WebFetch':
      return input?.url || null;
    case 'WebSearch':
      return input?.query || null;
    case 'TodoWrite':
      return `${(input?.todos as any[])?.length || 0} items`;
    case 'NotebookEdit':
      return input?.notebook_path || null;
    case 'AskUserQuestion':
      const questions = input?.questions as any[] || [];
      return questions[0]?.question || `${questions.length} questions`;
    case 'EnterPlanMode':
    case 'ExitPlanMode':
      return null;
    case 'Skill':
      return input?.skill || null;
    case 'KillShell':
      return input?.shell_id || null;
    case 'TaskOutput':
      return input?.task_id || null;
    default:
      return null;
  }
}

// Error boundary for individual message cards
class MessageErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: Error }> {
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

export function MessageCard({ message, isLast = false, isRunning = false, isSticky = false }: MessageCardProps) {
  if (!message || typeof message !== 'object') {
    return null;
  }

  return (
    <MessageErrorBoundary>
      <MessageCardInner message={message} isLast={isLast} isRunning={isRunning} isSticky={isSticky} />
    </MessageErrorBoundary>
  );
}

function MessageCardInner({ message, isLast, isRunning, isSticky }: MessageCardProps) {
  const type = (message as any).type;
  const showIndicator = isLast && isRunning;

  switch (type) {
    case 'user_prompt':
      return <UserPromptCard prompt={(message as any).prompt} showIndicator={showIndicator} isSticky={isSticky} />;
    case 'system':
      return <SystemCard message={message as SystemMessage} showIndicator={showIndicator} />;
    case 'assistant':
      return <AssistantCard message={message as AssistantMessage} showIndicator={showIndicator} />;
    case 'user':
      return <ToolResultCard message={message as UserMessage} />;
    case 'result':
      return <ResultCard message={message as ResultMessage} />;
    default:
      return null;
  }
}

function UserPromptCard({ prompt, showIndicator, isSticky }: { prompt: string; showIndicator?: boolean; isSticky?: boolean }) {
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

function SystemCard({ message, showIndicator }: { message: SystemMessage; showIndicator?: boolean }) {
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

function AssistantCard({ message, showIndicator }: { message: AssistantMessage; showIndicator?: boolean }) {
  const content = message?.message?.content;

  if (!content || !Array.isArray(content)) {
    return null;
  }

  return (
    <>
      {content.map((block: any, index: number) => {
        const isLastContent = index === content.length - 1;
        const showDot = isLastContent && showIndicator;

        if (block?.type === 'thinking') {
          return <ThinkingBlock key={`thinking-${index}`} text={block.thinking || ''} showIndicator={showDot} />;
        }

        if (block?.type === 'text') {
          return <TextBlock key={`text-${index}`} text={block.text || ''} showIndicator={showDot} />;
        }

        if (block?.type === 'tool_use') {
          return <ToolUseCard key={`tool-${index}`} tool={block} showIndicator={showDot} />;
        }

        return null;
      })}
    </>
  );
}

function TextBlock({ text, showIndicator }: { text: string; showIndicator?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const sessions = useAppStore((s) => s.sessions);
  const cwd = activeSessionId ? sessions[activeSessionId]?.cwd : null;

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [text]);

  const handleSave = useCallback(async (e: React.MouseEvent) => {
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
  }, [text, cwd]);

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
  if (!text) return null;

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

  return (
    <div className="markdown-block" onClick={handleClick}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

function ThinkingBlock({ text, showIndicator }: { text: string; showIndicator?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!text) return null;

  const preview = text.slice(0, 100);

  return (
    <div className={`message-card thinking-card ${showIndicator ? 'streaming' : ''}`} onClick={() => setIsOpen(!isOpen)}>
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
        <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="5">
          <animateTransform attributeName="transform" type="rotate" from="0 6 6" to="360 6 6" dur="1s" repeatCount="indefinite" />
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
    <div className="message-card tool-use-card tool-use-compact" onClick={() => setIsExpanded(!isExpanded)}>
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

  const successCount = results.filter((r: any) => !r?.is_error).length;
  const errorCount = results.filter((r: any) => r?.is_error).length;
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
              content = typeof result.content === 'string'
                ? result.content
                : Array.isArray(result.content)
                  ? result.content.map((c: any) => c?.text || '').join('\n')
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
