#!/usr/bin/env node
/**
 * Simple test to verify Claude Agent SDK works
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

async function main() {
  console.log('Testing Claude Agent SDK...');
  console.log('CWD:', process.cwd());

  try {
    const q = query({
      prompt: 'Say "Hello from Claude Agent SDK!" and nothing else.',
      options: {
        cwd: process.cwd(),
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        maxTurns: 1,
      },
    });

    let messageCount = 0;
    for await (const message of q) {
      messageCount++;
      console.log(`Message ${messageCount}:`, JSON.stringify(message, null, 2));

      if (message.type === 'result') {
        console.log('\n=== Result ===');
        console.log('Success:', message.subtype === 'success');
        break;
      }
    }

    console.log('\n✅ SDK test completed successfully!');
  } catch (error) {
    console.error('❌ SDK test failed:', error);
    process.exit(1);
  }
}

main();
