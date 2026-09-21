import type { Player } from '../lib/types';

interface Props {
  players: Player[];
  hostUid?: string;
  meUid?: string | null;
}

export function PlayerList({ players, hostUid, meUid }: Props) {
  if (players.length === 0) return <p className="muted">Nobody here yet.</p>;
  return (
    <ul className="player-list">
      {players.map((p) => (
        <li key={p.uid} className={p.connected ? '' : 'offline'}>
          <span className="avatar" style={{ background: p.color }}>
            {p.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="player-name">
            {p.name}
            {p.uid === meUid && <span className="tag">you</span>}
            {p.uid === hostUid && <span className="tag">host</span>}
          </span>
          <span className="conn" title={p.connected ? 'Connected' : 'Disconnected'}>
            {p.connected ? '' : 'away'}
          </span>
        </li>
      ))}
    </ul>
  );
}
