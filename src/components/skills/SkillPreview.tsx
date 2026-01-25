import './SkillPreview.css';

import type { SkillParameterValues } from '../../types';

interface SkillPreviewProps {
  template: string;
  values: SkillParameterValues;
}

export function SkillPreview({ template, values }: SkillPreviewProps) {
  // Expand template with current values, highlighting placeholders
  const renderTemplate = () => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const regex = /\{\{\s*(\w+)\s*\}\}/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
      // Add text before the placeholder
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`} className="preview-text">
            {template.slice(lastIndex, match.index)}
          </span>
        );
      }

      const paramName = match[1];
      const value = values[paramName];
      const displayValue = Array.isArray(value)
        ? value.join(', ')
        : value !== undefined && value !== null && value !== ''
          ? String(value)
          : null;

      if (displayValue) {
        // Show the filled value
        parts.push(
          <span key={`value-${match.index}`} className="preview-value">
            {displayValue}
          </span>
        );
      } else {
        // Show the placeholder
        parts.push(
          <span key={`placeholder-${match.index}`} className="preview-placeholder">
            {`{{${paramName}}}`}
          </span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < template.length) {
      parts.push(
        <span key={`text-${lastIndex}`} className="preview-text">
          {template.slice(lastIndex)}
        </span>
      );
    }

    return parts;
  };

  return <div className="skill-preview">{renderTemplate()}</div>;
}
