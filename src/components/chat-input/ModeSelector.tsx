import { useEffect, useRef, useState } from 'react';

import type { SessionMode } from '../../types';

interface ModeSelectorProps {
  value: SessionMode;
  onChange: (mode: SessionMode) => void;
  disabled?: boolean;
}

const MODES: { value: SessionMode; label: string; icon: string }[] = [
  { value: 'agent', label: 'Agent', icon: '∞' },
  { value: 'plan', label: 'Plan', icon: '◇' },
];

export function ModeSelector({ value, onChange, disabled }: ModeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentMode = MODES.find((m) => m.value === value) || MODES[0];

  return (
    <div className="selector-container" ref={containerRef}>
      <button
        className={`selector-trigger selector-trigger--${value}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className="selector-icon">{currentMode.icon}</span>
        <span className="selector-label">{currentMode.label}</span>
        <svg
          className="selector-chevron"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="currentColor"
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="selector-dropdown">
          {MODES.map((mode) => (
            <button
              key={mode.value}
              className={`selector-option ${mode.value === value ? 'selected' : ''}`}
              onClick={() => {
                onChange(mode.value);
                setIsOpen(false);
              }}
            >
              <span className="selector-icon">{mode.icon}</span>
              {mode.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
