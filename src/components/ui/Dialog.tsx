import { ReactNode, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-[360px]',
  md: 'w-[480px]',
  lg: 'w-[640px]',
};

export function Dialog({ open, onClose, title, children, footer, size = 'md' }: DialogProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, handleEscape]);

  if (!open) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className={cn(
          'animate-dialog-enter flex max-h-[85vh] flex-col rounded-[var(--radius-lg)] bg-[var(--color-surface)] shadow-[var(--shadow-xl)]',
          sizeClasses[size]
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'dialog-title' : undefined}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
            <h2
              id="dialog-title"
              className="m-0 text-base font-[var(--font-heading)] font-semibold text-[var(--color-dark)]"
            >
              {title}
            </h2>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border-none bg-transparent text-[var(--color-mid-gray)] transition-all duration-[120ms] hover:bg-[var(--color-light)] hover:text-[var(--color-dark)]"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border)] px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
