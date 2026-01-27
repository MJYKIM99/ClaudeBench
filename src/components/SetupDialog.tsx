import { useState } from 'react';

import './SetupDialog.css';

interface SetupDialogProps {
  hasClaudeCode: boolean;
  missingSkills: string[];
  onInstallSkills: () => void;
  onDismiss: () => void;
}

export function SetupDialog({
  hasClaudeCode,
  missingSkills,
  onInstallSkills,
  onDismiss,
}: SetupDialogProps) {
  const [installing, setInstalling] = useState(false);

  const handleInstall = () => {
    setInstalling(true);
    onInstallSkills();
  };

  // If no Claude Code, show dependency required message
  if (!hasClaudeCode) {
    return (
      <div className="setup-overlay">
        <div className="setup-dialog">
          <div className="setup-icon warning">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
          </div>
          <h2>Claude Code Required</h2>
          <p className="setup-description">
            This app requires Claude Code CLI to be installed. Please install it first and restart
            the app.
          </p>
          <div className="setup-instructions">
            <p>Install Claude Code:</p>
            <code>npm install -g @anthropic-ai/claude-code</code>
            <p className="setup-hint">
              Or visit{' '}
              <a
                href="https://docs.anthropic.com/claude-code"
                target="_blank"
                rel="noopener noreferrer"
              >
                docs.anthropic.com/claude-code
              </a>{' '}
              for more options.
            </p>
          </div>
          <div className="setup-actions">
            <button className="setup-btn secondary" onClick={onDismiss}>
              Continue Anyway
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If missing skills, offer to install them
  if (missingSkills.length > 0) {
    return (
      <div className="setup-overlay">
        <div className="setup-dialog">
          <div className="setup-icon success">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h2>Welcome to Claude Bench!</h2>
          <p className="setup-description">
            We've prepared {missingSkills.length} useful skills for you. Would you like to install
            them now?
          </p>
          <div className="setup-skills-list">
            {missingSkills.map((skill) => (
              <div key={skill} className="setup-skill-item">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                <span>{formatSkillName(skill)}</span>
              </div>
            ))}
          </div>
          <div className="setup-actions">
            <button className="setup-btn primary" onClick={handleInstall} disabled={installing}>
              {installing ? 'Installing...' : 'Install Skills'}
            </button>
            <button className="setup-btn secondary" onClick={onDismiss}>
              Skip for Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function formatSkillName(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
