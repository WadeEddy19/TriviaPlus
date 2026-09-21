/** 12 player colors, chosen to stay distinct on the dark background. */
export const PLAYER_COLORS = [
  '#ff6b6b', // red
  '#ff922b', // orange
  '#fcc419', // yellow
  '#94d82d', // lime
  '#38d9a9', // teal
  '#22b8cf', // cyan
  '#4dabf7', // blue
  '#9775fa', // violet
  '#e599f7', // lavender
  '#f06595', // pink
  '#c9a27e', // tan
  '#f1f3f5', // white
];

export const UNKNOWN_COLOR = '#868e96';

/** First palette color not already taken; wraps around past 12 players. */
export function pickColor(taken: string[]): string {
  const free = PLAYER_COLORS.find((c) => !taken.includes(c));
  return free ?? PLAYER_COLORS[taken.length % PLAYER_COLORS.length];
}
