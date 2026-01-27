import { useMemo, useState } from 'react';

import './ArtifactPreview.css';

interface SrtPreviewProps {
  content: string;
}

interface Cue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

function parseTimestampToMs(input: string): number | null {
  // 00:00:01,000 or 00:00:01.000
  const match = /^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})$/.exec(input.trim());
  if (!match) return null;
  const [, hh, mm, ss, ms] = match;
  return Number(hh) * 60 * 60 * 1000 + Number(mm) * 60 * 1000 + Number(ss) * 1000 + Number(ms);
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  const mmm = ms % 1000;
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}.${pad(mmm, 3)}`;
}

function parseSrtOrVtt(raw: string): Cue[] {
  let text = raw.replace(/\r\n/g, '\n').trim();
  if (text.startsWith('WEBVTT')) {
    text = text.replace(/^WEBVTT[^\n]*\n+/, '').trim();
  }

  const blocks = text.split(/\n{2,}/g);
  const cues: Cue[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    if (lines.length < 2) continue;

    let idx = 0;
    let timeLineIndex = 0;

    // Optional cue number
    const maybeNumber = Number(lines[0]);
    if (!Number.isNaN(maybeNumber) && /^\d+$/.test(lines[0])) {
      idx = maybeNumber;
      timeLineIndex = 1;
    } else {
      idx = cues.length + 1;
      timeLineIndex = 0;
    }

    const timeLine = lines[timeLineIndex];
    const match = /(.+?)\s+-->\s+(.+?)(?:\s+.*)?$/.exec(timeLine);
    if (!match) continue;

    const start = parseTimestampToMs(match[1]);
    const end = parseTimestampToMs(match[2]);
    if (start === null || end === null) continue;

    const cueText = lines
      .slice(timeLineIndex + 1)
      .join('\n')
      .trim();
    cues.push({ index: idx, startMs: start, endMs: end, text: cueText });
  }

  return cues;
}

export function SrtPreview({ content }: SrtPreviewProps) {
  const [search, setSearch] = useState('');

  const cues = useMemo(() => parseSrtOrVtt(content), [content]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cues;
    return cues.filter((c) => c.text.toLowerCase().includes(q));
  }, [cues, search]);

  return (
    <div className="srt-preview">
      <div className="srt-toolbar">
        <input
          type="text"
          placeholder="Search subtitles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="srt-stats">
          {filtered.length}/{cues.length}
        </div>
      </div>

      {cues.length === 0 ? (
        <div className="srt-empty">No cues detected.</div>
      ) : (
        <div className="srt-table">
          <div className="srt-row srt-header">
            <div>#</div>
            <div>Start</div>
            <div>End</div>
            <div>Text</div>
          </div>
          {filtered.map((cue) => (
            <div key={`${cue.index}-${cue.startMs}`} className="srt-row">
              <div className="srt-cell srt-index">{cue.index}</div>
              <div className="srt-cell srt-time">{formatMs(cue.startMs)}</div>
              <div className="srt-cell srt-time">{formatMs(cue.endMs)}</div>
              <div className="srt-cell srt-text">{cue.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
