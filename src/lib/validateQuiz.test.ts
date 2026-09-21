import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseQuizFile, validateQuiz } from './validateQuiz';

const base = () => ({
  schemaVersion: 1,
  title: 'Test',
  description: 'Name them.',
  timeLimitSeconds: 60,
  answerLabel: 'Thing',
  answers: [
    { display: 'Alpha', aliases: ['A'] },
    { display: 'Beta', aliases: [] },
  ],
});

const errorsOf = (input: unknown) => {
  const r = validateQuiz(input);
  return r.ok ? [] : r.errors;
};

describe('validateQuiz', () => {
  it('accepts a valid quiz', () => {
    const r = validateQuiz(base());
    expect(r.ok).toBe(true);
  });

  it('defaults missing aliases to an empty array', () => {
    const q = base();
    q.answers = [{ display: 'Alpha' } as never];
    const r = validateQuiz(q);
    expect(r.ok && r.quiz.answers[0].aliases).toEqual([]);
  });

  it('rejects non-objects and bad JSON', () => {
    expect(errorsOf([])).toHaveLength(1);
    const r = parseQuizFile('{ nope');
    expect(r.ok).toBe(false);
  });

  it('reports missing and mistyped fields', () => {
    const errors = errorsOf({ schemaVersion: 2, title: '', description: 5, answerLabel: null, answers: 'x' });
    expect(errors.join('\n')).toMatch(/schemaVersion/);
    expect(errors.join('\n')).toMatch(/"title"/);
    expect(errors.join('\n')).toMatch(/"description"/);
    expect(errors.join('\n')).toMatch(/"answerLabel"/);
    expect(errors.join('\n')).toMatch(/"timeLimitSeconds"/);
    expect(errors.join('\n')).toMatch(/"answers"/);
  });

  it('enforces the time limit range', () => {
    expect(errorsOf({ ...base(), timeLimitSeconds: 29 })).toHaveLength(1);
    expect(errorsOf({ ...base(), timeLimitSeconds: 1801 })).toHaveLength(1);
    expect(errorsOf({ ...base(), timeLimitSeconds: 30 })).toHaveLength(0);
    expect(errorsOf({ ...base(), timeLimitSeconds: 1800 })).toHaveLength(0);
  });

  it('enforces the answer count', () => {
    expect(errorsOf({ ...base(), answers: [] })[0]).toMatch(/empty/);
    const many = Array.from({ length: 301 }, (_, i) => ({ display: `Answer ${i}`, aliases: [] }));
    expect(errorsOf({ ...base(), answers: many })[0]).toMatch(/301/);
    expect(errorsOf({ ...base(), answers: many.slice(0, 300) })).toHaveLength(0);
  });

  it('rejects strings that normalize to empty', () => {
    expect(errorsOf({ ...base(), answers: [{ display: '!!!', aliases: [] }] })[0]).toMatch(/empty/);
    expect(errorsOf({ ...base(), answers: [{ display: 'Alpha', aliases: ['  '] }] })[0]).toMatch(/alias/);
  });

  it('rejects aliases that are not strings', () => {
    expect(errorsOf({ ...base(), answers: [{ display: 'Alpha', aliases: [1] }] })[0]).toMatch(/aliases/);
  });

  it('detects display/display collisions after normalization', () => {
    const errors = errorsOf({
      ...base(),
      answers: [
        { display: 'The Gambia', aliases: [] },
        { display: 'Gambia', aliases: [] },
      ],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/"gambia"/);
  });

  it('detects alias collisions', () => {
    const errors = errorsOf({
      ...base(),
      answers: [
        { display: 'Niger', aliases: ['NE'] },
        { display: 'Nigeria', aliases: ['N.E.'] },
      ],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Answers 1 \("Niger"\) and 2 \("Nigeria"\) both accept "ne"/);
  });

  it('detects alias vs display collisions', () => {
    const errors = errorsOf({
      ...base(),
      answers: [
        { display: 'Georgia', aliases: [] },
        { display: 'Sakartvelo', aliases: ['georgia'] },
      ],
    });
    expect(errors).toHaveLength(1);
  });

  it('allows an alias that repeats its own display', () => {
    expect(errorsOf({ ...base(), answers: [{ display: 'UK', aliases: ['U.K.'] }] })).toHaveLength(0);
  });

  it('requires hints on all answers or none', () => {
    const errors = errorsOf({
      ...base(),
      answers: [
        { display: 'Alpha', aliases: [], hint: 'first' },
        { display: 'Beta', aliases: [] },
      ],
    });
    expect(errors[0]).toMatch(/1 of 2/);
    expect(
      errorsOf({
        ...base(),
        answers: [
          { display: 'Alpha', aliases: [], hint: 'first' },
          { display: 'Beta', aliases: [], hint: 'second' },
        ],
      }),
    ).toHaveLength(0);
  });

  it.each(['sample-quizzes', 'quizzes'])('accepts every quiz in %s/', (folder) => {
    const dir = fileURLToPath(new URL(`../../${folder}`, import.meta.url));
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const r = parseQuizFile(readFileSync(join(dir, f), 'utf8'));
      expect(r.ok ? [] : r.errors, f).toEqual([]);
    }
  });
});
