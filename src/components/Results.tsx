import { useEffect, useMemo, useState } from 'react';
import type { RoomState } from '../firebase/hooks';
import { fetchKey, playAgain } from '../firebase/rooms';
import { computeStats, type AwardId } from '../lib/stats';
import { formatDuration } from '../lib/time';
import { Board } from './Board';
import { Timeline } from './Timeline';
import { usePlayerLookup } from './useGame';

interface Props {
  code: string;
  room: RoomState;
  isHost: boolean;
  tv?: boolean;
}

const AWARD_ICONS: Record<AwardId, string> = {
  mvp: '🏆',
  firstBlood: '⚡',
  closer: '🔒',
  buzzerBeater: '⏱️',
  hotStreak: '🔥',
};

export function Results({ code, room, isHost, tv = false }: Props) {
  const meta = room.meta!;
  const lookup = usePlayerLookup(room.players);
  const [key, setKey] = useState<string[] | undefined>();
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchKey(code).then(setKey).catch(() => setKey([]));
  }, [code, meta.startedAt]);

  const startedAt = meta.startedAt ?? 0;
  const stats = useMemo(
    () =>
      computeStats({
        finds: [...room.found].map(([slot, f]) => ({ slot, uid: f.uid, at: f.at, display: f.display })),
        players: room.players.map((p) => ({ uid: p.uid, name: p.name, color: p.color })),
        startedAt,
        endedAt: meta.endedAt,
        timeLimitSeconds: meta.timeLimitSeconds ?? 0,
        slotCount: meta.slotCount ?? 0,
      }),
    [room.found, room.players, startedAt, meta.endedAt, meta.timeLimitSeconds, meta.slotCount],
  );

  const missesByPlayer = useMemo(() => {
    const m = new Map<string, string[]>();
    room.misses.forEach((miss) => m.set(miss.uid, [...(m.get(miss.uid) ?? []), miss.text]));
    return [...m];
  }, [room.misses]);

  async function again() {
    setResetting(true);
    try {
      await playAgain(code);
    } finally {
      setResetting(false);
    }
  }

  const complete = stats.found === stats.total && stats.total > 0;

  return (
    <main className={`page results ${tv ? 'results-tv' : ''}`}>
      <section className="results-hero">
        <p className="label">{meta.title}</p>
        <h1>{complete ? 'Board cleared!' : "Time's up!"}</h1>
        <div className="hero-stats">
          <div>
            <span className="hero-num">
              {stats.found}/{stats.total}
            </span>
            <span className="label">found</span>
          </div>
          <div>
            <span className="hero-num">{stats.percent}%</span>
            <span className="label">score</span>
          </div>
          <div>
            <span className="hero-num">{formatDuration(stats.timeUsedMs)}</span>
            <span className="label">time used</span>
          </div>
        </div>
        {isHost && !tv && (
          <button type="button" className="btn btn-primary btn-big" onClick={again} disabled={resetting}>
            {resetting ? 'Resetting…' : 'Play again'}
          </button>
        )}
      </section>

      {stats.awards.length > 0 && (
        <section>
          <h2>Awards</h2>
          <ul className="awards">
            {stats.awards.map((a) => {
              const p = lookup(a.uid);
              return (
                <li key={a.id} className="award" style={{ '--c': p.color } as React.CSSProperties}>
                  <span className="award-icon" aria-hidden>
                    {AWARD_ICONS[a.id]}
                  </span>
                  <span className="award-title">{a.title}</span>
                  <span className="award-name">{p.name}</span>
                  <span className="award-detail">{a.detail}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2>Players</h2>
        <ul className="breakdown">
          {stats.players.map((p) => (
            <li key={p.uid} style={{ '--c': p.color } as React.CSSProperties}>
              <div className="breakdown-head">
                <span className="breakdown-name">{p.name}</span>
                <span className="breakdown-count">
                  {p.count} <span className="muted">({Math.round(p.share * 100)}%)</span>
                </span>
              </div>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${p.share * 100}%` }} />
              </div>
              {p.answers.length > 0 && <p className="breakdown-answers">{p.answers.map((f) => f.display).join(', ')}</p>}
            </li>
          ))}
        </ul>
      </section>

      {stats.found > 0 && (
        <section>
          <h2>Timeline</h2>
          <div className="card timeline-card">
            <Timeline players={stats.players} timeLimitSeconds={meta.timeLimitSeconds ?? 1} startedAt={startedAt} />
          </div>
        </section>
      )}

      <section>
        <h2>Full board</h2>
        {key === undefined && <p className="muted">Loading answers…</p>}
        <Board
          slotCount={meta.slotCount ?? 0}
          slots={room.slots}
          found={room.found}
          lookup={lookup}
          answerLabel={meta.answerLabel}
          hintLabel={meta.hintLabel}
          revealed={key}
          size={tv ? 'large' : 'normal'}
        />
      </section>

      {missesByPlayer.length > 0 && (
        <section>
          <h2>Wrong guesses</h2>
          <ul className="misses">
            {missesByPlayer.map(([uid, texts]) => {
              const p = lookup(uid);
              return (
                <li key={uid}>
                  <strong style={{ color: p.color }}>{p.name}</strong>
                  <span className="muted"> ({texts.length})</span>: {texts.join(', ')}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
