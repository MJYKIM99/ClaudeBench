import { useEffect, useRef } from 'react';
import { AtSign, File, Folder } from 'lucide-react';

import { cn } from '@/lib/utils';

import { getFilteredMentions, type MentionItem } from './mentions';

interface MentionMenuProps {
  query: string;
  items?: MentionItem[];
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
  selectedIndex: number;
}

export function MentionMenu({ query, items, onSelect, onClose, selectedIndex }: MentionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = getFilteredMentions(query, items);

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

  const getIcon = (type: MentionItem['type'], isSelected: boolean) => {
    const iconClass = cn(
      'h-4 w-4',
      isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'
    );
    switch (type) {
      case 'file':
        return <File className={iconClass} />;
      case 'folder':
        return <Folder className={iconClass} />;
      case 'context':
        return <AtSign className={iconClass} />;
    }
  };

  return (
    <div
      ref={menuRef}
      className="animate-slide-in-up absolute right-0 bottom-full left-0 z-[1000] mb-2 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]"
    >
      <div className="border-b border-[var(--color-border)] bg-[var(--color-light)] px-3 py-2">
        <span className="text-[11px] font-medium tracking-wide text-[var(--color-text-muted)] uppercase">
          Context
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {filtered.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={item.id}
              className={cn(
                'grid cursor-pointer grid-cols-[24px_1fr_auto] items-center gap-2.5 px-3 py-2 transition-colors duration-75',
                isSelected ? 'bg-[var(--color-primary-light)]' : 'hover:bg-[var(--color-light)]'
              )}
              onClick={() => onSelect(item)}
            >
              <span className="flex items-center justify-center">
                {getIcon(item.type, isSelected)}
              </span>
              <span
                className={cn(
                  'text-[13px] font-medium',
                  isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'
                )}
              >
                {item.label}
              </span>
              {item.path && (
                <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
                  {item.path}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
