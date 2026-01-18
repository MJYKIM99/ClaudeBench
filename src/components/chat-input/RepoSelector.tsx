import { useState, useRef, useEffect, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useAppStore } from '../../store/useAppStore';
import './RepoSelector.css';

interface RepoInfo {
  path: string;
  name: string;
}

export function RepoSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const cwd = useAppStore((s) => s.cwd);
  const setCwd = useAppStore((s) => s.setCwd);

  // Load recent repos from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentRepos');
    if (saved) {
      try {
        setRepos(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveRepos = useCallback((newRepos: RepoInfo[]) => {
    setRepos(newRepos);
    localStorage.setItem('recentRepos', JSON.stringify(newRepos.slice(0, 10)));
  }, []);

  const handleSelectRepo = useCallback((repo: RepoInfo) => {
    setCwd(repo.path);
    // Move to top of list
    const updated = [repo, ...repos.filter((r) => r.path !== repo.path)];
    saveRepos(updated);
    setIsOpen(false);
  }, [repos, setCwd, saveRepos]);

  const handleAddRepo = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Repository',
      });

      if (selected && typeof selected === 'string') {
        const name = selected.split('/').pop() || selected;
        const newRepo: RepoInfo = { path: selected, name };
        handleSelectRepo(newRepo);
      }
    } catch (e) {
      console.error('Failed to open directory picker:', e);
    }
  }, [handleSelectRepo]);

  const currentRepo = repos.find((r) => r.path === cwd);
  const displayName = currentRepo?.name || (cwd ? cwd.split('/').pop() : 'Select folder');

  const filteredRepos = searchQuery
    ? repos.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : repos;

  return (
    <div className="repo-selector-container" ref={containerRef}>
      <button
        className="repo-selector-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg className="repo-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4h12M2 4v8a2 2 0 002 2h8a2 2 0 002-2V4M2 4l2-2h8l2 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="repo-name">{displayName}</span>
        <svg className="repo-chevron" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>

      {isOpen && (
        <div className="repo-selector-dropdown">
          <div className="repo-search">
            <svg className="search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="6" cy="6" r="4" />
              <path d="M9 9l3 3" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search repos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          <div className="repo-list">
            {filteredRepos.length === 0 && !searchQuery && (
              <div className="repo-empty">No repositories yet</div>
            )}
            {filteredRepos.map((repo) => (
              <button
                key={repo.path}
                className={`repo-option ${repo.path === cwd ? 'selected' : ''}`}
                onClick={() => handleSelectRepo(repo)}
              >
                <svg className="repo-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 4h12M2 4v8a2 2 0 002 2h8a2 2 0 002-2V4M2 4l2-2h8l2 2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="repo-option-name">{repo.name}</span>
                {repo.path === cwd && (
                  <svg className="check-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 7l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <button className="repo-add" onClick={handleAddRepo}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 2v10M2 7h10" strokeLinecap="round" />
            </svg>
            Add repository
          </button>
        </div>
      )}
    </div>
  );
}
