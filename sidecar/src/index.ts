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

interface SkillInfo {
  name: string;
  description?: string;
  path: string;
  source: 'global' | 'project';
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
function parseSkillMetadata(skillPath: string): { name: string; description?: string } | null {
  const skillMdPath = path.join(skillPath, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    return { name: path.basename(skillPath) };
  }

  try {
    const content = fs.readFileSync(skillMdPath, 'utf-8');
    const lines = content.split('\n');

    let name = path.basename(skillPath);
    let description: string | undefined;
    let inFrontmatter = false;

    for (const line of lines) {
      if (line.trim() === '---') {
        if (!inFrontmatter) {
          inFrontmatter = true;
          continue;
        } else {
          break;
        }
      }

      if (inFrontmatter) {
        const nameMatch = line.match(/^name:\s*(.+)$/);
        if (nameMatch) {
          name = nameMatch[1].trim().replace(/^["']|["']$/g, '');
        }
        const descMatch = line.match(/^description:\s*(.+)$/);
        if (descMatch) {
          description = descMatch[1].trim().replace(/^["']|["']$/g, '');
        }
      }
    }

    return { name, description };
  } catch {
    return { name: path.basename(skillPath) };
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
            name: metadata.name,
            description: metadata.description,
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
      messages: store.getSessionMessages(sessionId),
      abortController: new AbortController(),
      pendingPermissions: new Map(),
    };
    sessions.set(sessionId, session);
  }

  // Check if we have a claudeSessionId to resume
  if (!session.info.claudeSessionId) {
    send({ type: 'runner.error', payload: { sessionId, message: 'Session has no resume id yet. Cannot continue.' } });
    return;
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

  // Use claudeSessionId for resume
  await runQuery(session, prompt, session.info.cwd || process.cwd(), session.info.claudeSessionId, attachments);
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
