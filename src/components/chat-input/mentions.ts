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
  return displayItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
}
