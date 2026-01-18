/**
 * Claude Code settings reader
 * Reads ~/.claude/settings.json and applies environment variables
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ClaudeSettings {
  env?: Record<string, string>;
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  model?: string;
}

export interface LoadedSettings {
  loaded: boolean;
  path: string | null;
  env: Record<string, string>;
  model?: string;
}

function getSettingsPath(): string {
  const home = process.env.HOME || '';
  return path.join(home, '.claude', 'settings.json');
}

export function loadClaudeSettings(): LoadedSettings {
  const settingsPath = getSettingsPath();

  if (!fs.existsSync(settingsPath)) {
    return {
      loaded: false,
      path: null,
      env: {},
    };
  }

  try {
    const content = fs.readFileSync(settingsPath, 'utf-8');
    const settings: ClaudeSettings = JSON.parse(content);

    const envVars: Record<string, string> = {};

    // Extract environment variables
    if (settings.env) {
      const importantKeys = [
        'ANTHROPIC_AUTH_TOKEN',
        'ANTHROPIC_API_KEY',
        'ANTHROPIC_BASE_URL',
        'ANTHROPIC_MODEL',
        'ANTHROPIC_DEFAULT_SONNET_MODEL',
        'API_TIMEOUT_MS',
        'CLAUDE_CODE_MAX_TOKENS',
      ];

      for (const key of importantKeys) {
        if (settings.env[key]) {
          envVars[key] = settings.env[key];
        }
      }
    }

    return {
      loaded: true,
      path: settingsPath,
      env: envVars,
      model: settings.model,
    };
  } catch (error) {
    // Silent fail - settings file might be malformed
    return {
      loaded: false,
      path: settingsPath,
      env: {},
    };
  }
}

export function applySettings(settings: LoadedSettings): void {
  // Apply environment variables to process.env
  for (const [key, value] of Object.entries(settings.env)) {
    if (value && !process.env[key]) {
      process.env[key] = value;
    }
  }
}
