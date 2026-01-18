import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import './StartSessionModal.css';

interface StartSessionModalProps {
  onClose: () => void;
  onStart: (title: string, prompt: string, cwd: string) => void;
}

export function StartSessionModal({ onClose, onStart }: StartSessionModalProps) {
  const [cwd, setCwd] = useState('');
  const [prompt, setPrompt] = useState('');

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Working Directory',
      });
      if (selected && typeof selected === 'string') {
        setCwd(selected);
      }
    } catch (e) {
      console.error('Failed to open folder dialog:', e);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cwd.trim() || !prompt.trim()) return;

    const title = prompt.slice(0, 50);
    onStart(title, prompt.trim(), cwd.trim());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Session</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Working Directory</label>
            <div className="folder-input">
              <input
                type="text"
                value={cwd}
                onChange={(e) => setCwd(e.target.value)}
                placeholder="/path/to/project"
              />
              <button type="button" onClick={handleSelectFolder}>
                Browse
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Initial Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What would you like to do?"
              rows={4}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!cwd.trim() || !prompt.trim()}
            >
              Start Session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
