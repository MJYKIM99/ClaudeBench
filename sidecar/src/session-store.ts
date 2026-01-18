/**
 * SQLite-based session persistence store
 */

import Database, { type Database as DatabaseType } from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

// Permission mode types
export type PermissionMode = 'interactive' | 'auto-safe' | 'bypass';

export interface PermissionPolicy {
  id: number;
  tool_name: string;
  path_pattern: string | null;
  behavior: 'always_allow' | 'always_deny' | 'ask';
  created_at: number;
  updated_at: number;
}

export interface AppSettings {
  id: number;
  key: string;
  value: string;
  updated_at: number;
}

// Types
export interface StoredSession {
  id: string;
  title: string;
  claude_session_id: string | null;
  status: 'idle' | 'running' | 'completed' | 'error';
  cwd: string | null;
  last_prompt: string | null;
  created_at: number;
  updated_at: number;
}

export interface StoredMessage {
  id: string;
  session_id: string;
  data: string;
  created_at: number;
}

export interface SessionCreateOptions {
  id: string;
  title: string;
  cwd?: string;
  status?: StoredSession['status'];
}

export interface SessionUpdateOptions {
  title?: string;
  claude_session_id?: string;
  status?: StoredSession['status'];
  last_prompt?: string;
}

function getDbPath(): string {
  const home = process.env.HOME || '';
  const dir = path.join(home, '.claude-gui');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'sessions.db');
}

export class SessionStore {
  private db: DatabaseType;

  constructor(dbPath?: string) {
    const dbFile = dbPath || getDbPath();
    this.db = new Database(dbFile);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT,
        claude_session_id TEXT,
        status TEXT NOT NULL,
        cwd TEXT,
        last_prompt TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS messages_session_id ON messages(session_id);

      CREATE TABLE IF NOT EXISTS permission_policies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_name TEXT NOT NULL,
        path_pattern TEXT,
        behavior TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS permission_policies_tool ON permission_policies(tool_name);
    `);

    // Initialize default permission mode if not exists
    const existing = this.getSetting('permission_mode');
    if (!existing) {
      this.setSetting('permission_mode', 'interactive');
    }
  }

  createSession(options: SessionCreateOptions): StoredSession {
    const now = Date.now();
    const session: StoredSession = {
      id: options.id,
      title: options.title,
      claude_session_id: null,
      status: options.status || 'idle',
      cwd: options.cwd || null,
      last_prompt: null,
      created_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, title, claude_session_id, status, cwd, last_prompt, created_at, updated_at)
      VALUES (@id, @title, @claude_session_id, @status, @cwd, @last_prompt, @created_at, @updated_at)
    `);

    stmt.run(session);
    return session;
  }

  getSession(id: string): StoredSession | null {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    const row = stmt.get(id) as StoredSession | undefined;
    return row || null;
  }

  listSessions(): StoredSession[] {
    const stmt = this.db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC');
    return stmt.all() as StoredSession[];
  }

  updateSession(id: string, updates: SessionUpdateOptions): void {
    const session = this.getSession(id);
    if (!session) return;

    const fields: string[] = [];
    const values: Record<string, unknown> = { id };

    if (updates.title !== undefined) {
      fields.push('title = @title');
      values.title = updates.title;
    }
    if (updates.claude_session_id !== undefined) {
      fields.push('claude_session_id = @claude_session_id');
      values.claude_session_id = updates.claude_session_id;
    }
    if (updates.status !== undefined) {
      fields.push('status = @status');
      values.status = updates.status;
    }
    if (updates.last_prompt !== undefined) {
      fields.push('last_prompt = @last_prompt');
      values.last_prompt = updates.last_prompt;
    }

    fields.push('updated_at = @updated_at');
    values.updated_at = Date.now();

    if (fields.length === 0) return;

    const stmt = this.db.prepare(`
      UPDATE sessions SET ${fields.join(', ')} WHERE id = @id
    `);
    stmt.run(values);
  }

  deleteSession(id: string): void {
    const deleteMessages = this.db.prepare('DELETE FROM messages WHERE session_id = ?');
    const deleteSession = this.db.prepare('DELETE FROM sessions WHERE id = ?');

    const transaction = this.db.transaction(() => {
      deleteMessages.run(id);
      deleteSession.run(id);
    });

    transaction();
  }

  recordMessage(sessionId: string, message: unknown): void {
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const data = JSON.stringify(message);
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO messages (id, session_id, data, created_at)
      VALUES (@id, @session_id, @data, @created_at)
    `);

    stmt.run({ id, session_id: sessionId, data, created_at: now });

    // Also update session timestamp
    const updateStmt = this.db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?');
    updateStmt.run(now, sessionId);
  }

  getSessionMessages(sessionId: string): unknown[] {
    const stmt = this.db.prepare(
      'SELECT data FROM messages WHERE session_id = ? ORDER BY created_at ASC'
    );
    const rows = stmt.all(sessionId) as { data: string }[];
    return rows.map((row) => JSON.parse(row.data));
  }

  listRecentCwds(limit: number = 10): string[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT cwd FROM sessions
      WHERE cwd IS NOT NULL AND cwd != ''
      ORDER BY updated_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as { cwd: string }[];
    return rows.map((row) => row.cwd);
  }

  close(): void {
    this.db.close();
  }

  // Settings management
  getSetting(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM app_settings WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value || null;
  }

  setSetting(key: string, value: string): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (@key, @value, @updated_at)
      ON CONFLICT(key) DO UPDATE SET value = @value, updated_at = @updated_at
    `);
    stmt.run({ key, value, updated_at: now });
  }

  getPermissionMode(): PermissionMode {
    const mode = this.getSetting('permission_mode');
    if (mode === 'bypass' || mode === 'auto-safe' || mode === 'interactive') {
      return mode;
    }
    return 'interactive';
  }

  setPermissionMode(mode: PermissionMode): void {
    this.setSetting('permission_mode', mode);
  }

  // Permission policies
  getPermissionPolicies(): PermissionPolicy[] {
    const stmt = this.db.prepare('SELECT * FROM permission_policies ORDER BY created_at DESC');
    return stmt.all() as PermissionPolicy[];
  }

  getPermissionPolicy(toolName: string, pathPattern?: string): PermissionPolicy | null {
    let stmt;
    if (pathPattern) {
      stmt = this.db.prepare('SELECT * FROM permission_policies WHERE tool_name = ? AND path_pattern = ?');
      const row = stmt.get(toolName, pathPattern) as PermissionPolicy | undefined;
      if (row) return row;
    }
    // Fall back to tool-only policy
    stmt = this.db.prepare('SELECT * FROM permission_policies WHERE tool_name = ? AND path_pattern IS NULL');
    const row = stmt.get(toolName) as PermissionPolicy | undefined;
    return row || null;
  }

  addPermissionPolicy(toolName: string, behavior: 'always_allow' | 'always_deny' | 'ask', pathPattern?: string): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO permission_policies (tool_name, path_pattern, behavior, created_at, updated_at)
      VALUES (@tool_name, @path_pattern, @behavior, @created_at, @updated_at)
    `);
    stmt.run({
      tool_name: toolName,
      path_pattern: pathPattern || null,
      behavior,
      created_at: now,
      updated_at: now,
    });
  }

  deletePermissionPolicy(id: number): void {
    const stmt = this.db.prepare('DELETE FROM permission_policies WHERE id = ?');
    stmt.run(id);
  }

  clearAllPermissionPolicies(): void {
    this.db.exec('DELETE FROM permission_policies');
  }

  // Protected paths (sensitive directories that should always require confirmation)
  getProtectedPaths(): string[] {
    const stored = this.getSetting('protected_paths');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return this.getDefaultProtectedPaths();
      }
    }
    return this.getDefaultProtectedPaths();
  }

  private getDefaultProtectedPaths(): string[] {
    return [
      '~/.ssh',
      '~/.aws',
      '~/.gnupg',
      '~/.config',
      '/etc',
      '/System',
      '/Library',
    ];
  }

  setProtectedPaths(paths: string[]): void {
    this.setSetting('protected_paths', JSON.stringify(paths));
  }

  isProtectedPath(filePath: string): boolean {
    const protectedPaths = this.getProtectedPaths();
    const home = process.env.HOME || '';

    for (const protectedPath of protectedPaths) {
      const expandedPath = protectedPath.replace(/^~/, home);
      if (filePath.startsWith(expandedPath)) {
        return true;
      }
    }
    return false;
  }
}
