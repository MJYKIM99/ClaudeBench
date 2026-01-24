import { useMemo } from 'react';
import type { SkillParameterValues } from '../../types';
import './SkillPreview.css';

interface SkillPreviewProps {
  template: string;
  values: SkillParameterValues;
  maxHeight?: number;
}

export function SkillPreview({ template, values, maxHeight = 200 }: SkillPreviewProps) {
  const expandedContent = useMemo(() => {
    let result = template;
    for (const [key, value] of Object.entries(values)) {
      const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      const stringValue = Array.isArray(value) ? value.join(', ') : String(value ?? '');
      result = result.replace(placeholder, stringValue);
    }
    return result;
  }, [template, values]);

  // Find remaining placeholders that weren't filled
  const remainingPlaceholders = useMemo(() => {
    const matches = expandedContent.match(/\{\{\s*\w+\s*\}\}/g);
    return matches ? [...new Set(matches)] : [];
  }, [expandedContent]);

  // Highlight placeholders in the preview
  const highlightedContent = useMemo(() => {
    let html = expandedContent
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Highlight remaining placeholders in yellow
    html = html.replace(
      /\{\{\s*(\w+)\s*\}\}/g,
      '<span class="placeholder-unfilled">{{$1}}</span>'
    );

    return html;
  }, [expandedContent]);

  return (
    <div className="skill-preview">
      <div className="preview-header">
        <span className="preview-title">Preview</span>
        {remainingPlaceholders.length > 0 && (
          <span className="preview-warning">
            {remainingPlaceholders.length} unfilled parameter{remainingPlaceholders.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div
        className="preview-content"
        style={{ maxHeight }}
        dangerouslySetInnerHTML={{ __html: highlightedContent }}
      />
    </div>
  );
}
