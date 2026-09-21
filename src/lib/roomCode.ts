/** Uppercase letters without I, O and L (too easy to confuse with 1 and 0). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;

export function generateRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** Clean up user-typed input: uppercase, letters only, max 4 characters. */
export function cleanRoomCodeInput(input: string): string {
  return input.toUpperCase().replace(/[^A-Z]/g, '').slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  return [...code].every((c) => ROOM_CODE_ALPHABET.includes(c));
}
