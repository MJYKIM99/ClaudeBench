import { useEffect, useRef } from 'react';
import './MentionMenu.css';

export interface MentionItem {
  id: string;
  label: string;
  type: 'file' | 'folder' | 'context';
  path?: string;
}

const CONTEXT_ITEMS: MentionItem[] = [
  { id: 'codebase', label: 'Codebase', type: 'context' },
  { id: 'selection', label: 'Current Selection', type: 'context' },
  { id: 'file', label: 'File...', type: 'context' },
];

export function getFilteredMentions(query: string, items?: MentionItem[]): MentionItem[] {
  const displayItems = items || CONTEXT_ITEMS;
  return displayItems.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );
}

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

  return (
    <div className="mention-menu" ref={menuRef}>
      <div className="mention-menu-header">Context</div>
      {filtered.map((item, idx) => (
        <div
          key={item.id}
          className={`mention-menu-item ${idx === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(item)}
        >
          <span className="mention-icon">
            {item.type === 'file' && (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.5 2A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5v-7l-4-4h-6.5z" />
              </svg>
            )}
            {item.type === 'folder' && (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.879a1.5 1.5 0 0 1 1.06.44l.5.5.44.56h5.121A1.5 1.5 0 0 1 15 5v7.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z" />
              </svg>
            )}
            {item.type === 'context' && (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z" />
                <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
              </svg>
            )}
          </span>
          <span className="mention-label">{item.label}</span>
          {item.path && <span className="mention-path">{item.path}</span>}
        </div>
      ))}
    </div>
  );
}
