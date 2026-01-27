export interface Command {
  id: string;
  label: string;
  description: string;
}

export const COMMANDS: Command[] = [
  { id: 'new', label: '/new', description: 'Start a new conversation' },
  { id: 'clear', label: '/clear', description: 'Clear input' },
  { id: 'plan', label: '/plan', description: 'Switch to Plan mode' },
  { id: 'agent', label: '/agent', description: 'Switch to Agent mode' },
  { id: 'sonnet', label: '/sonnet', description: 'Use Claude 4 Sonnet' },
  { id: 'opus', label: '/opus', description: 'Use Claude 4.5 Opus' },
  { id: 'haiku', label: '/haiku', description: 'Use Claude 3.5 Haiku' },
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
  return COMMANDS.filter((cmd) => cmd.id.toLowerCase().startsWith(query.toLowerCase()));
}
