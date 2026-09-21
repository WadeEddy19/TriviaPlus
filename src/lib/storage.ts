/** localStorage that never throws (private mode, blocked storage). */
export function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export const NAME_KEY = 'triviagame.name';
export const HOST_KEY = 'triviagame.hostPasscode';
