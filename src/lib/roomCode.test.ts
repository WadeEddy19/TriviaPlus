import { describe, expect, it } from 'vitest';
import { cleanRoomCodeInput, generateRoomCode, isValidRoomCode, ROOM_CODE_ALPHABET } from './roomCode';

describe('roomCode', () => {
  it('never uses I, O or L', () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[IOL]/);
    for (let i = 0; i < 500; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[A-Z]{4}$/);
      expect(isValidRoomCode(code)).toBe(true);
    }
  });

  it('covers the alphabet edges', () => {
    expect(generateRoomCode(() => 0)).toBe('AAAA');
    expect(generateRoomCode(() => 0.9999)).toBe('ZZZZ');
  });

  it('validates and cleans input', () => {
    expect(isValidRoomCode('ABCO')).toBe(false);
    expect(isValidRoomCode('ABC')).toBe(false);
    expect(cleanRoomCodeInput(' ab-cd9e')).toBe('ABCD');
  });
});
