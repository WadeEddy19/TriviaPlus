import { onValue, ref } from 'firebase/database';
import { useEffect, useMemo, useState } from 'react';
import type { Found, Miss, Player, RoomMeta, Slot } from '../lib/types';
import { ensureAuth, firebaseConfigured, getDb } from './init';

/** Anonymous auth uid, or null while signing in. */
export function useAuthUid(): { uid: string | null; error: string | null } {
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!firebaseConfigured) return;
    ensureAuth()
      .then((u) => setUid(u.uid))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  return { uid, error };
}

/** Milliseconds to add to Date.now() to get server time. */
export function useServerOffset(): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    return onValue(ref(getDb(), '.info/serverTimeOffset'), (snap) => setOffset(Number(snap.val()) || 0));
  }, []);
  return offset;
}

/** Current time, re-rendering every `intervalMs` while enabled. */
export function useNow(enabled: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);
  return now;
}

/** RTDB turns dense numeric-keyed objects into arrays (with null holes). Normalize to a map. */
function toIndexed<T>(val: unknown): Map<number, T> {
  const out = new Map<number, T>();
  if (!val || typeof val !== 'object') return out;
  for (const [k, v] of Object.entries(val as Record<string, T | null>)) {
    if (v !== null && v !== undefined) out.set(Number(k), v);
  }
  return out;
}

export interface RoomState {
  loading: boolean;
  exists: boolean;
  meta: RoomMeta | null;
  players: Player[];
  slots: Slot[];
  found: Map<number, Found>;
  misses: Miss[];
}

function useRoomValue<T>(code: string, path: string, enabled: boolean, parse: (val: unknown) => T, initial: T) {
  const [state, setState] = useState<{ value: T; loaded: boolean }>({ value: initial, loaded: false });
  useEffect(() => {
    if (!enabled) return;
    setState({ value: initial, loaded: false });
    return onValue(
      ref(getDb(), `rooms/${code}/${path}`),
      (snap) => setState({ value: parse(snap.val()), loaded: true }),
      () => setState((s) => ({ ...s, loaded: true })),
    );
  }, [code, path, enabled]);
  return state;
}

const EMPTY_FOUND = new Map<number, Found>();

/** Live view of a room. Deliberately does not subscribe to `key`. */
export function useRoom(code: string, uid: string | null): RoomState {
  const enabled = uid !== null;
  const meta = useRoomValue<RoomMeta | null>(code, 'meta', enabled, (v) => (v as RoomMeta) ?? null, null);
  const players = useRoomValue<Player[]>(
    code,
    'players',
    enabled,
    (v) =>
      Object.entries((v ?? {}) as Record<string, Omit<Player, 'uid'>>)
        .map(([id, p]) => ({ ...p, uid: id, connected: p.connected ?? false }))
        .sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0)),
    [],
  );
  const slots = useRoomValue<Slot[]>(
    code,
    'slots',
    enabled,
    (v) => {
      const m = toIndexed<Slot>(v);
      const arr: Slot[] = [];
      m.forEach((s, i) => (arr[i] = { ...s, hashes: s.hashes ?? [] }));
      return arr;
    },
    [],
  );
  const found = useRoomValue<Map<number, Found>>(code, 'found', enabled, (v) => toIndexed<Found>(v), EMPTY_FOUND);
  const misses = useRoomValue<Miss[]>(
    code,
    'misses',
    enabled,
    (v) =>
      Object.entries((v ?? {}) as Record<string, Omit<Miss, 'id'>>)
        .map(([id, m]) => ({ ...m, id }))
        .sort((a, b) => a.at - b.at),
    [],
  );

  return useMemo(
    () => ({
      loading: !meta.loaded || !players.loaded,
      exists: meta.value !== null,
      meta: meta.value,
      players: players.value,
      slots: slots.value,
      found: found.value,
      misses: misses.value,
    }),
    [meta, players, slots, found, misses],
  );
}
