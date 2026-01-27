import type { Artifact, ArtifactType, MessageContent } from '../types';

const MAX_ARTIFACT_CONTENT_CHARS = 300_000;

function createArtifactId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getFileExtension(filePath: string): string {
  const base = filePath.split('/').pop() || filePath;
  const lastDot = base.lastIndexOf('.');
  return lastDot >= 0 ? base.slice(lastDot + 1).toLowerCase() : '';
}

function looksLikeUnifiedDiff(text: string): boolean {
  const trimmed = text.trimStart();
  return (
    trimmed.startsWith('diff --git ') ||
    trimmed.startsWith('--- ') ||
    trimmed.startsWith('+++ ') ||
    /\n@@\s-\d+,\d+\s\+\d+,\d+\s@@/.test(text)
  );
}

function looksLikeSrtOrVtt(text: string): boolean {
  // SRT: 00:00:01,000 --> 00:00:02,000
  // VTT: 00:00:01.000 --> 00:00:02.000
  return /\d{2}:\d{2}:\d{2}[,.]\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}[,.]\d{3}/.test(text);
}

function looksLikeDataUrlImage(value: string): boolean {
  return value.startsWith('data:image/');
}

function inferArtifactTypeFromJson(value: unknown): ArtifactType {
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
    return 'directory-tree';
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const before = obj['before'];
    const after = obj['after'];
    if (typeof before === 'string' && typeof after === 'string') {
      if (looksLikeDataUrlImage(before) && looksLikeDataUrlImage(after)) {
        return 'image-compare';
      }
    }

    const paths = obj['paths'];
    if (Array.isArray(paths) && paths.every((p) => typeof p === 'string')) {
      return 'directory-tree';
    }
  }

  return 'json';
}

function inferArtifactType(
  filePath: string,
  content: string
): { type: ArtifactType; language?: string } {
  const ext = getFileExtension(filePath);
  const trimmed = content.trimStart();

  if (ext === 'html' || ext === 'htm') return { type: 'html', language: 'html' };
  if (ext === 'svg') return { type: 'html', language: 'svg' };
  if (ext === 'mmd' || filePath.toLowerCase().includes('mermaid'))
    return { type: 'mermaid', language: 'mermaid' };
  if (ext === 'md' || ext === 'markdown') return { type: 'markdown', language: 'markdown' };
  if (ext === 'csv') return { type: 'csv', language: 'csv' };
  if (ext === 'diff' || ext === 'patch') return { type: 'diff', language: 'diff' };
  if (ext === 'srt' || ext === 'vtt') return { type: 'srt', language: ext };
  if (ext === 'tree') return { type: 'directory-tree', language: 'tree' };

  if (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<svg') ||
    trimmed.startsWith('<?xml')
  ) {
    return {
      type: 'html',
      language: trimmed.startsWith('<svg') || trimmed.startsWith('<?xml') ? 'svg' : 'html',
    };
  }

  if (looksLikeUnifiedDiff(content)) return { type: 'diff', language: 'diff' };
  if (looksLikeSrtOrVtt(content)) return { type: 'srt', language: 'srt' };

  if (ext === 'json' || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(content);
      const type = inferArtifactTypeFromJson(parsed);
      return { type, language: 'json' };
    } catch {
      // fall through
    }
  }

  return { type: 'code', language: ext || undefined };
}

export function artifactsFromWriteToolUse(
  sessionId: string,
  filePath: string,
  fileContent: string
): Artifact[] {
  const { type, language } = inferArtifactType(filePath, fileContent);
  const title = filePath.split('/').pop() || filePath;

  const truncated = fileContent.length > MAX_ARTIFACT_CONTENT_CHARS;
  const content = truncated
    ? fileContent.slice(0, MAX_ARTIFACT_CONTENT_CHARS) + '\n…'
    : fileContent;

  return [
    {
      id: createArtifactId(),
      sessionId,
      type,
      language,
      title,
      content,
      createdAt: Date.now(),
      source: 'auto',
      meta: {
        filePath,
        truncated,
      },
    },
  ];
}

export function artifactsFromAssistantContent(
  sessionId: string,
  contentBlocks: MessageContent[]
): Artifact[] {
  const artifacts: Artifact[] = [];

  for (const block of contentBlocks) {
    if (block.type !== 'tool_use') continue;
    if (block.name !== 'Write') continue;

    const filePathValue = block.input['file_path'];
    const fileContentValue = block.input['content'];
    if (typeof filePathValue !== 'string' || typeof fileContentValue !== 'string') continue;

    artifacts.push(...artifactsFromWriteToolUse(sessionId, filePathValue, fileContentValue));
  }

  return artifacts;
}
