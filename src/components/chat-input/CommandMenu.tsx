import { useEffect, useRef } from 'react';
import './CommandMenu.css';

export interface Command {
  id: string;
  label: string;
  description: string;
}

export const COMMANDS: Command[] = [
  // === Session Commands (直接执行) ===
  { id: 'new', label: '/new', description: 'Start a new conversation' },
  { id: 'clear', label: '/clear', description: 'Clear input' },

  // === Mode & Model (直接执行) ===
  { id: 'plan', label: '/plan', description: 'Switch to Plan mode' },
  { id: 'agent', label: '/agent', description: 'Switch to Agent mode' },
  { id: 'sonnet', label: '/sonnet', description: 'Use Claude 3.5 Sonnet' },
  { id: 'opus', label: '/opus', description: 'Use Claude 3 Opus' },
  { id: 'haiku', label: '/haiku', description: 'Use Claude 3 Haiku' },

  // === Quick Prompts (快捷提示词) ===
  { id: 'commit', label: '/commit', description: 'Create a git commit' },
  { id: 'test', label: '/test', description: 'Run tests' },
  { id: 'build', label: '/build', description: 'Build the project' },
  { id: 'lint', label: '/lint', description: 'Run linter' },
  { id: 'fix', label: '/fix', description: 'Fix errors' },
  { id: 'explain', label: '/explain', description: 'Explain code' },

  { id: 'help', label: '/help', description: 'Show help' },
];

export function getFilteredCommands(query: string): Command[] {
  if (!query) return COMMANDS;
  return COMMANDS.filter((cmd) =>
    cmd.id.toLowerCase().startsWith(query.toLowerCase())
  );
}

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

  // Scroll selected item into view
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
    <div className="command-menu" ref={menuRef}>
      <div className="command-menu-header">
        Commands {filtered.length < COMMANDS.length && `(${filtered.length}/${COMMANDS.length})`}
      </div>
      {filtered.map((cmd, idx) => (
        <div
          key={cmd.id}
          ref={(el) => { itemRefs.current[idx] = el; }}
          className={`command-menu-item ${idx === safeIndex ? 'selected' : ''}`}
          onClick={() => onSelect(cmd)}
        >
          <span className="command-label">{cmd.label}</span>
          <span className="command-description">{cmd.description}</span>
        </div>
      ))}
    </div>
  );
}
