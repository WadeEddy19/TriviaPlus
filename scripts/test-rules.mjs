// Checks database.rules.json against the live database with three anonymous
// clients. Creates a throwaway room (deleted by the 24h cleanup).
// Usage: npm run test:rules

import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase, ref, get, set, update, push, remove, runTransaction, serverTimestamp, goOffline } from 'firebase/database';
import { createHash } from 'node:crypto';

const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const config = { apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, databaseURL: env.VITE_FIREBASE_DATABASE_URL, projectId: env.VITE_FIREBASE_PROJECT_ID, appId: env.VITE_FIREBASE_APP_ID };

async function client(name) {
  const app = initializeApp(config, name);
  const { user } = await signInAnonymously(getAuth(app));
  return { uid: user.uid, db: getDatabase(app) };
}
const A = await client('A'), B = await client('B'), C = await client('C');
let pass = 0, fail = 0;
async function expect(label, shouldSucceed, fn) {
  let ok;
  try { const r = await fn(); ok = r === undefined || r === true || r?.committed !== false; } catch (e) { ok = false; if (shouldSucceed) console.log('   error:', e.code || e.message); }
  const good = ok === shouldSucceed;
  good ? pass++ : fail++;
  console.log(`${good ? 'PASS' : 'FAIL'}  ${label} (${ok ? 'allowed' : 'denied'})`);
}
const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
const r = (db, p) => ref(db, `rooms/${code}/${p}`);
const h = s => createHash('sha256').update(`${code}:${s}`).digest('hex');
console.log('room', code);

await expect('A creates room via transaction', true, () => runTransaction(r(A.db, 'meta'), c => c === null ? { hostUid: A.uid, status: 'lobby', createdAt: serverTimestamp() } : undefined, { applyLocally: false }));
await expect('B cannot take over existing room meta', false, () => set(r(B.db, 'meta'), { hostUid: B.uid, status: 'lobby', createdAt: serverTimestamp() }));
await expect('bad room code rejected', false, () => set(ref(C.db, 'rooms/ABCO/meta'), { hostUid: C.uid, status: 'lobby', createdAt: serverTimestamp() }));
await expect('A joins as player', true, () => set(r(A.db, `players/${A.uid}`), { name: 'Alice', color: '#ff6b6b', joinedAt: serverTimestamp(), connected: true }));
await expect('B joins as player', true, () => set(r(B.db, `players/${B.uid}`), { name: 'Bob', color: '#ff922b', joinedAt: serverTimestamp(), connected: true }));
await expect('B cannot write A\'s player', false, () => update(r(B.db, `players/${A.uid}`), { name: 'Hacked' }));
await expect('B presence write', true, () => set(r(B.db, `players/${B.uid}/connected`), false));
await expect('A selects quiz (meta+slots+key)', true, () => update(r(A.db, ''), {
  'meta/quizId': 'test', 'meta/title': 'Rainbow', 'meta/answerLabel': 'Color', 'meta/timeLimitSeconds': 60, 'meta/slotCount': 3,
  slots: [{ hashes: [h('red')] }, { hashes: [h('orange')] }, { hashes: [h('yellow')] }],
  key: [{ display: 'Red' }, { display: 'Orange' }, { display: 'Yellow' }],
}));
await expect('B cannot write slots', false, () => set(r(B.db, 'slots/0'), { hashes: ['x'] }));
await expect('B cannot write meta title', false, () => set(r(B.db, 'meta/title'), 'x'));
const claim = (c, i, display) => runTransaction(r(c.db, `found/${i}`), cur => cur === null ? { uid: c.uid, at: serverTimestamp(), typed: display.toLowerCase(), display } : undefined, { applyLocally: false });
await expect('claim denied in lobby', false, () => claim(B, 0, 'Red'));
await expect('B cannot start game', false, () => update(r(B.db, 'meta'), { status: 'playing' }));
await expect('A starts game', true, () => update(r(A.db, ''), { 'meta/status': 'playing', 'meta/startedAt': serverTimestamp(), 'meta/endedAt': null, found: null, misses: null }));

// Race: A and B claim slot 0 at the same instant.
await get(r(A.db, 'found/0')); await get(r(B.db, 'found/0'));
const [ra, rb] = await Promise.allSettled([claim(A, 0, 'Red'), claim(B, 0, 'Red')]);
const winners = [ra, rb].filter(x => x.status === 'fulfilled' && x.value.committed).length;
const f0 = (await get(r(A.db, 'found/0'))).val();
console.log(`${winners === 1 ? 'PASS' : 'FAIL'}  simultaneous claim: exactly one winner (${winners}), stored uid=${f0?.uid === A.uid ? 'A' : f0?.uid === B.uid ? 'B' : '?'}`);
winners === 1 ? pass++ : fail++;

await expect('overwrite of found slot denied', false, () => set(r(C.db, 'found/0'), { uid: C.uid, at: serverTimestamp(), display: 'Red' }));
await expect('claim with someone else\'s uid denied', false, () => set(r(B.db, 'found/1'), { uid: A.uid, at: serverTimestamp(), display: 'Orange' }));
await expect('claim with wrong display denied', false, () => set(r(B.db, 'found/1'), { uid: B.uid, at: serverTimestamp(), display: 'Purple' }));
await expect('B claims slot 1', true, () => claim(B, 1, 'Orange'));
await expect('B logs a miss', true, () => push(r(B.db, 'misses'), { uid: B.uid, text: 'pink', at: serverTimestamp() }));
await expect('miss with other uid denied', false, () => push(r(B.db, 'misses'), { uid: A.uid, text: 'x', at: serverTimestamp() }));
await expect('B cannot clear found', false, () => set(r(B.db, 'found'), null));
await expect('B cannot set status to lobby', false, () => set(r(B.db, 'meta/status'), 'lobby'));
await expect('B ends game (playing -> ended transaction)', true, () => runTransaction(r(B.db, 'meta/status'), s => s === 'playing' || s === null ? 'ended' : undefined, { applyLocally: false }));
await expect('B sets endedAt', true, () => set(r(B.db, 'meta/endedAt'), serverTimestamp()));
await expect('C cannot overwrite endedAt', false, () => set(r(C.db, 'meta/endedAt'), serverTimestamp()));
const second = await runTransaction(r(C.db, 'meta/status'), s => s === 'playing' || s === null ? 'ended' : undefined, { applyLocally: false }).catch(() => ({ committed: false }));
console.log(`${!second.committed ? 'PASS' : 'FAIL'}  second end attempt does not commit`); !second.committed ? pass++ : fail++;
await expect('claim after game ended denied', false, () => claim(B, 2, 'Yellow'));
await expect('C cannot delete a fresh room', false, () => remove(ref(C.db, `rooms/${code}`)));
await expect('A plays again (clears game data)', true, () => update(r(A.db, ''), { 'meta/status': 'lobby', 'meta/startedAt': null, 'meta/endedAt': null, slots: null, key: null, found: null, misses: null }));
await expect('quiz save by signed-in user', true, async () => { const q = push(ref(C.db, 'quizzes')); await set(q, { schemaVersion: 1, title: 't', description: '', timeLimitSeconds: 60, answerLabel: 'x', answers: [{ display: 'a' }], createdAt: serverTimestamp() }); await remove(q); });
await expect('quiz with bad time limit rejected', false, () => set(push(ref(C.db, 'quizzes')), { schemaVersion: 1, title: 't', description: '', timeLimitSeconds: 5, answerLabel: 'x', answers: [{ display: 'a' }], createdAt: serverTimestamp() }));

console.log(`\n${pass} passed, ${fail} failed`);
for (const c of [A, B, C]) goOffline(c.db);
process.exit(fail ? 1 : 0);
