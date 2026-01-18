import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { PermissionMode } from '../types';
import './SettingsPanel.css';

interface SkillInfo {
  name: string;
  description?: string;
  path?: string;
}

interface SettingsPanelProps {
  onClose: () => void;
}

// App icon component using the actual logo
function AppIcon({ size = 48 }: { size?: number }) {
  return (
    <img
      src="/claudebenchicon.png"
      alt="ClaudeBench"
      width={size}
      height={size}
      style={{ borderRadius: size * 0.2 }}
    />
  );
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const claudeSettings = useAppStore((s) => s.claudeSettings);
  const permissionSettings = useAppStore((s) => s.permissionSettings);

  useEffect(() => {
    loadSkills();
    // Request permission settings on mount
    window.sidecarSend?.({ type: 'settings.get' });
  }, []);

  const loadSkills = async () => {
    setLoading(true);
    try {
      const mockSkills: SkillInfo[] = [
        { name: 'content-creator', description: '自媒体视频脚本和文案创作助手' },
        { name: 'doc-coauthoring', description: 'Guide users through structured documentation workflow' },
        { name: 'subtitle-proofreader', description: '双语字幕校对助手' },
        { name: 'skill-creator', description: 'Guide for creating effective skills' },
        { name: 'frontend-design', description: 'Create distinctive, production-grade frontend interfaces' },
      ];
      setSkills(mockSkills);
    } catch (error) {
      console.error('Failed to load skills:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Settings</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="settings-content">
        {/* Connection Section */}
        <section className="settings-section">
          <h3>Connection</h3>
          <div className="settings-card">
            <div className="setting-row">
              <span className="setting-label">Status</span>
              <span className="setting-value status-connected">Connected</span>
            </div>
            <div className="setting-row">
              <span className="setting-label">Engine</span>
              <span className="setting-value mono">Claude Code CLI</span>
            </div>
            {claudeSettings?.path && (
              <div className="setting-row">
                <span className="setting-label">Config Path</span>
                <span className="setting-value mono" title={claudeSettings.path}>
                  {claudeSettings.path.length > 30 ? '...' + claudeSettings.path.slice(-30) : claudeSettings.path}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Model Section */}
        <section className="settings-section">
          <h3>Model</h3>
          <div className="settings-card">
            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">Default Model</span>
                <span className="setting-hint">Uses your Claude Code configuration</span>
              </div>
              <span className="setting-value mono">{claudeSettings?.model || 'claude-sonnet'}</span>
            </div>
            <div className="setting-row">
              <span className="setting-label">API Key</span>
              <span className={`setting-value ${claudeSettings?.hasApiKey ? 'status-connected' : 'status-error'}`}>
                {claudeSettings?.hasApiKey ? 'Configured' : 'Not Found'}
              </span>
            </div>
          </div>
          <p className="settings-note">
            Model selection follows your Claude Code settings. Configure it via <code>claude config</code>.
          </p>
        </section>

        {/* Permission & Security Section */}
        <section className="settings-section">
          <h3>Permission & Security</h3>
          <div className="settings-card">
            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">Permission Mode</span>
                <span className="setting-hint">Controls how tool requests are handled</span>
              </div>
              <select
                className="setting-select"
                value={permissionSettings?.permissionMode || 'interactive'}
                onChange={(e) => {
                  window.sidecarSend?.({
                    type: 'settings.update',
                    payload: { permissionMode: e.target.value as PermissionMode },
                  });
                }}
              >
                <option value="interactive">Ask for each action (Recommended)</option>
                <option value="auto-safe">Auto-approve safe operations</option>
                <option value="bypass">Auto-approve all (Not recommended)</option>
              </select>
            </div>
            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">Protected Paths</span>
                <span className="setting-hint">Always require confirmation for these directories</span>
              </div>
              <span className="setting-value mono protected-paths">
                {permissionSettings?.protectedPaths?.slice(0, 3).join(', ')}
                {(permissionSettings?.protectedPaths?.length || 0) > 3 && '...'}
              </span>
            </div>
            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">Saved Permissions</span>
                <span className="setting-hint">Remembered permission decisions</span>
              </div>
              <span className="setting-value">
                {permissionSettings?.policies?.length || 0} rules
              </span>
            </div>
          </div>
          {(permissionSettings?.policies?.length || 0) > 0 && (
            <button
              className="reset-permissions-btn"
              onClick={() => {
                if (confirm('Are you sure you want to clear all saved permission rules?')) {
                  window.sidecarSend?.({ type: 'settings.permission.clear' });
                }
              }}
            >
              Reset All Permission Rules
            </button>
          )}
          <p className="settings-note">
            <strong>Interactive:</strong> Ask before executing Bash, Edit, Write commands.<br />
            <strong>Auto-safe:</strong> Auto-approve Read/Grep/Glob, ask for others.<br />
            <strong>Bypass:</strong> Auto-approve everything (use with caution).
          </p>
        </section>

        {/* Skills Section */}
        <section className="settings-section">
          <div className="section-header">
            <h3>Skills</h3>
            <button className="refresh-btn" onClick={loadSkills} disabled={loading}>
              {loading ? '...' : '↻'}
            </button>
          </div>

          {loading ? (
            <div className="settings-card loading">
              <span>Loading skills...</span>
            </div>
          ) : skills.length === 0 ? (
            <div className="settings-card empty">
              <p>No skills installed.</p>
              <p className="settings-hint">
                Skills extend Claude's capabilities. Install them via <code>/skill-creator</code> or from packages.
              </p>
            </div>
          ) : (
            <div className="skills-list">
              {skills.map((skill) => (
                <div key={skill.name} className="skill-card">
                  <div className="skill-icon">⚡</div>
                  <div className="skill-info">
                    <span className="skill-name">{skill.name}</span>
                    {skill.description && (
                      <span className="skill-description">{skill.description}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="settings-note">
            Skills are loaded from <code>~/.claude/skills</code> and project-level <code>.claude/skills</code> directories.
          </p>
        </section>

        {/* About Section */}
        <section className="settings-section about-section">
          <h3>About</h3>
          <div className="about-card">
            <div className="about-header">
              <AppIcon size={56} />
              <div className="about-title">
                <h4>ClaudeBench</h4>
                <span className="version-badge">v0.1.0</span>
              </div>
            </div>
            <p className="about-description">
              A native desktop interface for Claude Code, providing a visual GUI for coding assistance powered by Claude AI.
            </p>
            <div className="about-details">
              <div className="about-row">
                <span className="about-label">Built with</span>
                <span className="about-value">Tauri + React + Claude Agent SDK</span>
              </div>
              <div className="about-row">
                <span className="about-label">Platform</span>
                <span className="about-value">macOS / Windows / Linux</span>
              </div>
            </div>
            <div className="about-links">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="about-link">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                GitHub
              </a>
              <a href="https://anthropic.com" target="_blank" rel="noopener noreferrer" className="about-link">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0L0 14h3.2L8 4.8 12.8 14H16L8 0z"/>
                </svg>
                Anthropic
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
