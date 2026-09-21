import { describe, expect, it } from 'vitest';
import { computeStats, type FindRecord } from './stats';

const T0 = 1_000_000;
const players = [
  { uid: 'a', name: 'Ann', color: 'red' },
  { uid: 'b', name: 'Bob', color: 'blue' },
  { uid: 'c', name: 'Cat', color: 'green' },
];
const find = (slot: number, uid: string, sec: number): FindRecord => ({
  slot,
  uid,
  at: T0 + sec * 1000,
  display: `Answer ${slot}`,
});

describe('computeStats', () => {
  it('handles a game with no finds', () => {
    const s = computeStats({ finds: [], players, startedAt: T0, endedAt: T0 + 60_000, timeLimitSeconds: 60, slotCount: 10 });
    expect(s.found).toBe(0);
    expect(s.percent).toBe(0);
    expect(s.awards).toEqual([]);
    expect(s.players.every((p) => p.count === 0 && p.share === 0)).toBe(true);
  });

  it('builds the per-player breakdown sorted by count', () => {
    const s = computeStats({
      finds: [find(0, 'b', 5), find(1, 'a', 10), find(2, 'b', 20), find(3, 'b', 25)],
      players,
      startedAt: T0,
      endedAt: T0 + 40_000,
      timeLimitSeconds: 60,
      slotCount: 8,
    });
    expect(s.found).toBe(4);
    expect(s.total).toBe(8);
    expect(s.percent).toBe(50);
    expect(s.timeUsedMs).toBe(40_000);
    expect(s.players.map((p) => [p.uid, p.count])).toEqual([
      ['b', 3],
      ['a', 1],
      ['c', 0],
    ]);
    expect(s.players[0].share).toBeCloseTo(0.75);
    expect(s.players[0].answers.map((f) => f.slot)).toEqual([0, 2, 3]);
    expect(s.timeline.map((f) => f.t)).toEqual([5, 10, 20, 25]);
  });

  it('gives each award to the right player', () => {
    const s = computeStats({
      finds: [
        find(0, 'a', 1), // first blood
        find(1, 'b', 10),
        find(2, 'b', 25),
        find(3, 'b', 45),
        find(4, 'b', 60),
        find(5, 'c', 100),
        find(6, 'c', 105),
        find(7, 'c', 110),
        find(8, 'a', 115), // closer
      ],
      players,
      startedAt: T0,
      endedAt: T0 + 120_000,
      timeLimitSeconds: 120,
      slotCount: 20,
    });
    const byId = Object.fromEntries(s.awards.map((a) => [a.id, a.uid]));
    expect(byId.mvp).toBe('b');
    expect(byId.firstBlood).toBe('a');
    expect(byId.closer).toBe('a');
    // Final 10 seconds = 110s..120s: c at 110, a at 115. Tie at 1, c got there first.
    expect(byId.buzzerBeater).toBe('c');
    // c has 3 within 30s (100, 105, 110); b's best window is 2.
    expect(byId.hotStreak).toBe('c');
  });

  it('skips Buzzer Beater when nobody scored in the final 10 seconds', () => {
    const s = computeStats({
      finds: [find(0, 'a', 5)],
      players,
      startedAt: T0,
      endedAt: T0 + 20_000,
      timeLimitSeconds: 60,
      slotCount: 1,
    });
    expect(s.awards.map((a) => a.id)).toEqual(['mvp', 'firstBlood', 'closer', 'hotStreak']);
  });

  it('breaks MVP ties by who reached the count first', () => {
    const s = computeStats({
      finds: [find(0, 'a', 1), find(1, 'b', 2), find(2, 'b', 3), find(3, 'a', 4)],
      players,
      startedAt: T0,
      timeLimitSeconds: 60,
      slotCount: 4,
    });
    expect(s.awards.find((a) => a.id === 'mvp')?.uid).toBe('b');
  });

  it('uses a strict 30 second hot streak window', () => {
    const s = computeStats({
      finds: [find(0, 'a', 0), find(1, 'a', 30), find(2, 'b', 40), find(3, 'b', 69)],
      players,
      startedAt: T0,
      timeLimitSeconds: 300,
      slotCount: 4,
    });
    // a's finds are exactly 30s apart (not within 30s); b's are 29s apart.
    expect(s.awards.find((a) => a.id === 'hotStreak')).toMatchObject({ uid: 'b', detail: '2 answers within 30 seconds' });
  });

  it('includes finders who are missing from the player list', () => {
    const s = computeStats({ finds: [find(0, 'zzz', 3)], players, startedAt: T0, timeLimitSeconds: 60, slotCount: 1 });
    expect(s.players[0]).toMatchObject({ uid: 'zzz', name: 'Unknown player', count: 1 });
  });

  it('clamps time used to the time limit', () => {
    const s = computeStats({ finds: [], players, startedAt: T0, endedAt: T0 + 65_000, timeLimitSeconds: 60, slotCount: 1 });
    expect(s.timeUsedMs).toBe(60_000);
  });
});
