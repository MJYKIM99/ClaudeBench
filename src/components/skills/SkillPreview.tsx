import type { SkillParameterValues } from '../../types';

interface SkillPreviewProps {
  template: string;
  values: SkillParameterValues;
}

export function SkillPreview({ template, values }: SkillPreviewProps) {
  const renderTemplate = () => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const regex = /\{\{\s*(\w+)\s*\}\}/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{template.slice(lastIndex, match.index)}</span>);
      }

      const paramName = match[1];
      const value = values[paramName];
      const displayValue = Array.isArray(value)
        ? value.join(', ')
        : value !== undefined && value !== null && value !== ''
          ? String(value)
          : null;

      if (displayValue) {
        parts.push(
          <span
            key={`value-${match.index}`}
            className="rounded bg-[var(--color-primary-light)] px-1 text-[var(--color-primary)]"
          >
            {displayValue}
          </span>
        );
      } else {
        parts.push(
          <span
            key={`placeholder-${match.index}`}
            className="rounded bg-amber-500/20 px-1 font-medium text-amber-600"
          >
            {`{{${paramName}}}`}
          </span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < template.length) {
      parts.push(<span key={`text-${lastIndex}`}>{template.slice(lastIndex)}</span>);
    }

    return parts;
  };

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-light)]">
      <div className="border-b border-[var(--color-border)] bg-black/5 px-3 py-2">
        <span className="text-xs font-medium tracking-wide text-[var(--color-mid-gray)] uppercase">
          Preview
        </span>
      </div>
      <div className="p-3 font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap text-[var(--color-text)]">
        {renderTemplate()}
      </div>
    </div>
  );
}
