import type { PlayerStats } from '../lib/stats';
import { formatDuration } from '../lib/time';

interface Props {
  players: PlayerStats[];
  timeLimitSeconds: number;
  startedAt: number;
}

const ROW_H = 30;
const LABEL_W = 110;
const WIDTH = 900;
const PAD_R = 16;

export function Timeline({ players, timeLimitSeconds, startedAt }: Props) {
  const rows = players.filter((p) => p.count > 0);
  if (rows.length === 0) return null;
  const plotW = WIDTH - LABEL_W - PAD_R;
  const height = rows.length * ROW_H + 28;
  const x = (sec: number) => LABEL_W + (Math.min(Math.max(sec, 0), timeLimitSeconds) / timeLimitSeconds) * plotW;
  const step = timeLimitSeconds <= 120 ? 15 : timeLimitSeconds <= 600 ? 60 : 300;
  const ticks: number[] = [];
  for (let t = 0; t <= timeLimitSeconds; t += step) ticks.push(t);

  return (
    <svg className="timeline" viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Timeline of answers by player">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={0} y2={rows.length * ROW_H} className="timeline-grid" />
          <text x={x(t)} y={rows.length * ROW_H + 18} className="timeline-tick" textAnchor="middle">
            {formatDuration(t * 1000)}
          </text>
        </g>
      ))}
      {rows.map((p, r) => {
        const cy = r * ROW_H + ROW_H / 2;
        return (
          <g key={p.uid}>
            <text x={LABEL_W - 10} y={cy + 5} textAnchor="end" className="timeline-label" fill={p.color}>
              {p.name.length > 12 ? `${p.name.slice(0, 11)}…` : p.name}
            </text>
            <line x1={LABEL_W} x2={WIDTH - PAD_R} y1={cy} y2={cy} className="timeline-row" />
            {p.answers.map((f) => (
              <circle key={f.slot} cx={x((f.at - startedAt) / 1000)} cy={cy} r={6} fill={p.color} className="timeline-dot">
                <title>
                  {f.display} · {formatDuration(f.at - startedAt)}
                </title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
