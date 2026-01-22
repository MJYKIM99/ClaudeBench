/**
 * Session Title Generator
 * Generates concise titles for chat sessions using Claude
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

export async function generateSessionTitle(
  userPrompt: string,
  assistantResponse: string,
  claudeCodePath: string
): Promise<string | null> {
  if (!claudeCodePath) return null;

  try {
    const truncatedPrompt = userPrompt.slice(0, 500);
    const truncatedResponse = assistantResponse.slice(0, 500);

    const titleRequest = [
      'Based on the following conversation, generate a very short title (max 20 characters, in the same language as the user message).',
      'Output ONLY the title, nothing else. No quotes, no explanation.',
      '',
      'User: ' + truncatedPrompt,
      '',
      'Assistant: ' + truncatedResponse,
    ].join('\n');

    const q = query({
      prompt: titleRequest,
      options: {
        pathToClaudeCodeExecutable: claudeCodePath,
        maxTurns: 1,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
      },
    });

    let generatedTitle = '';

    for await (const message of q) {
      if (message.type === 'assistant') {
        // Structure: message.message.content[].text
        if ('message' in message) {
          const msg = (message as { message: { content: Array<{ type: string; text?: string }> } }).message;
          if (msg && msg.content) {
            for (const block of msg.content) {
              if (block.type === 'text' && block.text) {
                generatedTitle += block.text;
              }
            }
          }
        }
      }
    }

    generatedTitle = generatedTitle.trim();

    // Remove quotes if present
    if ((generatedTitle.startsWith('"') && generatedTitle.endsWith('"')) ||
        (generatedTitle.startsWith("'") && generatedTitle.endsWith("'"))) {
      generatedTitle = generatedTitle.slice(1, -1);
    }

    // Limit length
    if (generatedTitle.length > 30) {
      generatedTitle = generatedTitle.slice(0, 27) + '...';
    }

    return generatedTitle || null;
  } catch {
    return null;
  }
}
