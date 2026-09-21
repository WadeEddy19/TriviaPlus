import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Lobby } from '../components/Lobby';
import { Play } from '../components/Play';
import { Results } from '../components/Results';
import { useAutoEnd, useGameClock } from '../components/useGame';
import { useAuthUid, useRoom } from '../firebase/hooks';
import { joinRoom, setPlayerColor, trackPresence } from '../firebase/rooms';
import { pickColor, PLAYER_COLORS } from '../lib/colors';
import { cleanRoomCodeInput } from '../lib/roomCode';
import { load, NAME_KEY, save } from '../lib/storage';
import { MAX_NAME_LENGTH } from './JoinPage';
import { NotFound } from './NotFound';

export function RoomPage() {
  const code = cleanRoomCodeInput(useParams().code ?? '');
  const location = useLocation();
  const { uid, error: authError } = useAuthUid();
  const room = useRoom(code, uid);
  const me = uid ? room.players.find((p) => p.uid === uid) : undefined;
  const isHost = !!uid && room.meta?.hostUid === uid;
  const { remainingMs, expired } = useGameClock(room);
  useAutoEnd(code, room, expired);

  // Presence, once we are a player.
  const isPlayer = !!me;
  useEffect(() => {
    if (!uid || !isPlayer) return;
    return trackPresence(code, uid);
  }, [code, uid, isPlayer]);

  // Two players who joined at the same moment can get the same color. The later one moves.
  useEffect(() => {
    if (!me || room.players.length > PLAYER_COLORS.length) return;
    const clash = room.players.some(
      (p) =>
        p.uid !== me.uid &&
        p.color === me.color &&
        (p.joinedAt < me.joinedAt || (p.joinedAt === me.joinedAt && p.uid < me.uid)),
    );
    if (clash) {
      const taken = room.players.filter((p) => p.uid !== me.uid).map((p) => p.color);
      setPlayerColor(code, me.uid, pickColor(taken)).catch(() => {});
    }
  }, [code, me, room.players]);

  // Arriving from the join page: join automatically with the name entered there.
  const autoName = (location.state as { name?: string } | null)?.name;
  const autoJoined = useRef(false);
  useEffect(() => {
    if (!uid || room.loading || !room.exists || me || !autoName || autoJoined.current) return;
    autoJoined.current = true;
    joinRoom(code, uid, autoName).catch(() => {
      autoJoined.current = false;
    });
  }, [code, uid, room.loading, room.exists, me, autoName]);

  if (authError) return <NotFound message={`Could not sign in: ${authError}`} />;
  if (!uid || room.loading) return <Loading />;
  if (!room.exists) return <NotFound message={`There is no room with code ${code}. It may have expired.`} />;
  if (!me) return autoName && autoJoined.current ? <Loading /> : <JoinRoomForm code={code} uid={uid} />;

  const meta = room.meta!;
  if (meta.status === 'lobby') return <Lobby code={code} room={room} uid={uid} isHost={isHost} />;
  if (meta.status === 'playing') {
    return <Play code={code} room={room} uid={uid} isHost={isHost} remainingMs={remainingMs} expired={expired} />;
  }
  return <Results code={code} room={room} isHost={isHost} />;
}

function Loading() {
  return (
    <main className="page narrow center">
      <p className="muted">Loading…</p>
    </main>
  );
}

function JoinRoomForm({ code, uid }: { code: string; uid: string }) {
  const [name, setName] = useState(() => load(NAME_KEY) ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      save(NAME_KEY, trimmed);
      await joinRoom(code, uid, trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <main className="page narrow">
      <h1 className="logo">
        Trivia<span>Game</span>
      </h1>
      <form className="card join-form" onSubmit={submit}>
        <p>
          Joining room <strong className="inline-code">{code}</strong>
        </p>
        <label>
          Your name
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
            placeholder="Name"
            autoComplete="nickname"
            maxLength={MAX_NAME_LENGTH}
            autoFocus
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-big" type="submit" disabled={!name.trim() || busy}>
          {busy ? 'Joining…' : 'Join'}
        </button>
      </form>
    </main>
  );
}
