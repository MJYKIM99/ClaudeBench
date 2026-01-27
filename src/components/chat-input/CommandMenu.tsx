import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

import { COMMANDS, getFilteredCommands, type Command } from './commands';

interface CommandMenuProps {
  query: string;
  onSelect: (command: Command) => void;
  onClose: () => void;
  selectedIndex: number;
}

export function CommandMenu({ query, onSelect, onClose, selectedIndex }: CommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const filtered = getFilteredCommands(query);
  const safeIndex = Math.min(selectedIndex, Math.max(0, filtered.length - 1));

  useEffect(() => {
    if (itemRefs.current[safeIndex]) {
      itemRefs.current[safeIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [safeIndex]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="animate-slide-in-up absolute right-0 bottom-full left-0 z-[1000] mb-2 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]"
    >
      <div className="border-b border-[var(--color-border)] bg-[var(--color-light)] px-3 py-2">
        <span className="text-[11px] font-medium tracking-wide text-[var(--color-text-muted)] uppercase">
          Commands
        </span>
        {filtered.length < COMMANDS.length && (
          <span className="ml-1.5 text-[11px] text-[var(--color-text-muted)]">
            {filtered.length}/{COMMANDS.length}
          </span>
        )}
      </div>
      <div className="max-h-64 overflow-y-auto">
        {filtered.map((cmd, idx) => {
          const isSelected = idx === safeIndex;
          return (
            <div
              key={cmd.id}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              className={cn(
                'grid cursor-pointer grid-cols-[80px_1fr] items-center gap-3 px-3 py-2 transition-colors duration-75',
                isSelected ? 'bg-[var(--color-primary-light)]' : 'hover:bg-[var(--color-light)]'
              )}
              onClick={() => onSelect(cmd)}
            >
              <span
                className={cn(
                  'font-mono text-[13px] font-medium',
                  isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'
                )}
              >
                {cmd.label}
              </span>
              <span
                className={cn(
                  'text-[13px]',
                  isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'
                )}
              >
                {cmd.description}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
