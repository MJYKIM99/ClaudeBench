import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Check, ChevronDown, GitBranch, GitCommitHorizontal, RefreshCw, X } from 'lucide-react';

import { useAppStore } from '../store/useAppStore';
import type { GitBranch as GitBranchType, GitStatus } from '../types';
import { GitCommitDialog } from './GitCommitDialog';

import './GitStatusBar.css';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  message: string;
  type: ToastType;
}

export function GitStatusBar() {
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const sessions = useAppStore((s) => s.sessions);
  const cwd = activeSessionId ? sessions[activeSessionId]?.cwd : null;

  const [status, setStatus] = useState<GitStatus | null>(null);
  const [branches, setBranches] = useState<GitBranchType[]>([]);
  const [isGitRepo, setIsGitRepo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<'pull' | 'push' | null>(null);
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const branchMenuRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchStatus = useCallback(async () => {
    if (!cwd) {
      setIsGitRepo(false);
      return;
    }
    setLoading(true);
    try {
      const result = await invoke<GitStatus>('git_status', { cwd });
      setStatus(result);
      setIsGitRepo(true);
    } catch (e: unknown) {
      const errMsg = String(e);
      if (errMsg.includes('not a git repository') || errMsg.includes('fatal:')) {
        setIsGitRepo(false);
      }
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [cwd]);

  const fetchBranches = useCallback(async () => {
    if (!cwd) return;
    try {
      const result = await invoke<GitBranchType[]>('git_branches', { cwd });
      setBranches(result.filter((b) => !b.name.includes('remotes/')));
    } catch {
      // ignore
    }
  }, [cwd]);

  const handlePull = async () => {
    if (!cwd || syncing) return;
    setSyncing('pull');
    try {
      await invoke('git_pull', { cwd });
      showToast('Pulled successfully', 'success');
      await fetchStatus();
    } catch (e) {
      showToast(`Pull failed: ${e}`, 'error');
    } finally {
      setSyncing(null);
    }
  };

  const handlePush = async () => {
    if (!cwd || syncing) return;
    setSyncing('push');
    try {
      await invoke('git_push', { cwd });
      showToast('Pushed successfully', 'success');
      await fetchStatus();
    } catch (e) {
      showToast(`Push failed: ${e}`, 'error');
    } finally {
      setSyncing(null);
    }
  };

  const handleCheckout = async (branch: string) => {
    if (!cwd) return;
    setShowBranchMenu(false);
    try {
      await invoke('git_checkout', { cwd, branch });
      showToast(`Switched to ${branch}`, 'success');
      await fetchStatus();
    } catch (e) {
      showToast(`Switch failed: ${e}`, 'error');
    }
  };

  const handleBranchClick = () => {
    if (!showBranchMenu) {
      fetchBranches();
    }
    setShowBranchMenu(!showBranchMenu);
  };

  // Close branch menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (branchMenuRef.current && !branchMenuRef.current.contains(e.target as Node)) {
        setShowBranchMenu(false);
      }
    };
    if (showBranchMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBranchMenu]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus, cwd]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!isGitRepo) return;
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus, isGitRepo]);

  if (!cwd || !isGitRepo) return null;

  const changesCount =
    (status?.staged?.length || 0) +
    (status?.unstaged?.length || 0) +
    (status?.untracked?.length || 0);

  return (
    <div className="git-statusbar">
      {/* Branch selector */}
      <div className="git-branch-selector" ref={branchMenuRef}>
        <button className="git-branch-btn" onClick={handleBranchClick}>
          <GitBranch size={12} />
          <span>{status?.branch || 'unknown'}</span>
          <ChevronDown size={10} />
        </button>

        {showBranchMenu && (
          <div className="git-branch-menu">
            <div className="git-branch-menu-header">Switch branch</div>
            {branches.length === 0 ? (
              <div className="git-branch-menu-empty">No branches</div>
            ) : (
              branches.map((branch) => (
                <button
                  key={branch.name}
                  className={`git-branch-menu-item ${branch.isCurrent ? 'current' : ''}`}
                  onClick={() => !branch.isCurrent && handleCheckout(branch.name)}
                  disabled={branch.isCurrent}
                >
                  {branch.isCurrent && <Check size={12} />}
                  <span>{branch.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Sync buttons */}
      <div className="git-sync-group">
        {(status?.behind ?? 0) > 0 && (
          <button
            className="git-sync-btn pull"
            onClick={handlePull}
            disabled={!!syncing}
            title={`Pull ${status?.behind} commits from remote`}
          >
            {syncing === 'pull' ? (
              <RefreshCw size={11} className="spinning" />
            ) : (
              <>↓ {status?.behind}</>
            )}
          </button>
        )}
        {(status?.ahead ?? 0) > 0 && (
          <button
            className="git-sync-btn push"
            onClick={handlePush}
            disabled={!!syncing}
            title={`Push ${status?.ahead} commits to remote`}
          >
            {syncing === 'push' ? (
              <RefreshCw size={11} className="spinning" />
            ) : (
              <>↑ {status?.ahead}</>
            )}
          </button>
        )}
      </div>

      {/* Commit button - show when there are changes */}
      {changesCount > 0 && (
        <button
          className="git-commit-btn"
          onClick={() => setShowCommitDialog(true)}
          title="Commit changes"
        >
          <GitCommitHorizontal size={12} />
          <span>● {changesCount}</span>
        </button>
      )}

      {/* Refresh */}
      <button className="git-refresh-btn" onClick={fetchStatus} disabled={loading} title="Refresh">
        <RefreshCw size={11} className={loading ? 'spinning' : ''} />
      </button>

      {/* Toast notification */}
      {toast && (
        <div className={`git-toast ${toast.type}`}>
          {toast.type === 'success' && <Check size={12} />}
          {toast.type === 'error' && <X size={12} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Commit dialog */}
      {cwd && (
        <GitCommitDialog
          open={showCommitDialog}
          onClose={() => setShowCommitDialog(false)}
          cwd={cwd}
          changedFiles={[
            ...(status?.staged || []).map((f) => ({ ...f, type: 'staged' as const })),
            ...(status?.unstaged || []).map((f) => ({ ...f, type: 'unstaged' as const })),
            ...(status?.untracked || []).map((p) => ({
              path: p,
              status: '?',
              type: 'untracked' as const,
            })),
          ]}
          onCommitSuccess={() => {
            showToast('Committed successfully', 'success');
            fetchStatus();
          }}
        />
      )}
    </div>
  );
}
