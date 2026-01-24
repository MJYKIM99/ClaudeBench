import { useState, useMemo } from 'react';
import { X, Code, Eye, Copy, Check } from 'lucide-react';
import { CodePreview } from './CodePreview';
import { HtmlPreview } from './HtmlPreview';
import { MermaidPreview } from './MermaidPreview';
import { ImagePreview } from './ImagePreview';
import { MarkdownPreview } from './MarkdownPreview';
import { CsvPreview } from './CsvPreview';
import './ArtifactPreview.css';

export type ArtifactType = 'html' | 'mermaid' | 'code' | 'image' | 'markdown' | 'csv';

export interface Artifact {
  type: ArtifactType;
  language?: string;
  content: string;
  title?: string;
}

interface ArtifactPreviewProps {
  artifact: Artifact;
  onClose: () => void;
}

export function ArtifactPreview({ artifact, onClose }: ArtifactPreviewProps) {
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);

  const title = useMemo(() => {
    if (artifact.title) return artifact.title;
    switch (artifact.type) {
      case 'html':
        return 'HTML Preview';
      case 'mermaid':
        return 'Mermaid Diagram';
      default:
        return artifact.language ? `${artifact.language} Code` : 'Code';
    }
  }, [artifact]);

  const handleCopy = async () => {
    if (!artifact?.content) return;
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const canPreview = ['html', 'mermaid', 'image', 'markdown', 'csv'].includes(artifact.type);

  // Check if code view is available (not for images)
  const hasCodeView = !!artifact.content && artifact.type !== 'image';

  return (
    <div className="artifact-preview">
      {/* Header */}
      <div className="artifact-header">
        <div className="artifact-title-area">
          <span className="artifact-title">{title}</span>
          <span className="artifact-type-badge">
            {artifact.language || artifact.type}
          </span>
        </div>
        <div className="artifact-actions">
          <button
            className="header-action-btn"
            onClick={onClose}
            title="Close preview"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* View mode toggle toolbar */}
      {(hasCodeView || canPreview) && (
        <div className="artifact-toolbar">
          {canPreview && hasCodeView && (
            <div className="view-toggle">
              <button
                className={`toggle-btn ${viewMode === 'preview' ? 'active' : ''}`}
                onClick={() => setViewMode('preview')}
              >
                <Eye size={14} />
                <span>Preview</span>
              </button>
              <button
                className={`toggle-btn ${viewMode === 'code' ? 'active' : ''}`}
                onClick={() => setViewMode('code')}
              >
                <Code size={14} />
                <span>Code</span>
              </button>
            </div>
          )}

          {!canPreview && hasCodeView && (
            <div className="view-mode-label">
              <Code size={14} />
              <span>Code</span>
            </div>
          )}

          {hasCodeView && viewMode === 'code' && (
            <button className="copy-btn" onClick={handleCopy} title="Copy code">
              {copied ? (
                <>
                  <Check size={14} className="copy-success" />
                  <span className="copy-success">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="artifact-content">
        {viewMode === 'code' && hasCodeView ? (
          <CodePreview code={artifact.content} language={artifact.language} />
        ) : artifact.type === 'html' ? (
          <HtmlPreview html={artifact.content} />
        ) : artifact.type === 'mermaid' ? (
          <MermaidPreview code={artifact.content} />
        ) : artifact.type === 'image' ? (
          <ImagePreview src={artifact.content} alt={artifact.title} />
        ) : artifact.type === 'markdown' ? (
          <MarkdownPreview content={artifact.content} />
        ) : artifact.type === 'csv' ? (
          <CsvPreview content={artifact.content} />
        ) : (
          <CodePreview code={artifact.content} language={artifact.language} />
        )}
      </div>
    </div>
  );
}
