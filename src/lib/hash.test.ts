import { describe, expect, it } from 'vitest';
import { answerHash, sha256Hex } from './hash';

describe('hash', () => {
  it('computes a known SHA-256', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('salts with the room code', async () => {
    expect(await answerHash('ABCD', 'france')).toBe(await sha256Hex('ABCD:france'));
    expect(await answerHash('ABCD', 'france')).not.toBe(await answerHash('WXYZ', 'france'));
  });

  it('returns 64 lowercase hex characters', async () => {
    expect(await answerHash('ABCD', 'são tomé')).toMatch(/^[0-9a-f]{64}$/);
  });
});
