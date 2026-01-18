import { useState, useRef, useEffect } from 'react';

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

const MODELS = [
  { value: 'opus', label: 'Opus 4.5', icon: '✱' },
  { value: 'sonnet', label: 'Sonnet 4.5', icon: '✱' },
  { value: 'haiku', label: 'Haiku 4.5', icon: '✱' },
];

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
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

  const currentModel = MODELS.find((m) => m.value === value) || MODELS[0];

  return (
    <div className="selector-container" ref={containerRef}>
      <button
        className="selector-trigger selector-trigger--model"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className="selector-icon">{currentModel.icon}</span>
        <span className="selector-label">{currentModel.label}</span>
        <svg className="selector-chevron" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>

      {isOpen && (
        <div className="selector-dropdown">
          {MODELS.map((model) => (
            <button
              key={model.value}
              className={`selector-option ${model.value === value ? 'selected' : ''}`}
              onClick={() => {
                onChange(model.value);
                setIsOpen(false);
              }}
            >
              <span className="selector-icon">{model.icon}</span>
              {model.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
