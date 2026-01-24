import type { SkillInfo } from '../../types';
import './SkillCard.css';

interface SkillCardProps {
  skill: SkillInfo;
  onUse: () => void;
}

export function SkillCard({ skill, onUse }: SkillCardProps) {
  const hasParameters = skill.parameters && skill.parameters.length > 0;

  return (
    <div className="skill-card" onClick={onUse}>
      <div className="skill-card-content">
        <div className="skill-card-header">
          <h4 className="skill-card-name">{skill.name}</h4>
          <div className="skill-card-badges">
            {hasParameters && (
              <span className="skill-card-param-badge" title={`${skill.parameters!.length} parameter${skill.parameters!.length > 1 ? 's' : ''}`}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </span>
            )}
            <span className={`skill-card-source ${skill.source}`}>
              {skill.source === 'global' ? 'Global' : 'Project'}
            </span>
          </div>
        </div>
        {skill.description && (
          <p className="skill-card-description">{skill.description}</p>
        )}
      </div>
    </div>
  );
}
