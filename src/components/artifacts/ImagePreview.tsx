import { useState } from 'react';

import './ArtifactPreview.css';

interface ImagePreviewProps {
  src: string;
  alt?: string;
}

export function ImagePreview({ src, alt = 'Image preview' }: ImagePreviewProps) {
  const [scale, setScale] = useState(1);
  const [error, setError] = useState(false);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.25));
  const handleReset = () => setScale(1);

  if (error) {
    return (
      <div className="image-preview-error">
        <span>Failed to load image</span>
      </div>
    );
  }

  return (
    <div className="image-preview">
      <div className="image-preview-toolbar">
        <button onClick={handleZoomOut} title="Zoom out">
          −
        </button>
        <span className="zoom-level">{Math.round(scale * 100)}%</span>
        <button onClick={handleZoomIn} title="Zoom in">
          +
        </button>
        <button onClick={handleReset} title="Reset zoom">
          Reset
        </button>
      </div>
      <div className="image-preview-container">
        <img
          src={src}
          alt={alt}
          style={{ transform: `scale(${scale})` }}
          onError={() => setError(true)}
        />
      </div>
    </div>
  );
}
