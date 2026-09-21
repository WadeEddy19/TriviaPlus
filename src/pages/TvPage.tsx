import { useParams } from 'react-router-dom';
import { Board } from '../components/Board';
import { Feed } from '../components/Feed';
import { JoinInfo } from '../components/JoinInfo';
import { PlayerList } from '../components/PlayerList';
import { Results } from '../components/Results';
import { Tally } from '../components/Tally';
import { FINAL_SECONDS_WARNING, useAutoEnd, useGameClock, usePlayerLookup } from '../components/useGame';
import { useAuthUid, useRoom } from '../firebase/hooks';
import { cleanRoomCodeInput } from '../lib/roomCode';
import { formatClock, formatDuration } from '../lib/time';
import { NotFound } from './NotFound';

/** Shared-screen view: no input, big type, room code always visible. */
export function TvPage() {
  const code = cleanRoomCodeInput(useParams().code ?? '');
  const { uid, error } = useAuthUid();
  const room = useRoom(code, uid);
  const { remainingMs, expired } = useGameClock(room);
  useAutoEnd(code, room, expired);
  const lookup = usePlayerLookup(room.players);

  if (error) return <NotFound message={`Could not sign in: ${error}`} />;
  if (!uid || room.loading) return <main className="page tv center muted">Loading…</main>;
  if (!room.exists) return <NotFound message={`There is no room with code ${code}.`} />;

  const meta = room.meta!;

  if (meta.status === 'lobby') {
    return (
      <main className="page tv tv-lobby">
        <h1 className="logo">
          Trivia<span>Game</span>
        </h1>
        <JoinInfo code={code} size="large" />
        {meta.title && (
          <div className="tv-quiz">
            <h2>{meta.title}</h2>
            <p>{meta.description}</p>
            <p className="muted">
              {meta.slotCount} answers · {formatDuration((meta.timeLimitSeconds ?? 0) * 1000)}
            </p>
          </div>
        )}
        <section className="card">
          <h2>Players ({room.players.length})</h2>
          <PlayerList players={room.players} hostUid={meta.hostUid} />
        </section>
      </main>
    );
  }

  if (meta.status === 'ended') {
    return (
      <div className="tv">
        <div className="tv-corner">{code}</div>
        <Results code={code} room={room} isHost={false} tv />
      </div>
    );
  }

  const lowTime = remainingMs <= FINAL_SECONDS_WARNING * 1000;
  return (
    <div className="tv tv-play">
      <header className="tv-header">
        <div className="tv-title">
          <h1>{meta.title}</h1>
          <p>{meta.description}</p>
        </div>
        <span className={`timer ${lowTime ? 'timer-low' : ''}`}>{formatClock(remainingMs)}</span>
        <span className="score">
          {room.found.size} / {meta.slotCount}
        </span>
        <div className="tv-code">
          <span className="label">Join</span>
          <strong>{code}</strong>
          <span className="small">{window.location.host}</span>
        </div>
      </header>
      <div className="tv-body">
        <main>
          <Board
            slotCount={meta.slotCount ?? 0}
            slots={room.slots}
            found={room.found}
            lookup={lookup}
            answerLabel={meta.answerLabel}
            hintLabel={meta.hintLabel}
            size="large"
          />
        </main>
        <aside className="tv-side">
          <h2>Team</h2>
          <Tally players={room.players} found={room.found} />
          <h2>Latest</h2>
          <Feed found={room.found} lookup={lookup} limit={8} />
        </aside>
      </div>
    </div>
  );
}
