import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { RoomState } from '../firebase/hooks';
import { startGame } from '../firebase/rooms';
import { formatDuration } from '../lib/time';
import { JoinInfo } from './JoinInfo';
import { PlayerList } from './PlayerList';
import { QuizPicker } from './QuizPicker';

interface Props {
  code: string;
  room: RoomState;
  uid: string;
  isHost: boolean;
}

export function Lobby({ code, room, uid, isHost }: Props) {
  const meta = room.meta!;
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = !!meta.quizId && !!meta.slotCount && room.slots.filter(Boolean).length === meta.slotCount;

  async function start() {
    setStarting(true);
    setError(null);
    try {
      await startGame(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  }

  return (
    <main className="page lobby">
      <JoinInfo code={code} />

      <section className="card">
        <h2>Players ({room.players.length})</h2>
        <PlayerList players={room.players} hostUid={meta.hostUid} meUid={uid} />
      </section>

      <section className="card">
        <h2>Quiz</h2>
        {meta.title ? (
          <div className="selected-quiz">
            <h3>{meta.title}</h3>
            {meta.description && <p>{meta.description}</p>}
            <p className="muted small">
              {meta.slotCount} answers · {formatDuration((meta.timeLimitSeconds ?? 0) * 1000)}
            </p>
          </div>
        ) : (
          !isHost && <p className="muted">The host hasn't picked a quiz yet.</p>
        )}

        {isHost ? (
          <>
            <button type="button" className="btn btn-primary btn-big" onClick={start} disabled={!ready || starting}>
              {starting ? 'Starting…' : ready ? 'Start game' : 'Pick a quiz to start'}
            </button>
            {error && <p className="error">{error}</p>}
            <h3 className="picker-heading">{meta.title ? 'Change quiz' : 'Pick a quiz'}</h3>
            <QuizPicker code={code} selectedId={meta.quizId} />
            <p className="small muted">
              Show everyone the board on a TV: <Link to={`/room/${code}/tv`} target="_blank">open TV view</Link>
            </p>
          </>
        ) : (
          <p className="waiting">Waiting for the host to start…</p>
        )}
      </section>
    </main>
  );
}
