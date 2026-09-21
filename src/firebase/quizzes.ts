import { get, onValue, push, ref, remove, serverTimestamp, set } from 'firebase/database';
import type { Quiz, StoredQuiz } from '../lib/types';
import { getDb } from './init';

export async function saveQuiz(quiz: Quiz): Promise<string> {
  const r = push(ref(getDb(), 'quizzes'));
  await set(r, { ...quiz, createdAt: serverTimestamp() });
  return r.key!;
}

export function deleteQuiz(id: string): Promise<void> {
  return remove(ref(getDb(), `quizzes/${id}`));
}

export async function getQuiz(id: string): Promise<StoredQuiz | null> {
  const snap = await get(ref(getDb(), `quizzes/${id}`));
  return snap.exists() ? toStored(id, snap.val()) : null;
}

/** Subscribe to the quiz library, newest first. */
export function subscribeQuizzes(cb: (quizzes: StoredQuiz[]) => void): () => void {
  return onValue(ref(getDb(), 'quizzes'), (snap) => {
    const val = (snap.val() ?? {}) as Record<string, unknown>;
    const list = Object.entries(val).map(([id, q]) => toStored(id, q));
    list.sort((a, b) => b.createdAt - a.createdAt);
    cb(list);
  });
}

function toStored(id: string, raw: unknown): StoredQuiz {
  const q = raw as StoredQuiz;
  // RTDB drops empty arrays, so restore missing alias lists.
  const answers = (q.answers ?? []).map((a) => ({ ...a, aliases: a.aliases ?? [] }));
  return { ...q, id, answers, createdAt: q.createdAt ?? 0 };
}
