import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { SkillIcon } from './CategoryIcon';
import './SkillManager.css';

interface SkillManagerProps {
  onBack: () => void;
}

type ManagerTab = 'install' | 'create' | 'installed';

// Skill type templates for creation
const SKILL_TEMPLATES = [
  {
    id: 'content',
    name: 'Content Creation',
    description: 'Video scripts, social media posts, copywriting',
    prompt: 'content creation skill for writing',
  },
  {
    id: 'file',
    name: 'File Processing',
    description: 'Organize, rename, convert files',
    prompt: 'file processing and organization skill',
  },
  {
    id: 'data',
    name: 'Data Analysis',
    description: 'Analyze data, generate reports, visualize',
    prompt: 'data analysis and reporting skill',
  },
  {
    id: 'automation',
    name: 'Automation',
    description: 'Automate repetitive tasks',
    prompt: 'automation skill for',
  },
  {
    id: 'learning',
    name: 'Learning Assistant',
    description: 'Study notes, explanations, quizzes',
    prompt: 'learning and education skill',
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Describe your own skill from scratch',
    prompt: '',
  },
];

export function SkillManager({ onBack }: SkillManagerProps) {
  const skills = useAppStore((s) => s.skills);
  const cwd = useAppStore((s) => s.cwd);
  const [activeTab, setActiveTab] = useState<ManagerTab>('install');
  const [githubUrl, setGithubUrl] = useState('');
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installSuccess, setInstallSuccess] = useState<string | null>(null);

  // Create skill state
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [skillDescription, setSkillDescription] = useState('');
  const [hasReferenceFiles, setHasReferenceFiles] = useState(false);

  // Reference folder path - use a fixed path since process.env.HOME doesn't work in browser
  const referenceFolder = '~/.claude/skill-references';

  const handleInstallFromGitHub = async () => {
    if (!githubUrl.trim()) return;

    setInstalling(true);
    setInstallError(null);
    setInstallSuccess(null);

    try {
      window.sidecarSend?.({
        type: 'skills.install',
        payload: { url: githubUrl.trim() },
      });

      setInstallSuccess('Installation request sent. The skill will be downloaded to ~/.claude/skills/');
      setGithubUrl('');

      setTimeout(() => {
        window.sidecarSend?.({ type: 'skills.list', payload: {} });
      }, 1000);
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : 'Installation failed');
    } finally {
      setInstalling(false);
    }
  };

  const handleCreateSkill = () => {
    const template = SKILL_TEMPLATES.find(t => t.id === selectedTemplate);

    // Build the prompt for skill-creator
    let prompt = '/skill-creator\n\n';
    prompt += `I want to create a new skill.\n\n`;

    if (template && template.id !== 'custom') {
      prompt += `**Type:** ${template.name}\n`;
    }

    if (skillDescription.trim()) {
      prompt += `**Description:** ${skillDescription.trim()}\n\n`;
    }

    if (hasReferenceFiles) {
      prompt += `**Reference files location:** ${referenceFolder}\n`;
      prompt += `Please read the files in this folder as reference for creating the skill.\n\n`;
    }

    prompt += `Please help me create this skill step by step.`;

    // Start a new session with skill-creator
    window.sidecarSend?.({
      type: 'session.start',
      payload: {
        title: `Create Skill: ${skillDescription.slice(0, 30) || template?.name || 'Custom'}`,
        prompt,
        cwd: cwd || undefined,
      },
    });

    onBack();
  };

  const handleOpenReferenceFolder = () => {
    // Create folder if needed and open it
    window.sidecarSend?.({
      type: 'skills.openReferenceFolder',
      payload: { path: referenceFolder },
    });
  };

  const handleDeleteSkill = (skillPath: string, skillName: string) => {
    if (confirm(`Are you sure you want to delete "${skillName}"?`)) {
      window.sidecarSend?.({
        type: 'skills.delete',
        payload: { path: skillPath },
      });
      setTimeout(() => {
        window.sidecarSend?.({ type: 'skills.list', payload: {} });
      }, 500);
    }
  };

  const handleOpenSkillFolder = (skillPath: string) => {
    window.sidecarSend?.({
      type: 'skills.open',
      payload: { path: skillPath },
    });
  };

  const canCreate = selectedTemplate && (selectedTemplate === 'custom' ? skillDescription.trim() : true);

  return (
    <div className="skill-manager">
      <div className="skill-manager-header">
        <button className="back-btn" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <h2>Skill Manager</h2>
      </div>

      <div className="manager-tabs">
        <button
          className={`manager-tab ${activeTab === 'install' ? 'active' : ''}`}
          onClick={() => setActiveTab('install')}
        >
          Install
        </button>
        <button
          className={`manager-tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create
        </button>
        <button
          className={`manager-tab ${activeTab === 'installed' ? 'active' : ''}`}
          onClick={() => setActiveTab('installed')}
        >
          Installed ({skills.length})
        </button>
      </div>

      <div className="manager-content">
        {activeTab === 'install' && (
          <div className="install-tab">
            <div className="install-section">
              <h3>Install from GitHub</h3>
              <p className="install-hint">
                Enter a GitHub repository URL containing a skill. The skill will be cloned to <code>~/.claude/skills/</code>
              </p>
              <div className="install-input-group">
                <input
                  type="text"
                  placeholder="https://github.com/username/skill-name"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInstallFromGitHub()}
                />
                <button
                  className="install-btn"
                  onClick={handleInstallFromGitHub}
                  disabled={installing || !githubUrl.trim()}
                >
                  {installing ? 'Installing...' : 'Install'}
                </button>
              </div>
              {installError && <p className="install-error">{installError}</p>}
              {installSuccess && <p className="install-success">{installSuccess}</p>}
            </div>
          </div>
        )}

        {activeTab === 'create' && (
          <div className="create-tab">
            {/* Step 1: Select type */}
            <div className="create-step">
              <h3>1. What type of skill do you want to create?</h3>
              <div className="template-grid">
                {SKILL_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    <span className="template-name">{template.name}</span>
                    <span className="template-desc">{template.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Describe */}
            {selectedTemplate && (
              <div className="create-step">
                <h3>2. Describe what you want the skill to do</h3>
                <textarea
                  className="skill-description-input"
                  placeholder={
                    selectedTemplate === 'custom'
                      ? "Describe your skill in detail..."
                      : "Add more details about what you need (optional)..."
                  }
                  value={skillDescription}
                  onChange={(e) => setSkillDescription(e.target.value)}
                  rows={4}
                />
              </div>
            )}

            {/* Step 3: Reference (optional) */}
            {selectedTemplate && (
              <div className="create-step">
                <h3>3. Add reference files (optional)</h3>
                <div className="reference-folder-section">
                  <label className="reference-checkbox">
                    <input
                      type="checkbox"
                      checked={hasReferenceFiles}
                      onChange={(e) => setHasReferenceFiles(e.target.checked)}
                    />
                    <span>I have reference files for this skill</span>
                  </label>
                  {hasReferenceFiles && (
                    <div className="reference-folder-info">
                      <p>
                        Put your reference files (docs, examples, templates) in:
                      </p>
                      <div className="folder-path-row">
                        <code>{referenceFolder}</code>
                        <button
                          className="open-folder-btn"
                          onClick={handleOpenReferenceFolder}
                        >
                          Open Folder
                        </button>
                      </div>
                      <p className="folder-hint">
                        Claude will read these files when creating your skill.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Create button */}
            {selectedTemplate && (
              <div className="create-actions">
                <button
                  className="create-btn"
                  onClick={handleCreateSkill}
                  disabled={!canCreate}
                >
                  Create Skill with Claude
                </button>
                <p className="create-hint">
                  Claude will guide you through creating the skill step by step.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'installed' && (
          <div className="installed-tab">
            {skills.length === 0 ? (
              <div className="installed-empty">
                <p>No skills installed yet.</p>
              </div>
            ) : (
              <div className="installed-list">
                {skills.map((skill) => (
                  <div key={skill.path} className="installed-skill">
                    <div className="installed-skill-icon">
                      <SkillIcon size={20} color="var(--color-primary)" />
                    </div>
                    <div className="installed-skill-info">
                      <div className="installed-skill-header">
                        <span className="installed-skill-name">{skill.name}</span>
                        <span className={`installed-skill-source ${skill.source}`}>
                          {skill.source}
                        </span>
                      </div>
                      {skill.description && (
                        <p className="installed-skill-desc">{skill.description}</p>
                      )}
                      <span className="installed-skill-path" title={skill.path}>
                        {skill.path}
                      </span>
                    </div>
                    <div className="installed-skill-actions">
                      <button
                        className="skill-action-btn"
                        onClick={() => handleOpenSkillFolder(skill.path)}
                        title="Open in Finder"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                      </button>
                      <button
                        className="skill-action-btn danger"
                        onClick={() => handleDeleteSkill(skill.path, skill.name)}
                        title="Delete skill"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
