interface CodePreviewProps {
  code: string;
  language?: string;
}

export function CodePreview({ code }: CodePreviewProps) {
  return (
    <div className="code-preview">
      <pre>{code}</pre>
    </div>
  );
}
