import { UNKNOWN_COLOR } from './colors';

export interface FindRecord {
  slot: number;
  uid: string;
  at: number;
  display: string;
}

export interface PlayerInfo {
  uid: string;
  name: string;
  color: string;
}

export interface StatsInput {
  finds: FindRecord[];
  players: PlayerInfo[];
  startedAt: number;
  endedAt?: number;
  timeLimitSeconds: number;
  slotCount: number;
}

export interface PlayerStats extends PlayerInfo {
  count: number;
  /** Share of the team total, 0..1. */
  share: number;
  answers: FindRecord[];
}

export type AwardId = 'mvp' | 'firstBlood' | 'closer' | 'buzzerBeater' | 'hotStreak';

export interface Award {
  id: AwardId;
  title: string;
  uid: string;
  detail: string;
}

export interface GameStats {
  found: number;
  total: number;
  /** 0..100, rounded. */
  percent: number;
  timeUsedMs: number;
  players: PlayerStats[];
  awards: Award[];
  /** Finds sorted by time, with seconds since start. */
  timeline: (FindRecord & { t: number })[];
}

export const HOT_STREAK_WINDOW_MS = 30_000;
export const BUZZER_WINDOW_MS = 10_000;

/**
 * Pick the player with the highest score. Ties go to whoever reached the
 * score first (lower `reachedAt`).
 */
function best(
  entries: { uid: string; score: number; reachedAt: number }[],
): { uid: string; score: number } | null {
  let top: { uid: string; score: number; reachedAt: number } | null = null;
  for (const e of entries) {
    if (e.score <= 0) continue;
    if (!top || e.score > top.score || (e.score === top.score && e.reachedAt < top.reachedAt)) top = e;
  }
  return top;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function formatOffset(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function computeStats(input: StatsInput): GameStats {
  const { startedAt, timeLimitSeconds, slotCount } = input;
  const limitMs = timeLimitSeconds * 1000;
  const deadline = startedAt + limitMs;
  const finds = [...input.finds].sort((a, b) => a.at - b.at || a.slot - b.slot);

  const byUid = new Map<string, FindRecord[]>();
  for (const f of finds) {
    const list = byUid.get(f.uid) ?? [];
    list.push(f);
    byUid.set(f.uid, list);
  }

  const known = new Map(input.players.map((p) => [p.uid, p]));
  const infos: PlayerInfo[] = [...input.players];
  for (const uid of byUid.keys()) {
    if (!known.has(uid)) infos.push({ uid, name: 'Unknown player', color: UNKNOWN_COLOR });
  }

  const total = finds.length;
  const players: PlayerStats[] = infos
    .map((p) => {
      const answers = byUid.get(p.uid) ?? [];
      return { ...p, count: answers.length, share: total ? answers.length / total : 0, answers };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));


  const awards: Award[] = [];
  if (total > 0) {
    const mvp = best(
      [...byUid].map(([uid, list]) => ({ uid, score: list.length, reachedAt: list[list.length - 1].at })),
    );
    if (mvp) awards.push({ id: 'mvp', title: 'MVP', uid: mvp.uid, detail: `Most answers (${mvp.score})` });

    const first = finds[0];
    awards.push({
      id: 'firstBlood',
      title: 'First Blood',
      uid: first.uid,
      detail: `First answer: ${first.display} at ${formatOffset(first.at - startedAt)}`,
    });

    const last = finds[finds.length - 1];
    awards.push({
      id: 'closer',
      title: 'Closer',
      uid: last.uid,
      detail: `Last answer: ${last.display} at ${formatOffset(last.at - startedAt)}`,
    });

    const buzzer = best(
      [...byUid].map(([uid, list]) => {
        const late = list.filter((f) => f.at >= deadline - BUZZER_WINDOW_MS);
        return { uid, score: late.length, reachedAt: late.length ? late[late.length - 1].at : Infinity };
      }),
    );
    if (buzzer) {
      awards.push({
        id: 'buzzerBeater',
        title: 'Buzzer Beater',
        uid: buzzer.uid,
        detail: `${plural(buzzer.score, 'answer')} in the final 10 seconds`,
      });
    }

    const streak = best(
      [...byUid].map(([uid, list]) => {
        let bestCount = 0;
        let reachedAt = Infinity;
        let start = 0;
        for (let end = 0; end < list.length; end++) {
          while (list[end].at - list[start].at >= HOT_STREAK_WINDOW_MS) start++;
          const count = end - start + 1;
          if (count > bestCount) {
            bestCount = count;
            reachedAt = list[end].at;
          }
        }
        return { uid, score: bestCount, reachedAt };
      }),
    );
    if (streak) {
      awards.push({
        id: 'hotStreak',
        title: 'Hot Streak',
        uid: streak.uid,
        detail: `${plural(streak.score, 'answer')} within 30 seconds`,
      });
    }
  }

  const end = input.endedAt ?? (finds.length ? finds[finds.length - 1].at : startedAt);
  const timeUsedMs = Math.min(limitMs, Math.max(0, end - startedAt));

  return {
    found: total,
    total: slotCount,
    percent: slotCount ? Math.round((total / slotCount) * 100) : 0,
    timeUsedMs,
    players,
    awards,
    timeline: finds.map((f) => ({ ...f, t: (f.at - startedAt) / 1000 })),
  };
}
