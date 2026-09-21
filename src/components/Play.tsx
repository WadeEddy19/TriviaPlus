import { useEffect, useMemo, useRef, useState } from 'react';
import type { RoomState } from '../firebase/hooks';
import { claimSlot, endGame, logMiss, MAX_MISSES_PER_PLAYER } from '../firebase/rooms';
import { answerHash } from '../lib/hash';
import { normalize } from '../lib/normalize';
import { formatClock } from '../lib/time';
import { Board } from './Board';
import { Feed } from './Feed';
import { Tally } from './Tally';
import { FINAL_SECONDS_WARNING, usePlayerLookup } from './useGame';

interface Props {
  code: string;
  room: RoomState;
  uid: string;
  isHost: boolean;
  remainingMs: number;
  expired: boolean;
}

type Flash = { kind: 'ok' | 'dupe' | 'miss'; text: string; id: number };

export function Play({ code, room, uid, isHost, remainingMs, expired }: Props) {
  const meta = room.meta!;
  const lookup = usePlayerLookup(room.players);
  const accepting = meta.status === 'playing' && !expired && remainingMs > 0;

  const hashToSlot = useMemo(() => {
    const m = new Map<string, number>();
    room.slots.forEach((s, i) => s?.hashes.forEach((h) => m.set(h, i)));
    return m;
  }, [room.slots]);

  const [input, setInput] = useState('');
  const [flash, setFlash] = useState<Flash | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const latest = useRef('');
  const pending = useRef(new Set<number>());
  const foundRef = useRef(room.found);
  foundRef.current = room.found;
  const missesSent = useRef(0);
  const myMisses = room.misses.filter((m) => m.uid === uid).length;

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash((f) => (f?.id === flash.id ? null : f)), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (accepting) inputRef.current?.focus();
  }, [accepting]);

  const show = (kind: Flash['kind'], text: string) => setFlash({ kind, text, id: Date.now() + Math.random() });

  function replaceInput(value: string) {
    latest.current = value;
    setInput(value);
  }

  async function lookupSlot(value: string): Promise<number | undefined> {
    const n = normalize(value);
    if (!n) return undefined;
    return hashToSlot.get(await answerHash(code, n));
  }

  async function onChange(value: string) {
    replaceInput(value);
    if (!accepting) return;
    const slot = await lookupSlot(value);
    if (slot === undefined || latest.current !== value) return;
    // Already found: leave the input alone, the player may be typing a longer answer.
    if (foundRef.current.has(slot) || pending.current.has(slot)) return;

    pending.current.add(slot);
    const won = await claimSlot(code, slot, uid, value);
    pending.current.delete(slot);
    if (!won) return;

    const current = latest.current;
    replaceInput(current.startsWith(value) ? current.slice(value.length).trimStart() : current);
    const display = foundRef.current.get(slot)?.display ?? value;
    show('ok', `✓ ${display}`);
  }

  async function onEnter() {
    const value = latest.current;
    if (!accepting || !normalize(value)) return;
    const slot = await lookupSlot(value);
    if (latest.current !== value) return;
    if (slot !== undefined) {
      const f = foundRef.current.get(slot);
      if (f) show('dupe', `Already found by ${lookup(f.uid).name}`);
      return;
    }
    if (Math.max(myMisses, missesSent.current) < MAX_MISSES_PER_PLAYER) {
      missesSent.current++;
      logMiss(code, uid, value).catch(() => {});
    }
    replaceInput('');
    show('miss', `✗ ${value}`);
  }

  // Reset the per-game miss counter when a new game starts.
  useEffect(() => {
    missesSent.current = 0;
  }, [meta.startedAt]);

  function giveUp() {
    if (window.confirm('End the game now and reveal the answers?')) endGame(code).catch(() => {});
  }

  const lowTime = remainingMs <= FINAL_SECONDS_WARNING * 1000;
  const slotCount = meta.slotCount ?? 0;

  return (
    <div className="play">
      <header className="play-header">
        <div className="play-status">
          <span className={`timer ${lowTime ? 'timer-low' : ''}`}>{formatClock(remainingMs)}</span>
          <span className="score">
            {room.found.size} / {slotCount}
          </span>
          {isHost && (
            <button type="button" className="btn btn-small btn-ghost" onClick={giveUp}>
              Give up
            </button>
          )}
        </div>
        <div className="answer-box">
          <input
            ref={inputRef}
            className={`answer-input ${flash ? `flash-${flash.kind}` : ''}`}
            value={input}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onEnter();
              }
            }}
            onBlur={() => {
              if (accepting) setTimeout(() => {
                if (document.activeElement === document.body) inputRef.current?.focus();
              }, 0);
            }}
            disabled={!accepting}
            placeholder={accepting ? `Type a ${meta.answerLabel?.toLowerCase() || 'answer'}…` : "Time's up!"}
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
            aria-label="Answer"
            maxLength={100}
          />
          {flash && (
            <span key={flash.id} className={`flash flash-${flash.kind}`} role="status">
              {flash.text}
            </span>
          )}
        </div>
      </header>

      <div className="play-body">
        <aside className="play-side">
          <Tally players={room.players} found={room.found} />
          <Feed found={room.found} lookup={lookup} limit={4} />
        </aside>
        <main className="play-main">
          <p className="quiz-desc">
            <strong>{meta.title}</strong> {meta.description}
          </p>
          <Board
            slotCount={slotCount}
            slots={room.slots}
            found={room.found}
            lookup={lookup}
            answerLabel={meta.answerLabel}
            hintLabel={meta.hintLabel}
          />
        </main>
      </div>
    </div>
  );
}
