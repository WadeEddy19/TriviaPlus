# TriviaGame

A cooperative, JetPunk-style trivia game for the family. One person hosts a room, everyone joins from their own phone with a 4-letter room code, and the whole team types answers at the same time to fill the board before the clock runs out. The game shows who found each answer and hands out awards at the end.

- **Stack:** Vite + React + TypeScript, Firebase Realtime Database + Anonymous Auth, hosted as a static site on Netlify. There is no server code.
- **Routes:** `/` join · `/host` host dashboard (passcode) · `/room/CODE` player view · `/room/CODE/tv` shared TV view

## Setup

You need Node 20 or newer and a Google account.

### 1. Create a Firebase project

Go to the [Firebase console](https://console.firebase.google.com/), click **Add project**, and follow the prompts. Google Analytics is not needed.

### 2. Enable Anonymous sign-in

In the project, open **Build → Authentication → Get started → Sign-in method**, pick **Anonymous**, and enable it.

### 3. Create a Realtime Database and deploy the rules

1. Open **Build → Realtime Database → Create database**. Pick a location, then start in **locked mode**.
2. Deploy the rules in `database.rules.json`. Either:
   - paste the file's contents into the **Rules** tab of the Realtime Database page and click **Publish**, or
   - use the Firebase CLI:
     ```bash
     npm install -g firebase-tools
     firebase login
     firebase use --add        # pick your project
     firebase deploy --only database
     ```

### 4. Copy the web app config

1. In **Project settings → General → Your apps**, click the **Web** (`</>`) icon and register an app. Hosting is not needed.
2. Copy `.env.example` to `.env` and fill in the values from the config snippet Firebase shows you. `VITE_FIREBASE_DATABASE_URL` is on the Realtime Database page (for example `https://your-project-default-rtdb.firebaseio.com`).
3. Add the same `VITE_FIREBASE_*` variables in Netlify under **Site configuration → Environment variables**.

These values are not secret. They ship in the browser bundle of every Firebase web app; the database rules are what protect the data.

### 5. Set the host passcode

Set `VITE_HOST_PASSCODE` in `.env` and in Netlify. The `/host` page asks for it before letting anyone upload quizzes or create rooms. It is baked into the static bundle, so it keeps kids from wandering into the host page, but it is not real security.

### 6. Deploy on Netlify

1. Push this folder to a GitHub repository.
2. In Netlify, choose **Add new site → Import an existing project** and pick the repo. `netlify.toml` already sets the build command (`npm run build`), the publish directory (`dist`), and the SPA redirect.
3. Make sure the environment variables from steps 4 and 5 are set, then deploy. If you add or change variables later, trigger a new deploy; Vite reads them at build time.
4. Optional: in Firebase **Authentication → Settings → Authorized domains**, add your Netlify domain. Anonymous sign-in usually works without this, but it avoids surprises.

### Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. To test with several players on one computer, use one normal window and one private window (each gets its own anonymous identity). To test with phones on the same Wi-Fi, run `npm run dev -- --host` and open the network URL it prints.

Other scripts: `npm test` (unit tests), `npm run build` (typecheck + production build), `npm run preview` (serve the build).

## How to play

1. The host opens `/host`, enters the passcode, uploads quiz files (the `sample-quizzes/` folder has three to start with), types their name, and clicks **Create room**.
2. Everyone else goes to the site, enters the room code and a name, or scans the QR code in the lobby.
3. The host picks a quiz and clicks **Start game**. Optional: open `/room/CODE/tv` on a TV or laptop for everyone to watch.
4. Type answers. Correct answers are accepted as you type; no Enter needed. Pressing Enter on a wrong answer logs it as a wrong guess (shown at the end).
5. When time runs out, the board is complete, or the host clicks **Give up**, everyone sees the results. The host can click **Play again** to return to the lobby with the same players.

## Making quizzes

Quizzes are JSON files; see `sample-quizzes/` for examples and the build spec for the full format. The easiest way to make one is with an AI assistant: copy the prompt in [docs/quiz-prompt.md](docs/quiz-prompt.md) (also available on the host page under **Make a quiz with AI**), fill in the topic and time limit, and save the reply as a `.json` file. You can upload several files at once; any file with problems is rejected with a list of what to fix.

Tips:

- Answers are checked on every keystroke, so a short alias that is the start of another answer will be claimed first. For example, if "Niger" is unfound, typing "Nigeria" claims Niger at "Niger" and clears the box. That is how JetPunk works too, but avoid adding short aliases like postal codes ("MI" would fire while typing "Missouri").
- Matching ignores case, accents, punctuation, and a leading "The". Hyphenated or punctuated answers also accept the words typed with spaces, so "Guinea-Bissau" accepts both "guineabissau" and "guinea bissau".

## How it works

- **Identity:** each browser signs in anonymously. The uid is saved by Firebase, so refreshing the page rejoins as the same player with the same color.
- **Hidden answers:** when the host picks a quiz, the host's browser writes a SHA-256 hash of `ROOMCODE:normalized answer` for every accepted string. Players hash what they type and compare. The plaintext for slot *i* is only read when someone claims it, and the full key is read after the game ends. This keeps answers out of casual view in dev tools; it is a deterrent, not real security (the quiz library itself is readable by any signed-in user).
- **Claiming:** a correct answer runs a transaction on `found/{i}` that only writes if the slot is empty, so when two people type the same answer at once exactly one gets credit. The database rules enforce this too.
- **Timer:** the host writes a server timestamp at start. Every client computes the remaining time from that and its server clock offset, so all devices agree. Any client may end the game when time is up or the board is full.
- **Cleanup:** loading `/host` deletes rooms older than 24 hours.

## Project layout

```
src/
  lib/          pure logic, unit tested (normalize, hash, validateQuiz, stats, roomCode, ...)
  firebase/     init, quiz and room operations, React hooks
  components/   board, lobby, play, results, timeline, ...
  pages/        join, host, room, TV
sample-quizzes/ three valid quizzes (list, hinted, 60-second test)
docs/           quiz generation prompt
database.rules.json
netlify.toml
```

## Manual test plan

Run these before a family game night, with the dev server or the deployed site. Use a normal window and a private window (or two devices) as players A and B, with A as the host.

**Setup**
1. Open `/host`, enter a wrong passcode (rejected), then the right one.
2. Upload all three files in `sample-quizzes/` at once: all three are saved and appear in the library with title, answer count, and time.
3. Upload a broken file (for example, delete `"title"` from a copy, or add an alias that duplicates another answer): it is rejected with a clear message and nothing is saved.
4. Create a room as A. The lobby shows the room code, join URL, and a QR code. Scanning the QR code on a phone opens the room and asks for a name.

**Join and lobby**
5. In B, go to `/`, enter the code and a name. B appears in A's player list with a different color. B sees "Waiting for the host".
6. Enter a code that does not exist: B sees "No room with code …".
7. A picks the Rainbow quiz. B sees its title and description.

**Two players claiming the same answer at once**
8. Start the game. In both windows, type `re` and have the text `red` ready to finish; press the final `d` in both windows as close to simultaneously as possible (or paste `red` into both). Exactly one player gets credit, the slot shows in that player's color with their name, and the other player's box keeps its text. Pressing Enter in the losing window shows "Already found by …".
9. Type a wrong answer and press Enter: the box clears and shakes. It shows up under Wrong guesses at the end.

**Refresh mid-game**
10. While playing, refresh B's window. B returns to the same game with the same name, color, and score, and the timer shows the same remaining time as A. While B is reloading, A sees B marked as away, then back.

**Late join**
11. While the game is running, open a third window (another private window or device), join with the code. The new player goes straight into the game with a new color and can claim answers.

**Timer expiry**
12. Let the Rainbow quiz run out without finding everything (it is 60 seconds). The timer turns red in the final 30 seconds, input stops at 0:00, and every window moves to results. Missed answers show in red on the full board.
13. Check results: score, percent, time used, per-player counts and shares, awards (MVP, First Blood, Closer, Buzzer Beater if anyone scored in the last 10 seconds, Hot Streak), the timeline, and wrong guesses.
14. Start another game and find every answer: the game ends immediately with "Board cleared!". Start another and click **Give up** as the host: the game ends for everyone.

**Play again**
15. As A, click **Play again**. All windows return to the lobby with the same players; the quiz selection, board, finds, and wrong guesses are cleared. Pick the hinted quiz (South America by Capital) and start: each slot shows its capital next to the blank.

**TV view**
16. Open `/room/CODE/tv` in another window during the lobby, a game, and results. It shows large type, no input, and the room code at all times.

**Cleanup**
17. Rooms older than 24 hours are deleted the next time someone opens `/host` (check in the Firebase console's Data tab).
