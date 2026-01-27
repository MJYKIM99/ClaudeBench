import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

import './ArtifactPreview.css';

interface MermaidPreviewProps {
  code: string;
}

// Clean mermaid code by removing markdown fences
function cleanMermaidCode(code: string): string {
  let cleanCode = code.trim();

  // Remove ```mermaid ... ``` wrapper
  if (cleanCode.startsWith('```mermaid')) {
    cleanCode = cleanCode.replace(/^```mermaid\s*\n?/, '').replace(/\n?```$/, '');
  } else if (cleanCode.startsWith('```')) {
    cleanCode = cleanCode.replace(/^```\s*\n?/, '').replace(/\n?```$/, '');
  }

  return cleanCode.trim();
}

export function MermaidPreview({ code }: MermaidPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const renderIdRef = useRef(0);

  // Re-render mermaid at different scales for crisp output
  const renderDiagram = useCallback(
    async (renderScale: number = 1) => {
      const currentRenderId = ++renderIdRef.current;

      if (!containerRef.current) return;

      setLoading(true);
      setError(null);

      try {
        const cleanCode = cleanMermaidCode(code);

        if (!cleanCode) {
          setError('Empty diagram code');
          setLoading(false);
          return;
        }

        // Dynamically import mermaid
        const mermaid = (await import('mermaid')).default;

        // Check if this render is still current
        if (currentRenderId !== renderIdRef.current) return;

        // Initialize mermaid with scale factor
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          flowchart: {
            useMaxWidth: false,
          },
          sequence: {
            useMaxWidth: false,
          },
        });

        // Generate unique ID for this render
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Render the diagram
        const { svg } = await mermaid.render(id, cleanCode);

        // Check if this render is still current
        if (currentRenderId !== renderIdRef.current) return;

        // Parse and modify SVG for scaling
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svg, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');

        if (svgElement) {
          // Get original dimensions
          const width = parseFloat(svgElement.getAttribute('width') || '400');
          const height = parseFloat(svgElement.getAttribute('height') || '300');

          // Scale the SVG dimensions
          svgElement.setAttribute('width', String(width * renderScale));
          svgElement.setAttribute('height', String(height * renderScale));

          // Set viewBox to maintain aspect ratio and crispness
          if (!svgElement.getAttribute('viewBox')) {
            svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
          }

          svgElement.style.maxWidth = 'none';
          svgElement.style.height = 'auto';
        }

        containerRef.current.innerHTML = svgDoc.documentElement.outerHTML;
        setLoading(false);
      } catch (err) {
        // Check if this render is still current
        if (currentRenderId !== renderIdRef.current) return;

        console.error('Mermaid render error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to render diagram';
        setError(errorMessage);
        setLoading(false);
      }
    },
    [code]
  );

  useEffect(() => {
    renderDiagram(scale);
  }, [renderDiagram, scale]);

  const handleZoomIn = () => {
    setScale((s) => Math.min(s + 0.5, 4));
  };

  const handleZoomOut = () => {
    setScale((s) => Math.max(s - 0.5, 0.5));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleFitToView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.25 : 0.25;
    setScale((s) => Math.min(Math.max(s + delta, 0.5), 4));
  }, []);

  // Pan/drag functionality
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    },
    [position]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (error) {
    const cleanCode = cleanMermaidCode(code);
    return (
      <div className="mermaid-preview">
        <div className="mermaid-error">
          <strong>Diagram Error:</strong> {error}
          <pre className="mermaid-code">{cleanCode}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="mermaid-preview-wrapper">
      <div className="mermaid-toolbar">
        <button onClick={handleZoomOut} title="Zoom out" className="mermaid-tool-btn">
          <ZoomOut size={16} />
        </button>
        <span className="mermaid-zoom-level">{Math.round(scale * 100)}%</span>
        <button onClick={handleZoomIn} title="Zoom in" className="mermaid-tool-btn">
          <ZoomIn size={16} />
        </button>
        <div className="mermaid-toolbar-divider" />
        <button onClick={handleFitToView} title="Fit to view" className="mermaid-tool-btn">
          <Maximize2 size={16} />
        </button>
        <button onClick={handleReset} title="Reset view" className="mermaid-tool-btn">
          <RotateCcw size={16} />
        </button>
      </div>
      <div
        ref={viewportRef}
        className="mermaid-viewport"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {loading && (
          <div className="mermaid-loading-overlay">
            <span>Rendering...</span>
          </div>
        )}
        <div
          className="mermaid-content"
          ref={containerRef}
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`,
            opacity: loading ? 0.5 : 1,
          }}
        />
      </div>
    </div>
  );
}
