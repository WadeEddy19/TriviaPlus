import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ensureAuth } from '../firebase/init';
import { roomExists } from '../firebase/rooms';
import { cleanRoomCodeInput, isValidRoomCode } from '../lib/roomCode';
import { load, NAME_KEY, save } from '../lib/storage';

export const MAX_NAME_LENGTH = 24;

export function JoinPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [name, setName] = useState(() => load(NAME_KEY) ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canJoin = isValidRoomCode(code) && name.trim().length > 0;

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!canJoin) return;
    setBusy(true);
    setError(null);
    try {
      await ensureAuth();
      if (!(await roomExists(code))) {
        setError(`No room with code ${code}. Check the code on the host's screen.`);
        return;
      }
      save(NAME_KEY, name.trim());
      navigate(`/room/${code}`, { state: { name: name.trim() } });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page narrow">
      <h1 className="logo">
        Trivia<span>Game</span>
      </h1>
      <form className="card join-form" onSubmit={join}>
        <label>
          Room code
          <input
            className="input input-code"
            value={code}
            onChange={(e) => setCode(cleanRoomCodeInput(e.target.value))}
            placeholder="ABCD"
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            maxLength={4}
            autoFocus
          />
        </label>
        <label>
          Your name
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
            placeholder="Name"
            autoComplete="nickname"
            maxLength={MAX_NAME_LENGTH}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-big" type="submit" disabled={!canJoin || busy}>
          {busy ? 'Joining…' : 'Join'}
        </button>
      </form>
      <p className="center small">
        <Link to="/host">Host a game</Link>
      </p>
    </main>
  );
}
