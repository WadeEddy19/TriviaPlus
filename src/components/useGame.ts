import { useEffect, useMemo, useRef } from 'react';
import { endGame } from '../firebase/rooms';
import { useNow, useServerOffset, type RoomState } from '../firebase/hooks';
import { UNKNOWN_COLOR } from '../lib/colors';
import type { Player } from '../lib/types';

export const FINAL_SECONDS_WARNING = 30;

/** Time remaining in the current game, based on server time. */
export function useGameClock(room: RoomState) {
  const offset = useServerOffset();
  const playing = room.meta?.status === 'playing';
  const now = useNow(playing);
  const limitMs = (room.meta?.timeLimitSeconds ?? 0) * 1000;
  const startedAt = room.meta?.startedAt;
  const remainingMs = playing && typeof startedAt === 'number' ? startedAt + limitMs - (now + offset) : limitMs;
  return {
    remainingMs: Math.max(0, Math.min(limitMs, remainingMs)),
    expired: playing && typeof startedAt === 'number' && remainingMs <= 0,
    serverNow: now + offset,
  };
}

/** Any client ends the game once time is up or every slot is found. */
export function useAutoEnd(code: string, room: RoomState, expired: boolean) {
  const tried = useRef<number | null>(null);
  const meta = room.meta;
  const complete = !!meta?.slotCount && room.found.size >= meta.slotCount;
  useEffect(() => {
    if (meta?.status !== 'playing' || typeof meta.startedAt !== 'number') return;
    if (!expired && !complete) return;
    if (tried.current === meta.startedAt) return;
    tried.current = meta.startedAt;
    endGame(code).catch(() => {
      tried.current = null;
    });
  }, [code, meta?.status, meta?.startedAt, expired, complete]);
}

export function usePlayerLookup(players: Player[]) {
  return useMemo(() => {
    const map = new Map(players.map((p) => [p.uid, p]));
    return (uid: string): { name: string; color: string } =>
      map.get(uid) ?? { name: 'Unknown player', color: UNKNOWN_COLOR };
  }, [players]);
}
