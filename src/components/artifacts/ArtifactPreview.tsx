import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Code, Copy, Eye, List, X } from 'lucide-react';

import { CodePreview } from './CodePreview';
import { CsvPreview } from './CsvPreview';
import { DiffPreview } from './DiffPreview';
import { DirectoryTreePreview } from './DirectoryTreePreview';
import { HtmlPreview } from './HtmlPreview';
import { ImageComparePreview } from './ImageComparePreview';
import { ImagePreview } from './ImagePreview';
import { JsonPreview } from './JsonPreview';
import { MarkdownPreview } from './MarkdownPreview';
import { MermaidPreview } from './MermaidPreview';
import { SrtPreview } from './SrtPreview';

import './ArtifactPreview.css';

import type { Artifact, ArtifactType } from '../../types';

export type { Artifact, ArtifactType };

interface ArtifactPreviewProps {
  artifact: Artifact;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onOpenList?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export function ArtifactPreview({
  artifact,
  onClose,
  onPrev,
  onNext,
  onOpenList,
  hasPrev = false,
  hasNext = false,
}: ArtifactPreviewProps) {
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);

  const title = useMemo(() => {
    if (artifact.title) return artifact.title;
    switch (artifact.type) {
      case 'html':
        return 'HTML Preview';
      case 'mermaid':
        return 'Mermaid Diagram';
      case 'json':
        return 'JSON';
      case 'diff':
        return 'Diff';
      case 'srt':
        return 'Subtitles';
      case 'directory-tree':
        return 'Directory Tree';
      case 'image-compare':
        return 'Image Compare';
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

  const canPreview = [
    'html',
    'mermaid',
    'image',
    'markdown',
    'csv',
    'json',
    'diff',
    'srt',
    'directory-tree',
    'image-compare',
  ].includes(artifact.type);

  // Check if code view is available (not for images)
  const hasCodeView = !!artifact.content && artifact.type !== 'image';

  return (
    <div className="artifact-preview">
      {/* Header */}
      <div className="artifact-header">
        <div className="artifact-title-area">
          <span className="artifact-title">{title}</span>
          <span className="artifact-type-badge">{artifact.language || artifact.type}</span>
        </div>
        <div className="artifact-actions">
          {onPrev && (
            <button
              className="header-action-btn"
              onClick={onPrev}
              disabled={!hasPrev}
              title="Previous artifact"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          {onNext && (
            <button
              className="header-action-btn"
              onClick={onNext}
              disabled={!hasNext}
              title="Next artifact"
            >
              <ChevronRight size={16} />
            </button>
          )}
          {onOpenList && (
            <button className="header-action-btn" onClick={onOpenList} title="All artifacts">
              <List size={16} />
            </button>
          )}
          <button className="header-action-btn" onClick={onClose} title="Close preview">
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
        ) : artifact.type === 'json' ? (
          <JsonPreview content={artifact.content} />
        ) : artifact.type === 'diff' ? (
          <DiffPreview content={artifact.content} />
        ) : artifact.type === 'srt' ? (
          <SrtPreview content={artifact.content} />
        ) : artifact.type === 'directory-tree' ? (
          <DirectoryTreePreview content={artifact.content} />
        ) : artifact.type === 'image-compare' ? (
          <ImageComparePreview content={artifact.content} />
        ) : (
          <CodePreview code={artifact.content} language={artifact.language} />
        )}
      </div>
    </div>
  );
}
