/**
 * SQLite-based session persistence store using sql.js (pure JS, no native modules)
 */

// Use sql-asm.js (pure JS, no WASM file needed) for better bundling compatibility
import initSqlJs from 'sql.js/dist/sql-asm.js';
import type { Database as SqlJsDatabase } from 'sql.js';
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
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private saveTimer: NodeJS.Timeout | null = null;
  private initialized = false;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || getDbPath();
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    const SQL = await initSqlJs();

    // Load existing database or create new
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.initSchema();
    this.initialized = true;
  }

  private ensureInit(): void {
    if (!this.db) {
      throw new Error('SessionStore not initialized. Call init() first.');
    }
  }

  private initSchema(): void {
    this.ensureInit();
    this.db!.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT,
        claude_session_id TEXT,
        status TEXT NOT NULL,
        cwd TEXT,
        last_prompt TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.db!.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    this.db!.run(`CREATE INDEX IF NOT EXISTS messages_session_id ON messages(session_id)`);

    this.db!.run(`
      CREATE TABLE IF NOT EXISTS permission_policies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_name TEXT NOT NULL,
        path_pattern TEXT,
        behavior TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.db!.run(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.db!.run(`CREATE INDEX IF NOT EXISTS permission_policies_tool ON permission_policies(tool_name)`);

    // Initialize default permission mode if not exists
    const existing = this.getSetting('permission_mode');
    if (!existing) {
      this.setSetting('permission_mode', 'interactive');
    }

    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => this.saveToFile(), 1000);
  }

  private saveToFile(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  private queryAll<T>(sql: string, params: unknown[] = []): T[] {
    this.ensureInit();
    const stmt = this.db!.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  private queryOne<T>(sql: string, params: unknown[] = []): T | null {
    const results = this.queryAll<T>(sql, params);
    return results[0] || null;
  }

  private execute(sql: string, params: unknown[] = []): void {
    this.ensureInit();
    this.db!.run(sql, params);
    this.scheduleSave();
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

    this.execute(
      `INSERT INTO sessions (id, title, claude_session_id, status, cwd, last_prompt, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [session.id, session.title, session.claude_session_id, session.status, session.cwd, session.last_prompt, session.created_at, session.updated_at]
    );

    return session;
  }

  getSession(id: string): StoredSession | null {
    return this.queryOne<StoredSession>('SELECT * FROM sessions WHERE id = ?', [id]);
  }

  listSessions(): StoredSession[] {
    return this.queryAll<StoredSession>('SELECT * FROM sessions ORDER BY updated_at DESC');
  }

  updateSession(id: string, updates: SessionUpdateOptions): void {
    const session = this.getSession(id);
    if (!session) return;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.claude_session_id !== undefined) {
      fields.push('claude_session_id = ?');
      values.push(updates.claude_session_id);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.last_prompt !== undefined) {
      fields.push('last_prompt = ?');
      values.push(updates.last_prompt);
    }

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    if (fields.length === 1) return; // Only updated_at

    this.execute(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  deleteSession(id: string): void {
    this.execute('DELETE FROM messages WHERE session_id = ?', [id]);
    this.execute('DELETE FROM sessions WHERE id = ?', [id]);
  }

  recordMessage(sessionId: string, message: unknown): void {
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const data = JSON.stringify(message);
    const now = Date.now();

    this.execute(
      `INSERT INTO messages (id, session_id, data, created_at) VALUES (?, ?, ?, ?)`,
      [id, sessionId, data, now]
    );

    this.execute('UPDATE sessions SET updated_at = ? WHERE id = ?', [now, sessionId]);
  }

  getSessionMessages(sessionId: string): unknown[] {
    const rows = this.queryAll<{ data: string }>(
      'SELECT data FROM messages WHERE session_id = ? ORDER BY created_at ASC',
      [sessionId]
    );
    return rows.map((row) => JSON.parse(row.data));
  }

  listRecentCwds(limit: number = 10): string[] {
    const rows = this.queryAll<{ cwd: string }>(
      `SELECT DISTINCT cwd FROM sessions
       WHERE cwd IS NOT NULL AND cwd != ''
       ORDER BY updated_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows.map((row) => row.cwd);
  }

  close(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveToFile();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initialized = false;
  }

  // Settings management
  getSetting(key: string): string | null {
    const row = this.queryOne<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key]);
    return row?.value || null;
  }

  setSetting(key: string, value: string): void {
    const now = Date.now();
    const existing = this.getSetting(key);
    if (existing !== null) {
      this.execute('UPDATE app_settings SET value = ?, updated_at = ? WHERE key = ?', [value, now, key]);
    } else {
      this.execute('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)', [key, value, now]);
    }
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
    return this.queryAll<PermissionPolicy>('SELECT * FROM permission_policies ORDER BY created_at DESC');
  }

  getPermissionPolicy(toolName: string, pathPattern?: string): PermissionPolicy | null {
    if (pathPattern) {
      const row = this.queryOne<PermissionPolicy>(
        'SELECT * FROM permission_policies WHERE tool_name = ? AND path_pattern = ?',
        [toolName, pathPattern]
      );
      if (row) return row;
    }
    return this.queryOne<PermissionPolicy>(
      'SELECT * FROM permission_policies WHERE tool_name = ? AND path_pattern IS NULL',
      [toolName]
    );
  }

  addPermissionPolicy(toolName: string, behavior: 'always_allow' | 'always_deny' | 'ask', pathPattern?: string): void {
    const now = Date.now();
    this.execute(
      `INSERT INTO permission_policies (tool_name, path_pattern, behavior, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [toolName, pathPattern || null, behavior, now, now]
    );
  }

  deletePermissionPolicy(id: number): void {
    this.execute('DELETE FROM permission_policies WHERE id = ?', [id]);
  }

  clearAllPermissionPolicies(): void {
    this.execute('DELETE FROM permission_policies');
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
