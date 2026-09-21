import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { firebaseConfigured } from './firebase/init';
import { HostPage } from './pages/HostPage';
import { JoinPage } from './pages/JoinPage';
import { NotFound } from './pages/NotFound';
import { RoomPage } from './pages/RoomPage';
import { TvPage } from './pages/TvPage';

export function App() {
  if (!firebaseConfigured) {
    return (
      <main className="page narrow">
        <h1>TriviaGame</h1>
        <div className="card">
          <h2>Firebase is not configured</h2>
          <p>
            Copy <code>.env.example</code> to <code>.env</code> and fill in your Firebase web app config, then restart the
            dev server. On Netlify, set the same <code>VITE_FIREBASE_*</code> variables and redeploy. See the README.
          </p>
        </div>
      </main>
    );
  }
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<JoinPage />} />
        <Route path="/host" element={<HostPage />} />
        <Route path="/room/:code" element={<RoomPage />} />
        <Route path="/room/:code/tv" element={<TvPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
