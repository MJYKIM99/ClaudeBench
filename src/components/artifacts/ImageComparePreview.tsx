import { useMemo, useState } from 'react';

import './ArtifactPreview.css';

interface ImageComparePreviewProps {
  content: string;
}

interface ImageComparePayload {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
}

function parsePayload(content: string): ImageComparePayload | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj['before'] !== 'string' || typeof obj['after'] !== 'string') return null;
    return {
      before: obj['before'],
      after: obj['after'],
      beforeLabel: typeof obj['beforeLabel'] === 'string' ? obj['beforeLabel'] : undefined,
      afterLabel: typeof obj['afterLabel'] === 'string' ? obj['afterLabel'] : undefined,
    };
  } catch {
    return null;
  }
}

export function ImageComparePreview({ content }: ImageComparePreviewProps) {
  const payload = useMemo(() => parsePayload(content), [content]);
  const [pos, setPos] = useState(50);

  if (!payload) {
    return (
      <div className="image-compare-error">
        <strong>Invalid image-compare payload</strong>
        <div className="image-compare-hint">
          Expected JSON: {'{'} "before": "data:image/...", "after": "data:image/..." {'}'}
        </div>
      </div>
    );
  }

  const beforeLabel = payload.beforeLabel || 'Before';
  const afterLabel = payload.afterLabel || 'After';

  return (
    <div className="image-compare">
      <div className="image-compare-stage">
        <img className="image-compare-img" src={payload.after} alt={afterLabel} />
        <div className="image-compare-clip" style={{ width: `${pos}%` }}>
          <img className="image-compare-img" src={payload.before} alt={beforeLabel} />
        </div>
        <div className="image-compare-handle" style={{ left: `${pos}%` }} />
        <div className="image-compare-label image-compare-label-before">{beforeLabel}</div>
        <div className="image-compare-label image-compare-label-after">{afterLabel}</div>
      </div>
      <div className="image-compare-slider">
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
