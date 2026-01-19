import { invoke } from '@tauri-apps/api/core';

/**
 * 在 Finder 中显示路径
 */
export async function revealInFinder(path: string): Promise<void> {
  try {
    await invoke('reveal_in_finder', { path });
  } catch (e) {
    console.error('Failed to reveal in Finder:', e);
  }
}

/**
 * 检测字符串中的路径
 * 匹配以 / 开头的绝对路径或 ~/ 开头的用户目录路径
 */
export function extractPaths(text: string): string[] {
  // 匹配绝对路径 (以 / 开头) 或用户路径 (以 ~/ 开头)
  const pathRegex = /(?:^|\s)((?:\/|~\/)[^\s"'`<>|*?\n]+)/g;
  const matches: string[] = [];
  let match;

  while ((match = pathRegex.exec(text)) !== null) {
    let path = match[1].trim();
    // 移除末尾的标点符号
    path = path.replace(/[,.:;)}\]]+$/, '');
    if (path.length > 1) {
      matches.push(path);
    }
  }

  return [...new Set(matches)]; // 去重
}

/**
 * 处理 Cmd+Click 打开路径
 */
export function handlePathClick(
  event: React.MouseEvent,
  path: string
): boolean {
  if (event.metaKey) {
    event.preventDefault();
    event.stopPropagation();
    revealInFinder(path);
    return true;
  }
  return false;
}
