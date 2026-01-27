import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileText, Loader2, Sparkles, X } from 'lucide-react';

import './GitCommitDialog.css';

interface GitCommitDialogProps {
  open: boolean;
  onClose: () => void;
  cwd: string;
  changedFiles: { path: string; status: string; type: 'staged' | 'unstaged' | 'untracked' }[];
  onCommitSuccess: () => void;
}

export function GitCommitDialog({
  open,
  onClose,
  cwd,
  changedFiles,
  onCommitSuccess,
}: GitCommitDialogProps) {
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateMessage = useCallback(() => {
    if (changedFiles.length === 0) {
      setError('No changes to commit');
      return;
    }

    setGenerating(true);
    setError(null);

    setTimeout(() => {
      const types = changedFiles.map((f) => f.status);
      const paths = changedFiles.map((f) => f.path);

      const hasNew = types.includes('?') || types.includes('A');
      const hasModified = types.includes('M');
      const hasDeleted = types.includes('D');

      let prefix = 'chore';
      if (hasNew && !hasModified && !hasDeleted) prefix = 'feat';
      else if (hasModified && !hasNew) prefix = 'fix';
      else if (hasDeleted && !hasNew && !hasModified) prefix = 'chore';

      const commonDir = paths.length > 0 ? paths[0].split('/')[0] : '';
      const fileTypes = [...new Set(paths.map((p) => p.split('.').pop()))];

      let description = '';
      if (changedFiles.length === 1) {
        description = `update ${paths[0]}`;
      } else if (commonDir && paths.every((p) => p.startsWith(commonDir + '/'))) {
        description = `update ${commonDir} (${changedFiles.length} files)`;
      } else if (fileTypes.length === 1) {
        description = `update ${changedFiles.length} ${fileTypes[0]} file(s)`;
      } else {
        description = `update ${changedFiles.length} file(s)`;
      }

      setMessage(`${prefix}: ${description}`);
      setGenerating(false);
    }, 300);
  }, [changedFiles]);

  const handleCommit = async () => {
    if (!message.trim()) {
      setError('Please enter a commit message');
      return;
    }

    setCommitting(true);
    setError(null);

    try {
      await invoke('git_add_all', { cwd });
      await invoke('git_commit', { cwd, message: message.trim() });
      onCommitSuccess();
      onClose();
      setMessage('');
    } catch (e) {
      setError(String(e));
    } finally {
      setCommitting(false);
    }
  };

  const handleClose = () => {
    if (!committing) {
      onClose();
      setMessage('');
      setError(null);
    }
  };

  if (!open) return null;

  return (
    <div className="commit-overlay" onClick={handleClose}>
      <div className="commit-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="commit-header">
          <h2>Commit Changes</h2>
          <button className="commit-close" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        <div className="commit-body">
          {/* Files */}
          <div className="commit-section">
            <div className="commit-section-title">
              <FileText size={14} />
              <span>Changed files ({changedFiles.length})</span>
            </div>
            <div className="commit-files">
              {changedFiles.map((file) => (
                <div key={file.path} className="commit-file">
                  <span className={`commit-file-badge ${file.type}`}>{file.status}</span>
                  <span className="commit-file-name">{file.path}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="commit-section">
            <div className="commit-section-title">
              <span>Commit message</span>
              <button className="commit-generate" onClick={generateMessage} disabled={generating}>
                {generating ? <Loader2 size={14} className="spinning" /> : <Sparkles size={14} />}
                <span>{generating ? 'Generating...' : 'Generate'}</span>
              </button>
            </div>
            <textarea
              className="commit-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your changes..."
              rows={3}
              autoFocus
            />
          </div>

          {error && <div className="commit-error">{error}</div>}
        </div>

        <div className="commit-footer">
          <button className="commit-btn secondary" onClick={handleClose} disabled={committing}>
            Cancel
          </button>
          <button
            className="commit-btn primary"
            onClick={handleCommit}
            disabled={!message.trim() || committing}
          >
            {committing ? (
              <>
                <Loader2 size={14} className="spinning" />
                <span>Committing...</span>
              </>
            ) : (
              <span>Commit</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
