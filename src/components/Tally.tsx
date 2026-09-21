import type { Found, Player } from '../lib/types';

interface Props {
  players: Player[];
  found: Map<number, Found>;
}

export function Tally({ players, found }: Props) {
  const counts = new Map<string, number>();
  found.forEach((f) => counts.set(f.uid, (counts.get(f.uid) ?? 0) + 1));
  const rows = [...players].sort((a, b) => (counts.get(b.uid) ?? 0) - (counts.get(a.uid) ?? 0));
  return (
    <ul className="tally">
      {rows.map((p) => (
        <li key={p.uid} className={`tally-item ${p.connected ? '' : 'offline'}`} style={{ '--c': p.color } as React.CSSProperties}>
          <span className="tally-name">{p.name}</span>
          <span className="tally-count">{counts.get(p.uid) ?? 0}</span>
        </li>
      ))}
    </ul>
  );
}
