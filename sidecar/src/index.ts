#!/usr/bin/env node
/**
 * Claude GUI Sidecar
 * Event-based stdio bridge for Claude Agent SDK
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { SessionStore, type PermissionMode } from './session-store.js';
import { loadClaudeSettings, applySettings, type LoadedSettings } from './claude-settings.js';
import { generateSessionTitle } from './title-generator.js';

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error(JSON.stringify({
    type: 'runner.error',
    payload: { message: `Uncaught exception: ${error.message}` }
  }));
});

process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({
    type: 'runner.error',
    payload: { message: `Unhandled rejection: ${reason}` }
  }));
});

// Find Claude Code CLI path
function findClaudeCodePath(): string | undefined {
  const home = process.env.HOME || '';

  const paths = [
    path.join(home, '.local/bin/claude'),
    path.join(home, '.claude/local/claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    '/usr/bin/claude',
  ];

  for (const p of paths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return undefined;
}

const claudeCodePath = findClaudeCodePath();

// Bundled skills that ship with the app
const BUNDLED_SKILLS = [
  'file-organizer',
  'image-processor',
  'deep-researcher',
  'frontend-design',
  'subtitle-proofreader',
  'content-creator',
];

// Check environment and install bundled skills
function checkEnvironment(): { hasClaudeCode: boolean; skillsInstalled: boolean; missingSkills: string[] } {
  const home = process.env.HOME || '';
  const skillsDir = path.join(home, '.claude', 'skills');

  const hasClaudeCode = !!claudeCodePath;

  // Check which bundled skills are missing
  const missingSkills: string[] = [];
  for (const skillName of BUNDLED_SKILLS) {
    const skillPath = path.join(skillsDir, skillName);
    if (!fs.existsSync(skillPath)) {
      missingSkills.push(skillName);
    }
  }

  return {
    hasClaudeCode,
    skillsInstalled: missingSkills.length === 0,
    missingSkills,
  };
}

// Install bundled skills from sidecar/bundled-skills directory
function installBundledSkills(): { success: boolean; installed: string[]; errors: string[] } {
  const home = process.env.HOME || '';
  const skillsDir = path.join(home, '.claude', 'skills');

  // Ensure skills directory exists
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }

  const installed: string[] = [];
  const errors: string[] = [];

  // Find bundled-skills directory (relative to this script)
  const bundledDir = path.join(__dirname, '..', 'bundled-skills');

  if (!fs.existsSync(bundledDir)) {
    return { success: false, installed: [], errors: ['Bundled skills directory not found'] };
  }

  for (const skillName of BUNDLED_SKILLS) {
    const sourcePath = path.join(bundledDir, `${skillName}.md`);
    const targetDir = path.join(skillsDir, skillName);
    const targetPath = path.join(targetDir, 'SKILL.md');

    // Skip if already installed
    if (fs.existsSync(targetPath)) {
      continue;
    }

    try {
      // Create skill directory
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Copy skill file
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, targetPath);
        installed.push(skillName);
      } else {
        errors.push(`Source not found: ${skillName}`);
      }
    } catch (err) {
      errors.push(`Failed to install ${skillName}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    success: errors.length === 0,
    installed,
    errors,
  };
}

// Handle environment check request
function handleEnvCheck(): void {
  const result = checkEnvironment();
  send({
    type: 'env.status',
    payload: result,
  });
}

// Handle bundled skills installation request
function handleInstallBundledSkills(): void {
  const result = installBundledSkills();
  send({
    type: 'skills.bundled.installed',
    payload: result,
  });
}

// Types
interface ClientEvent {
  type: string;
  payload?: Record<string, unknown>;
}

interface ServerEvent {
  type: string;
  payload: Record<string, unknown>;
}

interface Attachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  content?: string; // base64
  mimeType?: string;
  size?: number;
}

// Parameter types for parameterized skills
interface SelectOption {
  value: string;
  label: string;
}

interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'file' | 'text';
  label: string;
  description?: string;
  required?: boolean;
  default?: string | number | boolean | string[];
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  options?: SelectOption[];
  accept?: string;
  directory?: boolean;
  rows?: number;
}

interface SkillInfo {
  name: string;
  description?: string;
  path: string;
  source: 'global' | 'project';
  category?: string;
  icon?: string;
  tags?: string[];
  author?: string;
  version?: string;
  parameters?: SkillParameter[];
  template?: string;
}

interface SessionInfo {
  id: string;
  title: string;
  claudeSessionId?: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  cwd?: string;
  createdAt?: number;
  updatedAt?: number;
}

interface SessionData {
  info: SessionInfo;
  messages: unknown[];
  abortController: AbortController;
  pendingPermissions: Map<string, (result: { behavior: string; updatedInput?: unknown }) => void>;
  isFirstQuery?: boolean;
  firstPrompt?: string;
}

// State
const sessions = new Map<string, SessionData>();
let store: SessionStore;
let settings: LoadedSettings;

// Output helper
function send(event: ServerEvent): void {
  console.log(JSON.stringify(event));
}

function generateId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Skills scanning functions
function parseSkillMetadata(skillPath: string): SkillInfo | null {
  const skillMdPath = path.join(skillPath, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    return {
      name: path.basename(skillPath),
      path: skillPath,
      source: 'global',
    };
  }

  try {
    const content = fs.readFileSync(skillMdPath, 'utf-8');
    const lines = content.split('\n');

    let name = path.basename(skillPath);
    let description: string | undefined;
    let category: string | undefined;
    let author: string | undefined;
    let version: string | undefined;
    let icon: string | undefined;
    let tags: string[] | undefined;
    let parameters: SkillParameter[] | undefined;
    let inFrontmatter = false;
    let inParameters = false;
    let currentParam: Partial<SkillParameter> | null = null;
    let inOptions = false;
    let frontmatterEndLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim() === '---') {
        if (!inFrontmatter) {
          inFrontmatter = true;
          continue;
        } else {
          frontmatterEndLine = i;
          // Save last parameter if exists
          if (currentParam && currentParam.name && currentParam.type) {
            if (!parameters) parameters = [];
            parameters.push(currentParam as SkillParameter);
          }
          break;
        }
      }

      if (inFrontmatter) {
        // Check for parameters array start
        if (line.match(/^parameters:\s*$/)) {
          inParameters = true;
          parameters = [];
          continue;
        }

        // Inside parameters array
        if (inParameters) {
          // New parameter item (starts with "  - ")
          if (line.match(/^\s{2}-\s+name:\s*(.+)$/)) {
            // Save previous parameter
            if (currentParam && currentParam.name && currentParam.type) {
              parameters!.push(currentParam as SkillParameter);
            }
            currentParam = { name: line.match(/^\s{2}-\s+name:\s*(.+)$/)![1].trim().replace(/^["']|["']$/g, '') };
            inOptions = false;
            continue;
          }

          // Parameter properties (indented with 4+ spaces)
          if (currentParam && line.match(/^\s{4,}\w/)) {
            // Check for options array
            if (line.match(/^\s{4}options:\s*$/)) {
              inOptions = true;
              currentParam.options = [];
              continue;
            }

            // Option items
            if (inOptions && line.match(/^\s{6}-\s*\{/)) {
              const optMatch = line.match(/value:\s*["']?([^"',}]+)["']?.*label:\s*["']?([^"'}]+)["']?/);
              if (optMatch && currentParam.options) {
                currentParam.options.push({ value: optMatch[1].trim(), label: optMatch[2].trim() });
              }
              continue;
            }

            // Regular property
            if (!inOptions || !line.match(/^\s{6}/)) {
              inOptions = false;
              const propMatch = line.match(/^\s{4}(\w+):\s*(.+)$/);
              if (propMatch) {
                const [, key, rawValue] = propMatch;
                let value: string | number | boolean = rawValue.trim().replace(/^["']|["']$/g, '');

                // Type coercion
                if (value === 'true') value = true;
                else if (value === 'false') value = false;
                else if (!isNaN(Number(value)) && value !== '') value = Number(value);

                (currentParam as Record<string, unknown>)[key] = value;
              }
            }
            continue;
          }

          // Exit parameters section if we hit a non-indented line
          if (!line.match(/^\s/) && line.trim() !== '') {
            inParameters = false;
            // Save last parameter
            if (currentParam && currentParam.name && currentParam.type) {
              parameters!.push(currentParam as SkillParameter);
            }
            currentParam = null;
          }
        }

        // Regular frontmatter fields
        if (!inParameters) {
          const nameMatch = line.match(/^name:\s*(.+)$/);
          if (nameMatch) {
            name = nameMatch[1].trim().replace(/^["']|["']$/g, '');
          }
          const descMatch = line.match(/^description:\s*(.+)$/);
          if (descMatch) {
            description = descMatch[1].trim().replace(/^["']|["']$/g, '');
          }
          const catMatch = line.match(/^category:\s*(.+)$/);
          if (catMatch) {
            category = catMatch[1].trim().replace(/^["']|["']$/g, '');
          }
          const authorMatch = line.match(/^author:\s*(.+)$/);
          if (authorMatch) {
            author = authorMatch[1].trim().replace(/^["']|["']$/g, '');
          }
          const versionMatch = line.match(/^version:\s*(.+)$/);
          if (versionMatch) {
            version = versionMatch[1].trim().replace(/^["']|["']$/g, '');
          }
          const iconMatch = line.match(/^icon:\s*(.+)$/);
          if (iconMatch) {
            icon = iconMatch[1].trim().replace(/^["']|["']$/g, '');
          }
          const tagsMatch = line.match(/^tags:\s*\[(.+)\]$/);
          if (tagsMatch) {
            tags = tagsMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, ''));
          }
        }
      }
    }

    // Extract template (content after frontmatter)
    const template = frontmatterEndLine > 0
      ? lines.slice(frontmatterEndLine + 1).join('\n').trim()
      : undefined;

    return {
      name,
      description,
      path: skillPath,
      source: 'global',
      category,
      author,
      version,
      icon,
      tags,
      parameters: parameters && parameters.length > 0 ? parameters : undefined,
      template,
    };
  } catch {
    return { name: path.basename(skillPath), path: skillPath, source: 'global' };
  }
}

function scanSkillsDirectory(dirPath: string, source: 'global' | 'project'): SkillInfo[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const skills: SkillInfo[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const skillPath = path.join(dirPath, entry.name);
        const metadata = parseSkillMetadata(skillPath);

        if (metadata) {
          skills.push({
            ...metadata,
            path: skillPath,
            source,
          });
        }
      }
    }
  } catch {
    // Directory read failed, return empty
  }

  return skills;
}

// Expand skill template with parameter values
function expandSkillTemplate(template: string, values: Record<string, unknown>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    const stringValue = Array.isArray(value) ? value.join(', ') : String(value);
    result = result.replace(placeholder, stringValue);
  }
  return result;
}

// Validate parameter values against schema
function validateSkillParameters(
  parameters: SkillParameter[],
  values: Record<string, unknown>
): { valid: boolean; errors: Array<{ name: string; message: string }> } {
  const errors: Array<{ name: string; message: string }> = [];

  for (const param of parameters) {
    const value = values[param.name];

    // Required check
    if (param.required && (value === undefined || value === null || value === '')) {
      errors.push({ name: param.name, message: `${param.label} is required` });
      continue;
    }

    // Skip validation if not required and empty
    if (value === undefined || value === null || value === '') {
      continue;
    }

    // Type-specific validation
    switch (param.type) {
      case 'number': {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          errors.push({ name: param.name, message: `${param.label} must be a number` });
        } else {
          if (param.min !== undefined && numValue < param.min) {
            errors.push({ name: param.name, message: `${param.label} must be at least ${param.min}` });
          }
          if (param.max !== undefined && numValue > param.max) {
            errors.push({ name: param.name, message: `${param.label} must be at most ${param.max}` });
          }
        }
        break;
      }
      case 'string':
      case 'text': {
        const strValue = String(value);
        if (param.minLength !== undefined && strValue.length < param.minLength) {
          errors.push({ name: param.name, message: `${param.label} must be at least ${param.minLength} characters` });
        }
        if (param.maxLength !== undefined && strValue.length > param.maxLength) {
          errors.push({ name: param.name, message: `${param.label} must be at most ${param.maxLength} characters` });
        }
        if (param.pattern) {
          const regex = new RegExp(param.pattern);
          if (!regex.test(strValue)) {
            errors.push({ name: param.name, message: `${param.label} format is invalid` });
          }
        }
        break;
      }
      case 'select': {
        if (param.options && !param.options.some(opt => opt.value === value)) {
          errors.push({ name: param.name, message: `Invalid selection for ${param.label}` });
        }
        break;
      }
      case 'multiselect': {
        if (Array.isArray(value) && param.options) {
          const validValues = param.options.map(opt => opt.value);
          for (const v of value) {
            if (!validValues.includes(v)) {
              errors.push({ name: param.name, message: `Invalid selection "${v}" for ${param.label}` });
            }
          }
        }
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// Handle skill expand request
function handleSkillExpand(payload: Record<string, unknown>): void {
  const skillPath = payload.path as string;
  const values = payload.values as Record<string, unknown>;

  if (!skillPath) {
    send({ type: 'runner.error', payload: { message: 'No skill path provided' } });
    return;
  }

  const skillMdPath = path.join(skillPath, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    send({ type: 'runner.error', payload: { message: 'Skill file not found' } });
    return;
  }

  try {
    const metadata = parseSkillMetadata(skillPath);
    if (!metadata) {
      send({ type: 'runner.error', payload: { message: 'Failed to parse skill metadata' } });
      return;
    }

    // Validate parameters if skill has them
    if (metadata.parameters && metadata.parameters.length > 0) {
      const validation = validateSkillParameters(metadata.parameters, values || {});
      if (!validation.valid) {
        send({
          type: 'skills.validation',
          payload: { valid: false, errors: validation.errors },
        });
        return;
      }
    }

    // Expand template with values
    let expandedPrompt = metadata.template || '';
    if (values && Object.keys(values).length > 0) {
      expandedPrompt = expandSkillTemplate(expandedPrompt, values);
    }

    send({
      type: 'skills.expanded',
      payload: {
        name: metadata.name,
        expandedPrompt,
        parameterValues: values || {},
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to expand skill';
    send({ type: 'runner.error', payload: { message } });
  }
}

function getAllSkills(projectCwd?: string): SkillInfo[] {
  const home = process.env.HOME || '';
  const globalSkillsDir = path.join(home, '.claude', 'skills');

  const globalSkills = scanSkillsDirectory(globalSkillsDir, 'global');

  let projectSkills: SkillInfo[] = [];
  if (projectCwd) {
    const projectSkillsDir = path.join(projectCwd, '.claude', 'skills');
    projectSkills = scanSkillsDirectory(projectSkillsDir, 'project');
  }

  // Merge: project skills override global skills with same name
  const skillMap = new Map<string, SkillInfo>();
  for (const skill of globalSkills) {
    skillMap.set(skill.name, skill);
  }
  for (const skill of projectSkills) {
    skillMap.set(skill.name, skill);
  }

  return Array.from(skillMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function handleSkillsList(payload: Record<string, unknown>): void {
  const projectCwd = payload.cwd as string | undefined;
  const skills = getAllSkills(projectCwd);

  send({
    type: 'skills.list',
    payload: { skills },
  });
}

// Install skill from GitHub
async function handleSkillsInstall(payload: Record<string, unknown>): Promise<void> {
  const url = payload.url as string;
  if (!url) {
    send({ type: 'runner.error', payload: { message: 'No URL provided' } });
    return;
  }

  const home = process.env.HOME || '';
  const skillsDir = path.join(home, '.claude', 'skills');

  // Extract repo name from URL
  const match = url.match(/github\.com\/[\w-]+\/([\w-]+)/);
  if (!match) {
    send({ type: 'runner.error', payload: { message: 'Invalid GitHub URL' } });
    return;
  }

  const repoName = match[1];
  const targetDir = path.join(skillsDir, repoName);

  try {
    // Ensure skills directory exists
    if (!fs.existsSync(skillsDir)) {
      fs.mkdirSync(skillsDir, { recursive: true });
    }

    // Clone the repository using git
    const { execSync } = await import('child_process');
    execSync(`git clone ${url} "${targetDir}"`, { stdio: 'pipe' });

    send({
      type: 'skills.installed',
      payload: { success: true, name: repoName, path: targetDir },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Installation failed';
    send({ type: 'runner.error', payload: { message } });
  }
}

// Delete a skill
function handleSkillsDelete(payload: Record<string, unknown>): void {
  const skillPath = payload.path as string;
  if (!skillPath) {
    send({ type: 'runner.error', payload: { message: 'No path provided' } });
    return;
  }

  try {
    fs.rmSync(skillPath, { recursive: true, force: true });
    send({
      type: 'skills.deleted',
      payload: { success: true, path: skillPath },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delete failed';
    send({ type: 'runner.error', payload: { message } });
  }
}

// Open skill folder in Finder
function handleSkillsOpen(payload: Record<string, unknown>): void {
  const skillPath = payload.path as string;
  if (!skillPath) return;

  try {
    const { execSync } = require('child_process');
    execSync(`open "${skillPath}"`);
  } catch {
    // Ignore errors
  }
}

// Open reference folder (create if needed)
function handleOpenReferenceFolder(payload: Record<string, unknown>): void {
  const home = process.env.HOME || '';
  const refFolder = path.join(home, '.claude', 'skill-references');

  try {
    // Create folder if it doesn't exist
    if (!fs.existsSync(refFolder)) {
      fs.mkdirSync(refFolder, { recursive: true });
    }

    // Open in Finder
    const { execSync } = require('child_process');
    execSync(`open "${refFolder}"`);
  } catch {
    // Ignore errors
  }
}

// Handlers
function handleSessionList(): void {
  // Load from SQLite
  const storedSessions = store.listSessions();

  const sessionList: SessionInfo[] = storedSessions.map((s) => ({
    id: s.id,
    title: s.title,
    claudeSessionId: s.claude_session_id || undefined,
    status: s.status,
    cwd: s.cwd || undefined,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  }));

  // Also ensure in-memory map has these sessions
  for (const stored of storedSessions) {
    if (!sessions.has(stored.id)) {
      sessions.set(stored.id, {
        info: {
          id: stored.id,
          title: stored.title,
          claudeSessionId: stored.claude_session_id || undefined,
          status: stored.status,
          cwd: stored.cwd || undefined,
          createdAt: stored.created_at,
          updatedAt: stored.updated_at,
        },
        messages: [],
        abortController: new AbortController(),
        pendingPermissions: new Map(),
      });
    }
  }

  send({ type: 'session.list', payload: { sessions: sessionList } });
}

function handleSessionHistory(payload: Record<string, unknown>): void {
  const sessionId = payload.sessionId as string;

  // Load messages from SQLite
  const storedMessages = store.getSessionMessages(sessionId);
  const storedSession = store.getSession(sessionId);

  if (!storedSession) {
    send({ type: 'runner.error', payload: { message: `Session not found: ${sessionId}` } });
    return;
  }

  // Update in-memory session
  const session = sessions.get(sessionId);
  if (session) {
    session.messages = storedMessages;
  }

  send({
    type: 'session.history',
    payload: {
      sessionId,
      messages: storedMessages,
      status: storedSession.status,
    },
  });
}

// Helper: Convert attachments to MessageParam content
function buildMessageContent(prompt: string, attachments?: Attachment[]): string | Array<{type: string; [key: string]: unknown}> {
  if (!attachments || attachments.length === 0) {
    return prompt;
  }

  const content: Array<{type: string; [key: string]: unknown}> = [];

  // Add images first
  for (const att of attachments) {
    if (att.type === 'image' && att.content) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: att.mimeType || 'image/png',
          data: att.content,
        },
      });
    }
  }

  // Add text prompt
  content.push({
    type: 'text',
    text: prompt,
  });

  return content;
}

async function handleSessionStart(payload: Record<string, unknown>): Promise<void> {
  const title = (payload.title as string) || 'Untitled';
  const prompt = payload.prompt as string;
  const cwd = (payload.cwd as string) || process.cwd();
  const attachments = payload.attachments as Attachment[] | undefined;

  const sessionId = generateId();
  const now = Date.now();

  // Create in SQLite
  store.createSession({
    id: sessionId,
    title,
    cwd,
    status: 'running',
  });

  const session: SessionData = {
    info: {
      id: sessionId,
      title,
      status: 'running',
      cwd,
      createdAt: now,
      updatedAt: now,
    },
    messages: [],
    abortController: new AbortController(),
    pendingPermissions: new Map(),
    isFirstQuery: true,
    firstPrompt: prompt,
  };

  sessions.set(sessionId, session);

  // Notify status
  send({
    type: 'session.status',
    payload: { sessionId, status: 'running', title, cwd },
  });

  // Send user prompt as message
  const userPromptMsg = { type: 'user_prompt', prompt };
  send({
    type: 'stream.user_prompt',
    payload: { sessionId, prompt },
  });
  session.messages.push(userPromptMsg);
  store.recordMessage(sessionId, userPromptMsg);

  // Run query
  await runQuery(session, prompt, cwd, undefined, attachments);
}

// Helper: Build conversation context from stored messages for session resume
// Uses token-based limiting for smarter context management
function buildConversationContext(messages: unknown[], newPrompt: string): string {
  // Rough token estimation: ~4 chars per token for English, ~2 for Chinese
  const estimateTokens = (text: string): number => {
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2 + otherChars / 4);
  };

  // Extract conversation turns (user + assistant pairs)
  const turns: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const msg of messages) {
    const m = msg as Record<string, unknown>;

    if (m.type === 'user_prompt' && m.prompt) {
      turns.push({ role: 'user', content: String(m.prompt) });
    } else if (m.type === 'assistant') {
      // Try both possible message structures (SDK may vary)
      const content = (m as { content?: unknown }).content
        || (m as { message?: { content?: unknown } }).message?.content;

      if (Array.isArray(content)) {
        const textParts: string[] = [];
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            textParts.push(block.text);
          }
        }
        if (textParts.length > 0) {
          turns.push({ role: 'assistant', content: textParts.join('\n') });
        }
      }
    } else if (m.type === 'tool_use') {
      // Include tool usage summary for context
      const toolName = (m as { name?: string }).name || 'unknown';
      turns.push({ role: 'assistant', content: `[Used tool: ${toolName}]` });
    }
  }

  // Token-based limiting: keep recent turns within budget
  const MAX_CONTEXT_TOKENS = 6000; // Leave room for new conversation
  const MAX_SINGLE_TURN_TOKENS = 1500; // Cap individual turns

  let totalTokens = 0;
  const recentTurns: typeof turns = [];

  // Work backwards from most recent
  for (let i = turns.length - 1; i >= 0 && totalTokens < MAX_CONTEXT_TOKENS; i--) {
    let content = turns[i].content;
    let turnTokens = estimateTokens(content);

    // Truncate overly long individual turns
    if (turnTokens > MAX_SINGLE_TURN_TOKENS) {
      const maxChars = MAX_SINGLE_TURN_TOKENS * 3; // Rough char limit
      content = content.slice(0, maxChars) + '... [truncated]';
      turnTokens = MAX_SINGLE_TURN_TOKENS;
    }

    if (totalTokens + turnTokens <= MAX_CONTEXT_TOKENS) {
      recentTurns.unshift({ role: turns[i].role, content });
      totalTokens += turnTokens;
    } else {
      break;
    }
  }

  // If no history, just return the new prompt
  if (recentTurns.length === 0) {
    return newPrompt;
  }

  // Build the context
  const contextParts: string[] = [];
  contextParts.push('<conversation_history>');
  contextParts.push('Continue this conversation. Recent history:');
  contextParts.push('');

  for (const turn of recentTurns) {
    const label = turn.role === 'user' ? '[User]' : '[Assistant]';
    contextParts.push(`${label}: ${turn.content}`);
    contextParts.push('');
  }

  contextParts.push('</conversation_history>');
  contextParts.push('');
  contextParts.push('[User (new message)]:');
  contextParts.push(newPrompt);

  return contextParts.join('\n');
}

async function handleSessionContinue(payload: Record<string, unknown>): Promise<void> {
  const sessionId = payload.sessionId as string;
  const prompt = payload.prompt as string;
  const attachments = payload.attachments as Attachment[] | undefined;

  let session = sessions.get(sessionId);

  // If not in memory, try to load from SQLite
  if (!session) {
    const stored = store.getSession(sessionId);
    if (!stored) {
      send({ type: 'runner.error', payload: { message: `Session not found: ${sessionId}` } });
      return;
    }

    const storedMessages = store.getSessionMessages(sessionId);

    // Recreate in-memory session
    session = {
      info: {
        id: stored.id,
        title: stored.title,
        claudeSessionId: stored.claude_session_id || undefined,
        status: stored.status,
        cwd: stored.cwd || undefined,
        createdAt: stored.created_at,
        updatedAt: stored.updated_at,
      },
      messages: storedMessages,
      abortController: new AbortController(),
      pendingPermissions: new Map(),
    };
    sessions.set(sessionId, session);
  }

  session.info.status = 'running';
  session.info.updatedAt = Date.now();
  session.abortController = new AbortController();

  // Update SQLite
  store.updateSession(sessionId, { status: 'running', last_prompt: prompt });

  send({
    type: 'session.status',
    payload: { sessionId, status: 'running' },
  });

  // Send user prompt
  const userPromptMsg = { type: 'user_prompt', prompt };
  send({
    type: 'stream.user_prompt',
    payload: { sessionId, prompt },
  });
  session.messages.push(userPromptMsg);
  store.recordMessage(sessionId, userPromptMsg);

  // Build conversation context with history (don't rely on SDK resume)
  // This allows session continuation even after app restart
  const historyMessages = session.messages.slice(0, -1); // Exclude the just-added user prompt
  const conversationPrompt = buildConversationContext(historyMessages, prompt);

  // Start fresh SDK session with conversation context
  await runQuery(session, conversationPrompt, session.info.cwd || process.cwd(), undefined, attachments);
}

async function runQuery(
  session: SessionData,
  prompt: string,
  cwd: string,
  resumeSessionId?: string,
  attachments?: Attachment[]
): Promise<void> {
  const sessionId = session.info.id;

  try {
    if (!claudeCodePath) {
      throw new Error('Claude Code CLI not found. Please install Claude Code first.');
    }

    // Note: Claude Agent SDK currently only supports text prompts
    // Images are not supported through the simple query() API
    // TODO: Implement proper image support using SDKUserMessage when SDK supports it

    // Get permission mode from settings
    const permissionMode = store.getPermissionMode();

    // Define dangerous tools that need user confirmation in interactive mode
    const dangerousTools = ['Bash', 'Edit', 'Write', 'WebFetch', 'NotebookEdit'];
    // Read-only tools that are safe to auto-approve
    const safeTools = ['Read', 'Grep', 'Glob', 'Ls', 'Tree'];

    const q = query({
      prompt: prompt,
      options: {
        cwd,
        resume: resumeSessionId,
        abortController: session.abortController,
        pathToClaudeCodeExecutable: claudeCodePath,
        maxTurns: 100,
        permissionMode: permissionMode === 'bypass' ? 'bypassPermissions' : 'default',
        allowDangerouslySkipPermissions: permissionMode === 'bypass',
        includePartialMessages: true, // Enable streaming
        settingSources: ['user', 'project', 'local'], // Enable skills from ~/.claude/skills and project .claude/skills
        canUseTool: async (toolName, input, context) => {
          const toolUseId = context?.toolUseId || `tool_${Date.now()}`;

          // AskUserQuestion always requires user response
          if (toolName === 'AskUserQuestion') {
            return new Promise((resolve) => {
              session.pendingPermissions.set(toolUseId, resolve);

              send({
                type: 'permission.request',
                payload: { sessionId, toolUseId, toolName, input },
              });
            });
          }

          // Bypass mode: auto-approve everything
          if (permissionMode === 'bypass') {
            return { behavior: 'allow', updatedInput: input };
          }

          // Check if there's a saved policy for this tool
          const inputObj = input as Record<string, unknown>;
          const filePath = (inputObj.file_path || inputObj.path || inputObj.command) as string | undefined;
          const policy = store.getPermissionPolicy(toolName, filePath);

          if (policy) {
            if (policy.behavior === 'always_allow') {
              return { behavior: 'allow', updatedInput: input };
            }
            if (policy.behavior === 'always_deny') {
              return { behavior: 'deny' };
            }
          }

          // Check protected paths for file operations
          if (filePath && store.isProtectedPath(filePath)) {
            // Always ask for protected paths
            return new Promise((resolve) => {
              session.pendingPermissions.set(toolUseId, resolve);
              send({
                type: 'permission.request',
                payload: {
                  sessionId,
                  toolUseId,
                  toolName,
                  input,
                  isProtectedPath: true,
                },
              });
            });
          }

          // Auto-safe mode: approve safe tools, ask for dangerous ones
          if (permissionMode === 'auto-safe') {
            if (safeTools.includes(toolName)) {
              return { behavior: 'allow', updatedInput: input };
            }
            if (dangerousTools.includes(toolName)) {
              return new Promise((resolve) => {
                session.pendingPermissions.set(toolUseId, resolve);
                send({
                  type: 'permission.request',
                  payload: { sessionId, toolUseId, toolName, input },
                });
              });
            }
            // Unknown tools: auto-approve in auto-safe mode
            return { behavior: 'allow', updatedInput: input };
          }

          // Interactive mode: ask for all dangerous tools
          if (permissionMode === 'interactive') {
            if (safeTools.includes(toolName)) {
              return { behavior: 'allow', updatedInput: input };
            }
            // Ask for dangerous and unknown tools
            return new Promise((resolve) => {
              session.pendingPermissions.set(toolUseId, resolve);
              send({
                type: 'permission.request',
                payload: { sessionId, toolUseId, toolName, input },
              });
            });
          }

          // Default: ask
          return new Promise((resolve) => {
            session.pendingPermissions.set(toolUseId, resolve);
            send({
              type: 'permission.request',
              payload: { sessionId, toolUseId, toolName, input },
            });
          });
        },
      },
    });

    let assistantResponseText = '';

    for await (const message of q) {
      // Extract session_id from system init message for resume capability
      if (message.type === 'system' && 'subtype' in message && message.subtype === 'init') {
        const sdkSessionId = (message as { session_id?: string }).session_id;
        if (sdkSessionId && !session.info.claudeSessionId) {
          session.info.claudeSessionId = sdkSessionId;
          // Persist to SQLite
          store.updateSession(sessionId, { claude_session_id: sdkSessionId });
        }
      }

      // Collect assistant response text for title generation
      if (message.type === 'assistant' && 'content' in message) {
        const content = (message as { content: Array<{ type: string; text?: string }> }).content;
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            assistantResponseText += block.text;
          }
        }
      }

      // Send message to client
      send({
        type: 'stream.message',
        payload: { sessionId, message },
      });
      session.messages.push(message);

      // Persist message to SQLite
      store.recordMessage(sessionId, message);

      // Update status on result
      if (message.type === 'result') {
        const status = message.subtype === 'success' ? 'completed' : 'error';
        session.info.status = status;
        session.info.updatedAt = Date.now();

        // Update SQLite
        store.updateSession(sessionId, { status });

        send({
          type: 'session.status',
          payload: { sessionId, status },
        });

        // Generate title for first query after successful completion
        if (session.isFirstQuery && status === 'completed' && session.firstPrompt && claudeCodePath) {
          session.isFirstQuery = false;
          // Run title generation asynchronously (don't block)
          generateSessionTitle(session.firstPrompt, assistantResponseText, claudeCodePath)
            .then((newTitle) => {
              if (newTitle) {
                session.info.title = newTitle;
                store.updateSession(sessionId, { title: newTitle });
                send({
                  type: 'session.status',
                  payload: { sessionId, status: session.info.status, title: newTitle },
                });
              }
            })
            .catch(() => {
              // Silently ignore title generation errors
            });
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    session.info.status = 'error';
    session.info.updatedAt = Date.now();

    // Update SQLite
    store.updateSession(sessionId, { status: 'error' });

    send({
      type: 'session.status',
      payload: { sessionId, status: 'error' },
    });

    send({
      type: 'runner.error',
      payload: { message: errorMessage },
    });
  }
}

function handleSessionStop(payload: Record<string, unknown>): void {
  const sessionId = payload.sessionId as string;
  const session = sessions.get(sessionId);

  if (!session) {
    send({ type: 'runner.error', payload: { message: `Session not found: ${sessionId}` } });
    return;
  }

  session.abortController.abort();
  session.info.status = 'idle';
  session.info.updatedAt = Date.now();

  // Update SQLite
  store.updateSession(sessionId, { status: 'idle' });

  send({
    type: 'session.status',
    payload: { sessionId, status: 'idle' },
  });
}

function handleSessionDelete(payload: Record<string, unknown>): void {
  const sessionId = payload.sessionId as string;

  if (sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    session.abortController.abort();
    sessions.delete(sessionId);
  }

  // Delete from SQLite
  store.deleteSession(sessionId);

  send({
    type: 'session.deleted',
    payload: { sessionId },
  });
}

function handlePermissionResponse(payload: Record<string, unknown>): void {
  const sessionId = payload.sessionId as string;
  const toolUseId = payload.toolUseId as string;
  const result = payload.result as { behavior: string; updatedInput?: unknown };
  const remember = payload.remember as boolean | undefined;
  const rememberBehavior = payload.rememberBehavior as 'always_allow' | 'always_deny' | undefined;

  const session = sessions.get(sessionId);
  if (!session) return;

  // If user chose to remember this decision, save the policy
  if (remember && rememberBehavior) {
    const toolName = payload.toolName as string;
    const input = payload.input as Record<string, unknown> | undefined;
    const filePath = input?.file_path || input?.path;
    store.addPermissionPolicy(toolName, rememberBehavior, filePath as string | undefined);
  }

  const resolver = session.pendingPermissions.get(toolUseId);
  if (resolver) {
    resolver(result);
    session.pendingPermissions.delete(toolUseId);
  }
}

function handleSettingsGet(): void {
  const permissionMode = store.getPermissionMode();
  const protectedPaths = store.getProtectedPaths();
  const policies = store.getPermissionPolicies();

  send({
    type: 'settings.permission',
    payload: {
      permissionMode,
      protectedPaths,
      policies,
    },
  });
}

function handleSettingsUpdate(payload: Record<string, unknown>): void {
  if (payload.permissionMode !== undefined) {
    store.setPermissionMode(payload.permissionMode as PermissionMode);
  }
  if (payload.protectedPaths !== undefined) {
    store.setProtectedPaths(payload.protectedPaths as string[]);
  }

  // Send updated settings back
  handleSettingsGet();
}

function handlePermissionPolicyClear(): void {
  store.clearAllPermissionPolicies();
  handleSettingsGet();
}

// Main message handler
async function handleMessage(line: string): Promise<void> {
  let event: ClientEvent;

  try {
    event = JSON.parse(line);
  } catch {
    send({ type: 'runner.error', payload: { message: 'Parse error' } });
    return;
  }

  try {
    switch (event.type) {
      case 'session.list':
        handleSessionList();
        break;
      case 'session.history':
        handleSessionHistory(event.payload || {});
        break;
      case 'session.start':
        await handleSessionStart(event.payload || {});
        break;
      case 'session.continue':
        await handleSessionContinue(event.payload || {});
        break;
      case 'session.stop':
        handleSessionStop(event.payload || {});
        break;
      case 'session.delete':
        handleSessionDelete(event.payload || {});
        break;
      case 'permission.response':
        handlePermissionResponse(event.payload || {});
        break;
      case 'settings.get':
        handleSettingsGet();
        break;
      case 'settings.update':
        handleSettingsUpdate(event.payload || {});
        break;
      case 'settings.permission.clear':
        handlePermissionPolicyClear();
        break;
      case 'skills.list':
        handleSkillsList(event.payload || {});
        break;
      case 'skills.install':
        await handleSkillsInstall(event.payload || {});
        break;
      case 'skills.delete':
        handleSkillsDelete(event.payload || {});
        break;
      case 'skills.open':
        handleSkillsOpen(event.payload || {});
        break;
      case 'skills.expand':
        handleSkillExpand(event.payload || {});
        break;
      case 'skills.openReferenceFolder':
        handleOpenReferenceFolder(event.payload || {});
        break;
      case 'env.check':
        handleEnvCheck();
        break;
      case 'skills.installBundled':
        handleInstallBundledSkills();
        break;
      default:
        send({ type: 'runner.error', payload: { message: `Unknown event type: ${event.type}` } });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    send({ type: 'runner.error', payload: { message: errorMessage } });
  }
}

// Main
async function main(): Promise<void> {
  // Load and apply Claude settings
  settings = loadClaudeSettings();
  applySettings(settings);

  // Initialize SQLite store (async for sql.js)
  store = new SessionStore();
  await store.init();

  // Send settings loaded event
  send({
    type: 'settings.loaded',
    payload: {
      loaded: settings.loaded,
      path: settings.path,
      hasApiKey: !!(settings.env.ANTHROPIC_AUTH_TOKEN || settings.env.ANTHROPIC_API_KEY),
      model: settings.model,
    },
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  // Load sessions from SQLite on startup
  handleSessionList();

  rl.on('line', (line) => {
    if (line.trim()) {
      handleMessage(line).catch((error) => {
        console.error('Unhandled error:', error);
      });
    }
  });

  rl.on('close', () => {
    cleanupAllSessions();
    store.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    cleanupAllSessions();
    store.close();
    process.exit(0);
  });
  process.on('SIGINT', () => {
    cleanupAllSessions();
    store.close();
    process.exit(0);
  });
}

// 清理所有活动会话，中止正在运行的 Claude 进程
function cleanupAllSessions(): void {
  for (const [sessionId, session] of sessions) {
    try {
      session.abortController.abort();
    } catch (e) {
      // 忽略清理错误
    }
  }
  sessions.clear();
}

main();
