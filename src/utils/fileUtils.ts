import { invoke } from '@tauri-apps/api/core';

export async function saveArtifact(
  cwd: string,
  content: string,
  filename?: string
): Promise<string> {
  const name = filename || `message-${Date.now()}.md`;
  const filePath = await invoke<string>('save_artifact', {
    cwd,
    content,
    filename: name,
  });
  return filePath;
}
