import './ArtifactPreview.css';

interface DiffPreviewProps {
  content: string;
}

function getLineClass(line: string): string {
  if (line.startsWith('diff --git ')) return 'diff-line diff-header';
  if (line.startsWith('index ')) return 'diff-line diff-meta';
  if (line.startsWith('--- ') || line.startsWith('+++ ')) return 'diff-line diff-file';
  if (line.startsWith('@@')) return 'diff-line diff-hunk';
  if (line.startsWith('+') && !line.startsWith('+++')) return 'diff-line diff-add';
  if (line.startsWith('-') && !line.startsWith('---')) return 'diff-line diff-del';
  return 'diff-line diff-ctx';
}

export function DiffPreview({ content }: DiffPreviewProps) {
  const lines = content.split('\n');

  return (
    <div className="diff-preview">
      <pre className="diff-pre">
        {lines.map((line, idx) => (
          <div key={idx} className={getLineClass(line)}>
            {line || ' '}
          </div>
        ))}
      </pre>
    </div>
  );
}
