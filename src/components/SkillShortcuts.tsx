import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import './SkillShortcuts.css';

interface SkillShortcut {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  prompt: string;
}

// 预设的快捷技能
const SKILL_SHORTCUTS: SkillShortcut[] = [
  {
    id: 'file-organization',
    name: 'Organize files',
    description: 'Sort files, rename batches, create folder structures',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8 13h8M8 17h5" strokeLinecap="round"/>
      </svg>
    ),
    prompt: '/file-organizer Help me organize the files in my current directory. Analyze the file types and create a clean folder structure with meaningful names.',
  },
  {
    id: 'image-processing',
    name: 'Process images',
    description: 'Batch convert, compress, rename photos',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    prompt: '/image-processor Help me batch process images in my current directory. I want to convert, compress, or rename them.',
  },
  {
    id: 'website-builder',
    name: 'Build a website',
    description: 'Generate responsive websites from descriptions',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18"/>
        <circle cx="6" cy="6" r="0.5" fill="currentColor"/>
        <circle cx="8.5" cy="6" r="0.5" fill="currentColor"/>
        <circle cx="11" cy="6" r="0.5" fill="currentColor"/>
      </svg>
    ),
    prompt: '/frontend-design Help me create a modern, responsive website. I want a clean landing page with a hero section, features section, and a footer.',
  },
  {
    id: 'research',
    name: 'Research topic',
    description: 'Deep research with sources and summaries',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="11" cy="11" r="8"/>
        <path d="M21 21l-4.35-4.35"/>
        <path d="M11 8v6M8 11h6" strokeLinecap="round"/>
      </svg>
    ),
    prompt: '/deep-researcher Help me research and analyze a topic. Gather information from multiple sources and provide a comprehensive summary with key findings.',
  },
  {
    id: 'subtitle-proofreader',
    name: 'Proofread subtitles',
    description: 'Fix subtitle errors, optimize translations',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="4" width="20" height="16" rx="2"/>
        <path d="M6 14h4M6 18h8M14 14h4" strokeLinecap="round"/>
        <path d="M2 10h20"/>
      </svg>
    ),
    prompt: '/subtitle-proofreader Help me proofread my subtitle file. Check for speech recognition errors, optimize the English translation, and adjust line breaks for better readability.',
  },
  {
    id: 'content-creator',
    name: 'Create content',
    description: 'Video scripts, copy, social media posts',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 19l7-7 3 3-7 7-3-3z"/>
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
        <path d="M2 2l7.586 7.586"/>
        <circle cx="11" cy="11" r="2"/>
      </svg>
    ),
    prompt: '/content-creator Help me create engaging content for social media. I need a video script with a hook, main content, and call-to-action.',
  },
];

interface SkillShortcutsProps {
  onSelect?: (prompt: string) => void;
}

export function SkillShortcuts({ onSelect }: SkillShortcutsProps) {
  const setPendingSkill = useAppStore((s) => s.setPendingSkill);

  const handleClick = useCallback((skill: SkillShortcut) => {
    // Set pending skill with name and prompt
    setPendingSkill({
      name: skill.name,
      prompt: skill.prompt,
    });
    // Also call onSelect if provided (for compatibility)
    onSelect?.(skill.prompt);
  }, [setPendingSkill, onSelect]);

  return (
    <div className="skill-shortcuts">
      <div className="skill-shortcuts-grid">
        {SKILL_SHORTCUTS.map((skill) => (
          <button
            key={skill.id}
            className="skill-shortcut-card"
            onClick={() => handleClick(skill)}
          >
            <div className="skill-shortcut-icon">
              {skill.icon}
            </div>
            <div className="skill-shortcut-content">
              <span className="skill-shortcut-name">{skill.name}</span>
              <span className="skill-shortcut-description">{skill.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
