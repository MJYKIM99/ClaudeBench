import type { SessionMode } from '../../types';

interface SendButtonProps {
  mode: SessionMode;
  isRunning: boolean;
  disabled: boolean;
  hasContent: boolean;
  onClick: () => void;
  onStop: () => void;
}

export function SendButton({
  mode,
  isRunning,
  disabled,
  hasContent,
  onClick,
  onStop,
}: SendButtonProps) {
  if (isRunning) {
    return (
      <button
        className="send-button send-button--stop"
        onClick={onStop}
        title="Stop"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <rect x="2" y="2" width="10" height="10" rx="1" />
        </svg>
      </button>
    );
  }

  const modeClass = mode === 'plan' ? 'send-button--plan' : 'send-button--agent';
  const glowClass = hasContent && !disabled ? 'send-button--glow' : '';

  return (
    <button
      className={`send-button ${modeClass} ${glowClass}`}
      onClick={onClick}
      disabled={disabled}
      title="Send"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 2L8 14M8 2L3 7M8 2L13 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </button>
  );
}
