import {
  ChangeEvent,
  forwardRef,
  KeyboardEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { useAppStore } from '../../store/useAppStore';
import type { Attachment } from '../../types';
import { AttachmentPreview } from './AttachmentPreview';
import { CommandMenu } from './CommandMenu';
import { getFilteredCommands, type Command } from './commands';
import { DropZone } from './DropZone';
import { MentionMenu } from './MentionMenu';
import { getFilteredMentions, type MentionItem } from './mentions';
import { ModelSelector } from './ModelSelector';
import { ModeSelector } from './ModeSelector';
import { RepoSelector } from './RepoSelector';
import { SendButton } from './SendButton';

import './ChatInputArea.css';

interface TriggerState {
  type: 'slash' | 'mention';
  query: string;
  startIndex: number;
}

interface ChatInputAreaProps {
  onSend: (prompt: string) => boolean | void;
  onStop: () => void;
  showRepoSelector?: boolean;
}

export interface ChatInputAreaRef {
  setInput: (value: string) => void;
  focus: () => void;
}

export const ChatInputArea = forwardRef<ChatInputAreaRef, ChatInputAreaProps>(
  function ChatInputArea({ onSend, onStop, showRepoSelector = false }, ref) {
    const [input, setInput] = useState('');
    const [trigger, setTrigger] = useState<TriggerState | null>(null);
    const [menuIndex, setMenuIndex] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const sessions = useAppStore((s) => s.sessions);
    const activeSessionId = useAppStore((s) => s.activeSessionId);
    const mode = useAppStore((s) => s.mode);
    const model = useAppStore((s) => s.model);
    const attachments = useAppStore((s) => s.attachments);
    const pendingInput = useAppStore((s) => s.pendingInput);
    const setPendingInput = useAppStore((s) => s.setPendingInput);
    const setMode = useAppStore((s) => s.setMode);
    const setModel = useAppStore((s) => s.setModel);
    const addAttachment = useAppStore((s) => s.addAttachment);
    const removeAttachment = useAppStore((s) => s.removeAttachment);
    const clearAttachments = useAppStore((s) => s.clearAttachments);

    const session = activeSessionId ? sessions[activeSessionId] : null;
    const isRunning = session?.status === 'running';
    const hasContent = input.trim().length > 0;
    // Allow input when no session (welcome page) or when session exists
    const canInput = !isRunning;

    // Pending skill state
    const pendingSkill = useAppStore((s) => s.pendingSkill);
    const setPendingSkill = useAppStore((s) => s.setPendingSkill);

    // Sync pending skill prompt to input
    useEffect(() => {
      if (!pendingSkill) return;
      const timer = setTimeout(() => {
        setInput(pendingSkill.prompt);
        textareaRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }, [pendingSkill]);

    // Restore pending input when switching to welcome page (no active session)
    // Use a ref to track if we've restored to avoid the ESLint warning
    const hasRestoredRef = useRef(false);
    useEffect(() => {
      if (!activeSessionId && pendingInput && !input && !hasRestoredRef.current) {
        hasRestoredRef.current = true;
        // Use setTimeout to avoid synchronous setState in effect
        setTimeout(() => {
          setInput(pendingInput);
          setPendingInput('');
        }, 0);
      }
      if (activeSessionId) {
        hasRestoredRef.current = false;
      }
    }, [activeSessionId, pendingInput, input, setPendingInput]);

    // Clear pending skill after sending
    const handleSubmit = useCallback(() => {
      const trimmed = input.trim();
      if (!trimmed || isRunning) return;

      const result = onSend(trimmed);
      // Only clear input if onSend succeeded (returned true or undefined)
      if (result !== false) {
        setInput('');
        clearAttachments();
        setPendingSkill(null);
        setPendingInput(''); // Clear saved input on successful send
      }
    }, [input, isRunning, onSend, clearAttachments, setPendingSkill, setPendingInput]);

    // Clear pending skill handler
    const handleClearSkill = useCallback(() => {
      setPendingSkill(null);
      setInput('');
      setPendingInput('');
      textareaRef.current?.focus();
    }, [setPendingSkill, setPendingInput]);

    // 暴露 setInput 和 focus 方法给父组件
    useImperativeHandle(
      ref,
      () => ({
        setInput: (value: string) => {
          setInput(value);
        },
        focus: () => {
          textareaRef.current?.focus();
        },
      }),
      []
    );

    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
      }
    }, [input]);

    const handleCommandSelect = useCallback(
      (command: Command) => {
        const currentTrigger = trigger;
        let promptToInsert: string | null = null;

        // Handle command execution
        switch (command.id) {
          // === 直接执行的命令 ===
          case 'new':
          case 'clear':
            setInput('');
            clearAttachments();
            break;
          case 'plan':
            setMode('plan');
            break;
          case 'agent':
            setMode('agent');
            break;
          case 'sonnet':
          case 'opus':
          case 'haiku':
            setModel(command.id);
            break;

          // === 快捷提示词 ===
          case 'commit':
            promptToInsert = 'Create a git commit for the current changes.';
            break;
          case 'test':
            promptToInsert = 'Run the tests.';
            break;
          case 'build':
            promptToInsert = 'Build the project.';
            break;
          case 'lint':
            promptToInsert = 'Run the linter and fix issues.';
            break;
          case 'fix':
            promptToInsert = 'Fix the following error:';
            break;
          case 'explain':
            promptToInsert = 'Explain this code:';
            break;
          case 'help':
            promptToInsert = 'What commands are available?';
            break;
        }

        // Replace the slash command text
        if (currentTrigger) {
          const before = input.slice(0, currentTrigger.startIndex);
          const after = input.slice(currentTrigger.startIndex + currentTrigger.query.length + 1);

          if (promptToInsert) {
            setInput(before + promptToInsert + ' ' + after);
          } else if (command.id === 'clear' || command.id === 'new') {
            setInput('');
          } else {
            setInput(before + after);
          }
        }

        setTrigger(null);
        textareaRef.current?.focus();
      },
      [setMode, setModel, input, trigger, clearAttachments]
    );

    const handleMentionSelect = useCallback(
      (item: MentionItem) => {
        // Insert the mention into the input
        const currentTrigger = trigger;
        if (currentTrigger) {
          const before = input.slice(0, currentTrigger.startIndex);
          const cursorPos = textareaRef.current?.selectionStart ?? input.length;
          const after = input.slice(cursorPos);
          const mentionText = `@${item.label} `;
          setInput(before + mentionText + after);
        }
        setTrigger(null);
        textareaRef.current?.focus();
      },
      [input, trigger]
    );

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        const currentTrigger = trigger;
        // Handle menu navigation when trigger is active
        if (currentTrigger) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setMenuIndex((prev) => prev + 1);
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setMenuIndex((prev) => Math.max(0, prev - 1));
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            setTrigger(null);
            return;
          }
          if (e.key === 'Tab' || e.key === 'Enter') {
            e.preventDefault();
            // Select the current item based on trigger type
            if (currentTrigger.type === 'slash') {
              const filtered = getFilteredCommands(currentTrigger.query);
              const safeIndex = Math.min(menuIndex, filtered.length - 1);
              if (filtered[safeIndex]) {
                handleCommandSelect(filtered[safeIndex]);
              }
            } else if (currentTrigger.type === 'mention') {
              const filtered = getFilteredMentions(currentTrigger.query);
              const safeIndex = Math.min(menuIndex, filtered.length - 1);
              if (filtered[safeIndex]) {
                handleMentionSelect(filtered[safeIndex]);
              }
            }
            return;
          }
        }

        if (e.key === 'Enter' && !e.shiftKey && !currentTrigger) {
          e.preventDefault();
          handleSubmit();
        }
      },
      [handleSubmit, trigger, menuIndex, handleCommandSelect, handleMentionSelect]
    );

    const handleInputChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setInput(value);

      const cursorPos = e.target.selectionStart ?? value.length;
      const textBeforeCursor = value.slice(0, cursorPos);

      // Check for slash command (must be at start or after whitespace)
      const slashMatch = textBeforeCursor.match(/(?:^|\s)(\/[\w]*)$/);
      if (slashMatch) {
        setTrigger({
          type: 'slash',
          query: slashMatch[1].slice(1),
          startIndex: cursorPos - slashMatch[1].length,
        });
        setMenuIndex(0);
        return;
      }

      // Check for @ mention
      const mentionMatch = textBeforeCursor.match(/@([\w/.]*)$/);
      if (mentionMatch) {
        setTrigger({
          type: 'mention',
          query: mentionMatch[1],
          startIndex: cursorPos - mentionMatch[0].length,
        });
        setMenuIndex(0);
        return;
      }

      setTrigger(null);
    }, []);

    const handleMenuClose = useCallback(() => {
      setTrigger(null);
    }, []);

    const handleFilesAdded = useCallback(
      (newAttachments: Attachment[]) => {
        newAttachments.forEach(addAttachment);
      },
      [addAttachment]
    );

    // Note: handleAttachClick is commented out until SDK supports images
    // const handleAttachClick = useCallback(() => {
    //   fileInputRef.current?.click();
    // }, []);

    const handleFileInputChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        files.forEach((file) => {
          const isImage = file.type.startsWith('image/');
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            addAttachment({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              type: isImage ? 'image' : 'file',
              name: file.name,
              content: base64,
              mimeType: file.type,
              size: file.size,
            });
          };
          reader.readAsDataURL(file);
        });

        e.target.value = '';
      },
      [addAttachment]
    );

    return (
      <DropZone onFilesAdded={handleFilesAdded} disabled={isRunning}>
        <div className="chat-input-area">
          {/* Attachment preview */}
          <AttachmentPreview attachments={attachments} onRemove={removeAttachment} />

          {/* Main input container */}
          <div className={`chat-input-container ${isRunning ? 'disabled' : ''}`}>
            {/* Skill tag */}
            {pendingSkill && (
              <div className="skill-tag">
                <span className="skill-tag-name">{pendingSkill.name}</span>
                <button className="skill-tag-close" onClick={handleClearSkill} title="Clear skill">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )}

            {/* Command and Mention menus */}
            {trigger?.type === 'slash' && (
              <CommandMenu
                query={trigger.query}
                onSelect={handleCommandSelect}
                onClose={handleMenuClose}
                selectedIndex={menuIndex}
              />
            )}
            {trigger?.type === 'mention' && (
              <MentionMenu
                query={trigger.query}
                onSelect={handleMentionSelect}
                onClose={handleMenuClose}
                selectedIndex={menuIndex}
              />
            )}

            <textarea
              ref={textareaRef}
              className="chat-textarea"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Plan, @ for context, / for commands"
              disabled={!canInput}
              rows={1}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="chat-toolbar">
            <div className="chat-toolbar-left">
              <ModeSelector value={mode} onChange={setMode} disabled={isRunning} />
              <ModelSelector value={model} onChange={setModel} disabled={isRunning} />
            </div>

            <div className="chat-toolbar-right">
              {/* Attach button - hidden until SDK supports images
            <button
              className="attach-button"
              onClick={handleAttachClick}
              disabled={isRunning}
              title="Attach files"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M15.5 9l-6.5 6.5a4.5 4.5 0 01-6.36-6.36l6.5-6.5a3 3 0 114.24 4.24l-6.5 6.5a1.5 1.5 0 01-2.12-2.12l6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            */}

              <SendButton
                mode={mode}
                isRunning={isRunning}
                disabled={!hasContent && attachments.length === 0}
                hasContent={hasContent || attachments.length > 0}
                onClick={handleSubmit}
                onStop={onStop}
              />
            </div>
          </div>

          {/* Repo selector - only show in welcome view */}
          {showRepoSelector && (
            <div className="chat-context-bar">
              <RepoSelector />
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.txt,.md,.json,.js,.ts,.tsx,.jsx,.py,.go,.rs,.c,.cpp,.h,.css,.html"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />
        </div>
      </DropZone>
    );
  }
);
