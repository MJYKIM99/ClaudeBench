import type { Attachment } from '../../types';

interface AttachmentPreviewProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

export function AttachmentPreview({ attachments, onRemove }: AttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="attachment-preview">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="attachment-item">
          {attachment.type === 'image' && attachment.content ? (
            <img
              src={`data:${attachment.mimeType || 'image/png'};base64,${attachment.content}`}
              alt={attachment.name}
              className="attachment-image"
            />
          ) : (
            <div className="attachment-file">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 1h5l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z" />
                <path d="M9 1v4h4" fill="none" stroke="currentColor" />
              </svg>
            </div>
          )}
          <span className="attachment-name">{attachment.name}</span>
          <button
            className="attachment-remove"
            onClick={() => onRemove(attachment.id)}
            title="Remove"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path
                d="M3 3l6 6M9 3l-6 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
