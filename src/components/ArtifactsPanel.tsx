import { useMemo, useState } from 'react';

import { useAppStore } from '../store/useAppStore';
import type { Artifact } from '../types';
import { revealInFinder } from '../utils/pathUtils';

import './ArtifactsPanel.css';

interface ArtifactsPanelProps {
  onClose: () => void;
}

function formatTimestamp(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '';
  }
}

function getArtifactFilePath(artifact: Artifact): string | null {
  const value = artifact.meta?.['filePath'];
  return typeof value === 'string' ? value : null;
}

export function ArtifactsPanel({ onClose }: ArtifactsPanelProps) {
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const sessions = useAppStore((s) => s.sessions);
  const setPreviewArtifact = useAppStore((s) => s.setPreviewArtifact);

  const [searchQuery, setSearchQuery] = useState('');

  const artifacts = useMemo(() => {
    if (!activeSessionId) return [];
    return sessions[activeSessionId]?.artifacts ?? [];
  }, [activeSessionId, sessions]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [...artifacts].sort((a, b) => b.createdAt - a.createdAt);
    return [...artifacts]
      .filter((a) => {
        const filePath = getArtifactFilePath(a) || '';
        return (
          a.title?.toLowerCase().includes(q) ||
          a.type.toLowerCase().includes(q) ||
          a.language?.toLowerCase().includes(q) ||
          filePath.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [artifacts, searchQuery]);

  const handleOpen = (artifact: Artifact) => {
    setPreviewArtifact(artifact);
    onClose();
  };

  return (
    <div className="artifacts-panel">
      <div className="artifacts-header">
        <div className="artifacts-header-title">
          <h2>Artifacts</h2>
          <span className="artifacts-count">{artifacts.length}</span>
        </div>
        <button className="close-btn" onClick={onClose} title="Close">
          ×
        </button>
      </div>

      <div className="artifacts-content">
        {!activeSessionId ? (
          <div className="artifacts-empty">
            <h3>No session selected</h3>
            <p>Select a session to see its artifacts.</p>
          </div>
        ) : (
          <>
            <div className="artifacts-search">
              <input
                type="text"
                placeholder="Search artifacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {filtered.length === 0 ? (
              <div className="artifacts-empty">
                <h3>No artifacts</h3>
                <p>When Claude writes previewable files, they’ll appear here.</p>
              </div>
            ) : (
              <div className="artifacts-list">
                {filtered.map((artifact) => {
                  const filePath = getArtifactFilePath(artifact);
                  return (
                    <button
                      key={artifact.id}
                      className="artifact-row"
                      onClick={() => handleOpen(artifact)}
                      title={artifact.title}
                    >
                      <div className="artifact-row-main">
                        <div className="artifact-row-title">
                          <span className="artifact-name">{artifact.title || 'Untitled'}</span>
                          <span className="artifact-badge">
                            {artifact.language || artifact.type}
                          </span>
                        </div>
                        <div className="artifact-row-meta">
                          <span className="artifact-type">{artifact.type}</span>
                          <span className="artifact-time">
                            {formatTimestamp(artifact.createdAt)}
                          </span>
                        </div>
                        {filePath && (
                          <div className="artifact-row-path">
                            <code>{filePath}</code>
                            <button
                              className="artifact-path-action"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                revealInFinder(filePath);
                              }}
                              title="Reveal in Finder"
                            >
                              ↗
                            </button>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
