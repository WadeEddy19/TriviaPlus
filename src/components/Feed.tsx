import type { Found } from '../lib/types';

interface Props {
  found: Map<number, Found>;
  lookup: (uid: string) => { name: string; color: string };
  limit?: number;
}

export function Feed({ found, lookup, limit = 5 }: Props) {
  const recent = [...found.values()].sort((a, b) => b.at - a.at).slice(0, limit);
  if (recent.length === 0) return <p className="feed-empty muted">No answers yet. Start typing!</p>;
  return (
    <ul className="feed">
      {recent.map((f) => {
        const p = lookup(f.uid);
        return (
          <li key={`${f.uid}-${f.at}-${f.display}`} className="feed-item">
            <span className="dot" style={{ background: p.color }} />
            <strong style={{ color: p.color }}>{p.name}</strong> found {f.display}
          </li>
        );
      })}
    </ul>
  );
}
