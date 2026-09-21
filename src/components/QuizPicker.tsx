import { useEffect, useState } from 'react';
import { subscribeQuizzes } from '../firebase/quizzes';
import { selectQuiz } from '../firebase/rooms';
import type { StoredQuiz } from '../lib/types';
import { formatDuration } from '../lib/time';

export function QuizPicker({ code, selectedId }: { code: string; selectedId?: string }) {
  const [quizzes, setQuizzes] = useState<StoredQuiz[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeQuizzes(setQuizzes), []);

  async function pick(q: StoredQuiz) {
    setBusy(q.id);
    setError(null);
    try {
      await selectQuiz(code, q);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (quizzes === null) return <p className="muted">Loading quizzes…</p>;
  if (quizzes.length === 0) {
    return (
      <p className="muted">
        No quizzes yet.{' '}
        <a href="/host" target="_blank" rel="noreferrer">
          Upload some on the host page
        </a>
        .
      </p>
    );
  }
  return (
    <div>
      {error && <p className="error">{error}</p>}
      <ul className="quiz-picker">
        {quizzes.map((q) => (
          <li key={q.id}>
            <button
              type="button"
              className={`quiz-option ${q.id === selectedId ? 'selected' : ''}`}
              onClick={() => pick(q)}
              disabled={busy !== null}
            >
              <span className="quiz-option-title">{q.title}</span>
              <span className="quiz-option-meta">
                {q.answers.length} answers · {formatDuration(q.timeLimitSeconds * 1000)}
                {busy === q.id && ' · loading…'}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="small muted">
        <a href="/host" target="_blank" rel="noreferrer">
          Upload more quizzes
        </a>
      </p>
    </div>
  );
}
