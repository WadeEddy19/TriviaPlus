import {
  endAt,
  get,
  onDisconnect,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import { pickColor } from '../lib/colors';
import { answerHash } from '../lib/hash';
import { matchKeysForQuiz } from '../lib/normalize';
import { generateRoomCode } from '../lib/roomCode';
import type { Player, StoredQuiz } from '../lib/types';
import { getDb } from './init';

export const MAX_MISSES_PER_PLAYER = 50;
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

const roomRef = (code: string, path = '') => ref(getDb(), `rooms/${code}${path ? `/${path}` : ''}`);

/** Claim a fresh room code with a transaction on its meta node so two hosts can never share one. */
export async function createRoom(hostUid: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateRoomCode();
    const metaRef = roomRef(code, 'meta');
    try {
      // Prime the local cache so the transaction starts from the server value.
      if ((await get(metaRef)).exists()) continue;
      const result = await runTransaction(
        metaRef,
        (current) => {
          if (current !== null) return undefined;
          return { hostUid, status: 'lobby', createdAt: serverTimestamp() };
        },
        { applyLocally: false },
      );
      if (result.committed) return code;
    } catch {
      // Permission denied means another host owns this code. Try another.
    }
  }
  throw new Error('Could not find a free room code. Try again.');
}

/** Delete rooms created more than 24 hours ago. Best effort. */
export async function cleanupOldRooms(): Promise<number> {
  const cutoff = Date.now() - ROOM_TTL_MS;
  const snap = await get(query(ref(getDb(), 'rooms'), orderByChild('meta/createdAt'), endAt(cutoff)));
  const codes: string[] = [];
  snap.forEach((child) => {
    const createdAt = child.child('meta/createdAt').val();
    if (typeof createdAt === 'number' && createdAt < cutoff) codes.push(child.key!);
  });
  await Promise.allSettled(codes.map((code) => remove(roomRef(code))));
  return codes.length;
}

export async function roomExists(code: string): Promise<boolean> {
  return (await get(roomRef(code, 'meta'))).exists();
}

/** Add or update the current user as a player. Keeps color and joinedAt on rejoin. */
export async function joinRoom(code: string, uid: string, name: string): Promise<void> {
  const playersSnap = await get(roomRef(code, 'players'));
  const players = (playersSnap.val() ?? {}) as Record<string, Player>;
  const me = players[uid];
  if (me) {
    await update(roomRef(code, `players/${uid}`), { name, connected: true });
    return;
  }
  const taken = Object.entries(players)
    .filter(([id]) => id !== uid)
    .map(([, p]) => p.color);
  await set(roomRef(code, `players/${uid}`), {
    name,
    color: pickColor(taken),
    joinedAt: serverTimestamp(),
    connected: true,
  });
}

export function setPlayerColor(code: string, uid: string, color: string): Promise<void> {
  return update(roomRef(code, `players/${uid}`), { color });
}

/**
 * Keep players/{uid}/connected in sync with the connection. Returns an
 * unsubscribe function. Only call after the player node exists.
 */
export function trackPresence(code: string, uid: string): () => void {
  const connectedRef = ref(getDb(), '.info/connected');
  const meRef = roomRef(code, `players/${uid}/connected`);
  const unsub = onValue(connectedRef, async (snap) => {
    if (snap.val() !== true) return;
    try {
      await onDisconnect(meRef).set(false);
      await set(meRef, true);
    } catch {
      // Room was deleted or we are no longer a player.
    }
  });
  return () => {
    unsub();
    onDisconnect(meRef).cancel().catch(() => {});
    set(meRef, false).catch(() => {});
  };
}

/** Host picks a quiz: copy its metadata into the room and write salted hashes (no plaintext) per slot. */
export async function selectQuiz(code: string, quiz: StoredQuiz): Promise<void> {
  const keys = matchKeysForQuiz(quiz.answers);
  const slots = await Promise.all(
    quiz.answers.map(async (answer, i) => {
      const hashes = await Promise.all(keys[i].map((k) => answerHash(code, k)));
      return answer.hint !== undefined ? { hint: answer.hint, hashes } : { hashes };
    }),
  );
  await update(roomRef(code), {
    'meta/quizId': quiz.id,
    'meta/title': quiz.title,
    'meta/description': quiz.description,
    'meta/answerLabel': quiz.answerLabel,
    'meta/hintLabel': quiz.hintLabel ?? null,
    'meta/timeLimitSeconds': quiz.timeLimitSeconds,
    'meta/slotCount': quiz.answers.length,
    slots,
    key: quiz.answers.map((a) => ({ display: a.display })),
  });
}

export function startGame(code: string): Promise<void> {
  return update(roomRef(code), {
    'meta/status': 'playing',
    'meta/startedAt': serverTimestamp(),
    'meta/endedAt': null,
    found: null,
    misses: null,
  });
}

/**
 * End the game if it is still playing. Any player may do this (timer ran
 * out, board complete, or host gave up). Only the transaction winner sets endedAt.
 */
export async function endGame(code: string): Promise<boolean> {
  const statusRef = roomRef(code, 'meta/status');
  // A null here usually just means "not cached yet". Proposing a write forces
  // a round trip; the server re-runs this with the real value, and the rules
  // reject it if the room is gone.
  const result = await runTransaction(
    statusRef,
    (status) => (status === 'playing' || status === null ? 'ended' : undefined),
    { applyLocally: false },
  ).catch(() => ({ committed: false }));
  if (result.committed) {
    await set(roomRef(code, 'meta/endedAt'), serverTimestamp()).catch(() => {});
  }
  return result.committed;
}

/** Back to the lobby with the same players. Clears the quiz and all game data. */
export function playAgain(code: string): Promise<void> {
  return update(roomRef(code), {
    'meta/status': 'lobby',
    'meta/startedAt': null,
    'meta/endedAt': null,
    'meta/quizId': null,
    'meta/title': null,
    'meta/description': null,
    'meta/answerLabel': null,
    'meta/hintLabel': null,
    'meta/timeLimitSeconds': null,
    'meta/slotCount': null,
    slots: null,
    key: null,
    found: null,
    misses: null,
  });
}

/**
 * Try to claim slot i. Reads the display text, then writes found/{i} only if
 * it is still empty. Resolves true if this client won the slot.
 */
export async function claimSlot(code: string, slot: number, uid: string, typed: string): Promise<boolean> {
  const displaySnap = await get(roomRef(code, `key/${slot}/display`));
  const display = displaySnap.val();
  if (typeof display !== 'string') return false;
  try {
    const result = await runTransaction(
      roomRef(code, `found/${slot}`),
      (current) => {
        if (current !== null) return undefined;
        return { uid, at: serverTimestamp(), typed: typed.slice(0, 100), display };
      },
      { applyLocally: false },
    );
    return result.committed;
  } catch {
    // Rules reject writes to an existing slot or after the game ended.
    return false;
  }
}

export async function logMiss(code: string, uid: string, text: string): Promise<void> {
  await push(roomRef(code, 'misses'), { uid, text: text.slice(0, 100), at: serverTimestamp() });
}

/** Read the full answer key. Only used once the game has ended. */
export async function fetchKey(code: string): Promise<string[]> {
  const snap = await get(roomRef(code, 'key'));
  const val = snap.val() as Record<string, { display: string }> | { display: string }[] | null;
  if (!val) return [];
  const out: string[] = [];
  Object.entries(val).forEach(([i, v]) => {
    if (v) out[Number(i)] = v.display;
  });
  return out;
}
