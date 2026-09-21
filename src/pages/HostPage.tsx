import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import promptDoc from '../../docs/quiz-prompt.md?raw';
import { ensureAuth } from '../firebase/init';
import { deleteQuiz, saveQuiz, subscribeQuizzes } from '../firebase/quizzes';
import { cleanupOldRooms, createRoom, joinRoom } from '../firebase/rooms';
import { HOST_KEY, load, NAME_KEY, save } from '../lib/storage';
import { formatDuration } from '../lib/time';
import type { StoredQuiz } from '../lib/types';
import { parseQuizFile } from '../lib/validateQuiz';
import { MAX_NAME_LENGTH } from './JoinPage';

const PASSCODE = import.meta.env.VITE_HOST_PASSCODE ?? '';
const QUIZ_PROMPT = promptDoc.match(/```\n([\s\S]*?)```/)?.[1]?.trim() ?? promptDoc;

export function HostPage() {
  const [unlocked, setUnlocked] = useState(() => !!PASSCODE && load(HOST_KEY) === PASSCODE);
  if (!unlocked) return <PasscodeGate onUnlock={() => setUnlocked(true)} />;
  return <HostDashboard />;
}

function PasscodeGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);

  if (!PASSCODE) {
    return (
      <main className="page narrow">
        <h1>Host</h1>
        <div className="card">
          <p>
            Hosting is disabled because <code>VITE_HOST_PASSCODE</code> is not set. Add it to <code>.env</code> (or the
            Netlify environment) and rebuild.
          </p>
        </div>
      </main>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (value === PASSCODE) {
      save(HOST_KEY, value);
      onUnlock();
    } else {
      setWrong(true);
    }
  }

  return (
    <main className="page narrow">
      <h1>Host</h1>
      <form className="card join-form" onSubmit={submit}>
        <label>
          Host passcode
          <input
            className="input"
            type="password"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setWrong(false);
            }}
            autoFocus
          />
        </label>
        {wrong && <p className="error">That's not it.</p>}
        <button className="btn btn-primary btn-big" type="submit" disabled={!value}>
          Unlock
        </button>
      </form>
      <p className="center small">
        <Link to="/">Back to join</Link>
      </p>
    </main>
  );
}

interface UploadResult {
  file: string;
  ok: boolean;
  messages: string[];
}

function HostDashboard() {
  const navigate = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<StoredQuiz[] | null>(null);
  const [name, setName] = useState(() => load(NAME_KEY) ?? '');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    ensureAuth()
      .then((u) => {
        setUid(u.uid);
        unsub = subscribeQuizzes(setQuizzes);
        cleanupOldRooms().catch(() => {});
      })
      .catch((e) => setCreateError(e instanceof Error ? e.message : String(e)));
    return () => unsub?.();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!uid || !trimmed) return;
    setCreating(true);
    setCreateError(null);
    try {
      save(NAME_KEY, trimmed);
      const code = await createRoom(uid);
      await joinRoom(code, uid, trimmed);
      navigate(`/room/${code}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
      setCreating(false);
    }
  }

  async function handleFiles(files: FileList | File[]) {
    const list = [...files];
    if (list.length === 0) return;
    setUploading(true);
    const results: UploadResult[] = [];
    for (const file of list) {
      const result = parseQuizFile(await file.text());
      if (!result.ok) {
        results.push({ file: file.name, ok: false, messages: result.errors });
        continue;
      }
      try {
        await saveQuiz(result.quiz);
        results.push({
          file: file.name,
          ok: true,
          messages: [`Saved "${result.quiz.title}" (${result.quiz.answers.length} answers).`],
        });
      } catch (err) {
        results.push({ file: file.name, ok: false, messages: [err instanceof Error ? err.message : String(err)] });
      }
    }
    setUploads(results);
    setUploading(false);
  }

  async function remove(q: StoredQuiz) {
    if (window.confirm(`Delete "${q.title}"? This cannot be undone.`)) await deleteQuiz(q.id);
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(QUIZ_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the prompt is visible below.
    }
  }

  return (
    <main className="page host">
      <h1>Host</h1>

      <section className="card">
        <h2>Start a game</h2>
        <form className="row-form" onSubmit={create}>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
            placeholder="Your name"
            maxLength={MAX_NAME_LENGTH}
            aria-label="Your name"
          />
          <button className="btn btn-primary" type="submit" disabled={!uid || !name.trim() || creating}>
            {creating ? 'Creating…' : 'Create room'}
          </button>
        </form>
        <p className="small muted">You'll pick a quiz in the lobby. You play too.</p>
        {createError && <p className="error">{createError}</p>}
      </section>

      <section className="card">
        <h2>Upload quizzes</h2>
        <label
          className={`dropzone ${dragging ? 'dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
        >
          <input
            type="file"
            accept=".json,application/json"
            multiple
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = '';
            }}
            disabled={!uid || uploading}
          />
          <span>{uploading ? 'Uploading…' : 'Drop .json quiz files here, or tap to choose'}</span>
        </label>
        {uploads.length > 0 && (
          <ul className="upload-results">
            {uploads.map((u, i) => (
              <li key={i} className={u.ok ? 'ok' : 'bad'}>
                <strong>
                  {u.ok ? '✓' : '✗'} {u.file}
                </strong>
                <ul>
                  {u.messages.map((m, j) => (
                    <li key={j}>{m}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <details className="prompt-details">
          <summary>Make a quiz with AI</summary>
          <p className="small">
            Paste this into an AI assistant, fill in the topic and time, save the reply as a <code>.json</code> file, and
            upload it here.
          </p>
          <button type="button" className="btn btn-small" onClick={copyPrompt}>
            {copied ? 'Copied!' : 'Copy prompt'}
          </button>
          <pre className="prompt">{QUIZ_PROMPT}</pre>
        </details>
      </section>

      <section className="card">
        <h2>Library</h2>
        {quizzes === null ? (
          <p className="muted">Loading…</p>
        ) : quizzes.length === 0 ? (
          <p className="muted">No quizzes yet. Upload one above (there are samples in sample-quizzes/).</p>
        ) : (
          <table className="library">
            <thead>
              <tr>
                <th>Title</th>
                <th>Answers</th>
                <th>Time</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {quizzes.map((q) => (
                <tr key={q.id}>
                  <td>
                    <strong>{q.title}</strong>
                    <div className="small muted">{q.description}</div>
                  </td>
                  <td>{q.answers.length}</td>
                  <td>{formatDuration(q.timeLimitSeconds * 1000)}</td>
                  <td>
                    <button type="button" className="btn btn-small btn-danger" onClick={() => remove(q)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
