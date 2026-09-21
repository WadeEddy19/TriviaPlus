import { acceptedStrings, normalize } from './normalize';
import type { Quiz, QuizAnswer } from './types';

export const MIN_TIME_LIMIT = 30;
export const MAX_TIME_LIMIT = 1800;
export const MAX_ANSWERS = 300;

export type ValidationResult = { ok: true; quiz: Quiz } | { ok: false; errors: string[] };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const nonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Validate a parsed quiz file. Returns a cleaned quiz or a list of readable errors. */
export function validateQuiz(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(input)) {
    return { ok: false, errors: ['The file must contain a single JSON object.'] };
  }

  if (input.schemaVersion !== 1) errors.push('"schemaVersion" must be 1.');
  if (!nonEmptyString(input.title)) errors.push('"title" is required and must be a non-empty string.');
  if (typeof input.description !== 'string') errors.push('"description" is required and must be a string.');
  if (!nonEmptyString(input.answerLabel)) errors.push('"answerLabel" is required and must be a non-empty string.');
  if (input.hintLabel !== undefined && typeof input.hintLabel !== 'string') {
    errors.push('"hintLabel" must be a string when present.');
  }

  const t = input.timeLimitSeconds;
  if (typeof t !== 'number' || !Number.isFinite(t)) {
    errors.push('"timeLimitSeconds" is required and must be a number.');
  } else if (!Number.isInteger(t) || t < MIN_TIME_LIMIT || t > MAX_TIME_LIMIT) {
    errors.push(`"timeLimitSeconds" must be a whole number from ${MIN_TIME_LIMIT} to ${MAX_TIME_LIMIT} (got ${t}).`);
  }

  const answers: QuizAnswer[] = [];
  if (!Array.isArray(input.answers)) {
    errors.push('"answers" is required and must be an array.');
  } else if (input.answers.length === 0) {
    errors.push('"answers" must not be empty.');
  } else if (input.answers.length > MAX_ANSWERS) {
    errors.push(`"answers" has ${input.answers.length} entries; the maximum is ${MAX_ANSWERS}.`);
  } else {
    input.answers.forEach((raw, i) => {
      const where = `Answer ${i + 1}`;
      if (!isObject(raw)) {
        errors.push(`${where} must be an object.`);
        return;
      }
      const label = typeof raw.display === 'string' && raw.display ? `${where} ("${raw.display}")` : where;
      let ok = true;
      if (typeof raw.display !== 'string') {
        errors.push(`${where}: "display" is required and must be a string.`);
        ok = false;
      } else if (!normalize(raw.display)) {
        errors.push(`${label}: "display" is empty after normalization.`);
        ok = false;
      }

      let aliases: string[] = [];
      if (raw.aliases !== undefined) {
        if (!Array.isArray(raw.aliases) || !raw.aliases.every((a) => typeof a === 'string')) {
          errors.push(`${label}: "aliases" must be an array of strings.`);
          ok = false;
        } else {
          aliases = raw.aliases as string[];
          aliases.forEach((a) => {
            if (!normalize(a)) {
              errors.push(`${label}: alias "${a}" is empty after normalization.`);
              ok = false;
            }
          });
        }
      }

      if (raw.hint !== undefined && typeof raw.hint !== 'string') {
        errors.push(`${label}: "hint" must be a string when present.`);
        ok = false;
      }

      if (ok) {
        const answer: QuizAnswer = { display: raw.display as string, aliases };
        if (typeof raw.hint === 'string') answer.hint = raw.hint;
        answers.push(answer);
      } else {
        answers.push({ display: '', aliases: [] });
      }
    });

    const withHint = input.answers.filter((a) => isObject(a) && a.hint !== undefined).length;
    if (withHint > 0 && withHint < input.answers.length) {
      errors.push(
        `"hint" is present on ${withHint} of ${input.answers.length} answers. Give every answer a hint or none of them.`,
      );
    }

    // Collisions: one normalized string accepted by two different answers.
    const owner = new Map<string, number>();
    answers.forEach((answer, i) => {
      if (!answer.display) return;
      for (const key of acceptedStrings(answer)) {
        const prev = owner.get(key);
        if (prev === undefined) {
          owner.set(key, i);
        } else if (prev !== i) {
          errors.push(
            `Answers ${prev + 1} ("${answers[prev].display}") and ${i + 1} ("${answer.display}") both accept "${key}".`,
          );
        }
      }
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  const quiz: Quiz = {
    schemaVersion: 1,
    title: (input.title as string).trim(),
    description: input.description as string,
    timeLimitSeconds: t as number,
    answerLabel: input.answerLabel as string,
    answers,
  };
  if (typeof input.hintLabel === 'string' && input.hintLabel) quiz.hintLabel = input.hintLabel;
  return { ok: true, quiz };
}

/** Parse file text and validate. JSON syntax errors become validation errors. */
export function parseQuizFile(text: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] };
  }
  return validateQuiz(parsed);
}
