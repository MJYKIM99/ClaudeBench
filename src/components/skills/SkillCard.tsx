import type { SkillInfo } from '../../types';
import './SkillCard.css';

interface SkillCardProps {
  skill: SkillInfo;
  onUse: () => void;
}

export function SkillCard({ skill, onUse }: SkillCardProps) {
  return (
    <div className="skill-card" onClick={onUse}>
      <div className="skill-card-content">
        <div className="skill-card-header">
          <h4 className="skill-card-name">{skill.name}</h4>
          <span className={`skill-card-source ${skill.source}`}>
            {skill.source === 'global' ? 'Global' : 'Project'}
          </span>
        </div>
        {skill.description && (
          <p className="skill-card-description">{skill.description}</p>
        )}
      </div>
    </div>
  );
}
