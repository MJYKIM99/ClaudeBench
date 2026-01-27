import { useEffect, useRef, useState } from 'react';

import { ChatInputArea, ChatInputAreaRef } from './chat-input';
import { SkillShortcuts } from './SkillShortcuts';

import './WelcomeView.css';

interface WelcomeViewProps {
  onSend: (prompt: string) => void;
  onStop: () => void;
}

const TYPING_PROMPTS = [
  'Build a REST API with authentication',
  'Organize my messy Downloads folder',
  'Convert images to WebP and compress them',
  'Create a landing page for my startup',
  'Research the latest AI trends for me',
];

export function WelcomeView({ onSend, onStop }: WelcomeViewProps) {
  const [promptIndex, setPromptIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const chatInputRef = useRef<ChatInputAreaRef>(null);

  useEffect(() => {
    const currentPrompt = TYPING_PROMPTS[promptIndex];

    let delay = 80;
    if (isPaused) delay = 2000;
    else if (isDeleting) delay = displayText === '' ? 0 : 30;
    else if (displayText === currentPrompt) delay = 0;

    const timer = setTimeout(() => {
      if (isPaused) {
        setIsPaused(false);
        setIsDeleting(true);
        return;
      }

      if (isDeleting) {
        if (displayText === '') {
          setIsDeleting(false);
          setPromptIndex((prev) => (prev + 1) % TYPING_PROMPTS.length);
          return;
        }
        setDisplayText((prev) => prev.slice(0, -1));
        return;
      }

      if (displayText === currentPrompt) {
        setIsPaused(true);
        return;
      }

      setDisplayText(currentPrompt.slice(0, displayText.length + 1));
    }, delay);

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, isPaused, promptIndex]);

  return (
    <div className="welcome-view">
      <div className="welcome-content">
        <div className="welcome-header">
          <h1 className="welcome-title">What do you want to get done?</h1>
          <div className="welcome-subtitle">
            <span className="typing-text">{displayText}</span>
            <span className="typing-cursor">|</span>
          </div>
        </div>
        <div className="welcome-input-wrapper">
          <ChatInputArea
            ref={chatInputRef}
            onSend={onSend}
            onStop={onStop}
            showRepoSelector={true}
          />
          <SkillShortcuts />
        </div>
      </div>
    </div>
  );
}
