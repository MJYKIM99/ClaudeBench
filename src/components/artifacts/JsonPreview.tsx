import { useMemo, useState } from 'react';

import './ArtifactPreview.css';

interface JsonPreviewProps {
  content: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function JsonNode({ name, value, depth }: { name: string | null; value: unknown; depth: number }) {
  const [isOpen, setIsOpen] = useState(depth < 2);

  const isArray = Array.isArray(value);
  const isObj = isRecord(value);

  if (!isArray && !isObj) {
    return (
      <div className="json-row" style={{ paddingLeft: depth * 14 }}>
        {name !== null && <span className="json-key">{name}:</span>}
        <span className={`json-value json-${typeof value}`}>
          {typeof value === 'string' ? `"${value}"` : String(value)}
        </span>
      </div>
    );
  }

  const entries = isArray ? (value as unknown[]) : Object.entries(value as Record<string, unknown>);
  const label = isArray ? `Array(${(value as unknown[]).length})` : `Object(${entries.length})`;

  return (
    <div className="json-node">
      <button
        className="json-row json-toggle"
        style={{ paddingLeft: depth * 14 }}
        onClick={() => setIsOpen((o) => !o)}
        type="button"
      >
        <span className="json-caret">{isOpen ? '▼' : '▶'}</span>
        {name !== null && <span className="json-key">{name}:</span>}
        <span className="json-summary">{label}</span>
      </button>
      {isOpen && (
        <div className="json-children">
          {isArray
            ? (value as unknown[]).map((v, idx) => (
                <JsonNode key={idx} name={String(idx)} value={v} depth={depth + 1} />
              ))
            : Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                <JsonNode key={k} name={k} value={v} depth={depth + 1} />
              ))}
        </div>
      )}
    </div>
  );
}

export function JsonPreview({ content }: JsonPreviewProps) {
  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(content) as unknown };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }, [content]);

  if (!parsed.ok) {
    return (
      <div className="json-preview-error">
        <strong>Invalid JSON</strong>
        <div className="json-preview-error-detail">{parsed.error}</div>
        <pre className="json-preview-raw">{content}</pre>
      </div>
    );
  }

  return (
    <div className="json-preview">
      <JsonNode name={null} value={parsed.value} depth={0} />
    </div>
  );
}
