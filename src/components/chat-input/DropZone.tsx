import { useState, useCallback, type DragEvent, type ReactNode } from 'react';
import type { Attachment } from '../../types';

interface DropZoneProps {
  children: ReactNode;
  onFilesAdded: (attachments: Attachment[]) => void;
  disabled?: boolean;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function fileToAttachment(file: File): Promise<Attachment> {
  const isImage = file.type.startsWith('image/');

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve({
        id: generateId(),
        type: isImage ? 'image' : 'file',
        name: file.name,
        content: base64,
        mimeType: file.type,
        size: file.size,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function DropZone({ children, onFilesAdded, disabled }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const attachments = await Promise.all(files.map(fileToAttachment));
    onFilesAdded(attachments);
  }, [disabled, onFilesAdded]);

  return (
    <div
      className={`dropzone ${isDragging ? 'dropzone--active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
      {isDragging && (
        <div className="dropzone-overlay">
          <div className="dropzone-message">
            Drop files here
          </div>
        </div>
      )}
    </div>
  );
}
