import { useMemo, useState } from 'react';

import './ArtifactPreview.css';

interface DirectoryTreePreviewProps {
  content: string;
}

interface TreeNode {
  name: string;
  children: TreeNode[];
  isFile: boolean;
  path: string;
}

function parsePathsFromContent(content: string): string[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
      return parsed as string[];
    }
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const paths = obj['paths'];
      if (Array.isArray(paths) && paths.every((p) => typeof p === 'string')) {
        return paths as string[];
      }
    }
  } catch {
    // fall through
  }

  return trimmed
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[•*-]\s+/, ''))
    .map((l) => l.replace(/^(\||├|└|─|│|\s)+/, ''))
    .map((l) => l.replace(/\\/g, '/'));
}

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: '/', children: [], isFile: false, path: '/' };

  const ensureChild = (parent: TreeNode, name: string, fullPath: string, isFile: boolean) => {
    const existing = parent.children.find((c) => c.name === name);
    if (existing) {
      if (isFile) existing.isFile = true;
      return existing;
    }
    const node: TreeNode = { name, children: [], isFile, path: fullPath };
    parent.children.push(node);
    return node;
  };

  for (const raw of paths) {
    const clean = raw.trim();
    if (!clean) continue;

    const normalized = clean.replace(/^~\//, '/').replace(/\/+$/g, '');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length === 0) continue;

    let current = root;
    let currentPath = '';

    parts.forEach((part, idx) => {
      currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;
      const isLast = idx === parts.length - 1;
      const isFile = isLast && /\.[a-z0-9]+$/i.test(part);
      current = ensureChild(current, part, currentPath, isFile);
    });
  }

  const sortNode = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortNode);
  };
  sortNode(root);

  return root;
}

function TreeItem({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(depth < 2);

  const hasChildren = node.children.length > 0;
  const icon = node.isFile ? '📄' : '📁';

  return (
    <div className="tree-item">
      <div className="tree-row" style={{ paddingLeft: depth * 14 }}>
        {hasChildren ? (
          <button
            type="button"
            className="tree-toggle"
            onClick={() => setOpen((v) => !v)}
            title={open ? 'Collapse' : 'Expand'}
          >
            {open ? '▼' : '▶'}
          </button>
        ) : (
          <span className="tree-toggle-spacer" />
        )}
        <span className="tree-icon">{icon}</span>
        <span className="tree-name">{node.name}</span>
      </div>
      {hasChildren && open && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeItem key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DirectoryTreePreview({ content }: DirectoryTreePreviewProps) {
  const paths = useMemo(() => parsePathsFromContent(content), [content]);
  const tree = useMemo(() => buildTree(paths), [paths]);

  if (paths.length === 0) {
    return <div className="tree-empty">No paths detected.</div>;
  }

  return (
    <div className="tree-preview">
      <div className="tree-meta">{paths.length} paths</div>
      <div className="tree-container">
        {tree.children.map((child) => (
          <TreeItem key={child.path} node={child} depth={0} />
        ))}
      </div>
    </div>
  );
}
