import type { Found, Slot } from '../lib/types';

interface Props {
  slotCount: number;
  slots: Slot[];
  found: Map<number, Found>;
  lookup: (uid: string) => { name: string; color: string };
  answerLabel?: string;
  hintLabel?: string;
  /** Full answer key, shown in red for unfound slots once the game is over. */
  revealed?: string[];
  size?: 'normal' | 'large';
}

export function Board({ slotCount, slots, found, lookup, answerLabel, hintLabel, revealed, size = 'normal' }: Props) {
  const hinted = slots.some((s) => s?.hint !== undefined);
  return (
    <div className={`board-wrap board-${size}`}>
      <div className="board-labels">
        {hinted && <span>{hintLabel || 'Hint'}</span>}
        <span>{answerLabel || 'Answer'}</span>
      </div>
      <ol className={`board ${hinted ? 'board-hinted' : ''}`}>
        {Array.from({ length: slotCount }, (_, i) => {
          const f = found.get(i);
          const hint = slots[i]?.hint;
          if (f) {
            const p = lookup(f.uid);
            return (
              <li key={`${i}-found`} className="slot slot-found" style={{ '--c': p.color } as React.CSSProperties}>
                {hinted && <span className="slot-hint">{hint}</span>}
                <span className="slot-answer">{f.display}</span>
                <span className="slot-by">{p.name}</span>
              </li>
            );
          }
          const missed = revealed?.[i];
          return (
            <li key={`${i}-open`} className={`slot ${missed ? 'slot-missed' : 'slot-open'}`}>
              {hinted && <span className="slot-hint">{hint}</span>}
              <span className="slot-answer">{missed ?? ' '}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
