import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { SkillCard } from './SkillCard';
import { SkillManager } from './SkillManager';
import { SkillUseModal } from './SkillUseModal';
import type { SkillInfo } from '../../types';
import './SkillsPage.css';

interface SkillsPageProps {
  onClose: () => void;
  onUseSkill: () => void;
}

export function SkillsPage({ onClose, onUseSkill }: SkillsPageProps) {
  const skills = useAppStore((s) => s.skills);
  const skillsLoading = useAppStore((s) => s.skillsLoading);
  const setSkillsLoading = useAppStore((s) => s.setSkillsLoading);
  const setPendingSkill = useAppStore((s) => s.setPendingSkill);

  const [showManager, setShowManager] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);

  // Load skills on mount
  useEffect(() => {
    setSkillsLoading(true);
    window.sidecarSend?.({ type: 'skills.list', payload: {} });
  }, [setSkillsLoading]);

  // Filter skills based on search
  const filteredSkills = useMemo(() => {
    if (!searchQuery) return skills;
    const query = searchQuery.toLowerCase();
    return skills.filter(skill =>
      skill.name.toLowerCase().includes(query) ||
      skill.description?.toLowerCase().includes(query)
    );
  }, [skills, searchQuery]);

  const handleSkillClick = useCallback((skill: SkillInfo) => {
    // If skill has parameters, show modal; otherwise use directly
    if (skill.parameters && skill.parameters.length > 0) {
      setSelectedSkill(skill);
    } else {
      // No parameters - use skill directly
      setPendingSkill({
        name: skill.name,
        prompt: `/${skill.name} `,
      });
      onUseSkill();
      onClose();
    }
  }, [setPendingSkill, onUseSkill, onClose]);

  const handleUseSkillWithParams = useCallback((expandedPrompt: string) => {
    if (!selectedSkill) return;
    setPendingSkill({
      name: selectedSkill.name,
      prompt: expandedPrompt,
    });
    setSelectedSkill(null);
    onUseSkill();
    onClose();
  }, [selectedSkill, setPendingSkill, onUseSkill, onClose]);

  const handleRefresh = () => {
    setSkillsLoading(true);
    window.sidecarSend?.({ type: 'skills.list', payload: {} });
  };

  if (showManager) {
    return <SkillManager onBack={() => setShowManager(false)} />;
  }

  return (
    <div className="skills-page">
      <div className="skills-page-header">
        <div className="skills-page-title">
          <h2>Skills</h2>
          <span className="skills-count">{skills.length} installed</span>
        </div>
        <div className="skills-page-actions">
          <button className="skills-action-btn" onClick={handleRefresh} disabled={skillsLoading}>
            {skillsLoading ? '...' : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            )}
          </button>
          <button className="skills-action-btn primary" onClick={() => setShowManager(true)}>
            Manage
          </button>
          <button className="skills-close-btn" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="skills-search">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          type="text"
          placeholder="Search skills..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Skills grid */}
      <div className="skills-content">
        {skillsLoading ? (
          <div className="skills-loading">
            <div className="loading-spinner" />
            <span>Loading skills...</span>
          </div>
        ) : skills.length === 0 ? (
          <div className="skills-empty">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-mid-gray)" strokeWidth="1.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <h3>No skills installed</h3>
            <p>Skills extend Claude's capabilities. Install from GitHub or create your own.</p>
            <button className="install-btn" onClick={() => setShowManager(true)}>
              + Add Skills
            </button>
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="skills-empty">
            <p>No skills match your search.</p>
          </div>
        ) : (
          <div className="skills-grid">
            {filteredSkills.map((skill) => (
              <SkillCard
                key={skill.path}
                skill={skill}
                onUse={() => handleSkillClick(skill)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Parameter modal */}
      {selectedSkill && (
        <SkillUseModal
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
          onUse={handleUseSkillWithParams}
        />
      )}
    </div>
  );
}
