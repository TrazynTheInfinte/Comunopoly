import { useState, type FormEvent } from 'react';
import './App.css';
import RoomView from './components/RoomView';
import { createRoom, joinRoom } from './lib/rooms';
import {
  getOrCreatePlayerId,
  getStoredName,
  storeName,
} from './lib/playerIdentity';
import { useVersionWatcher } from './lib/versionWatcher';

type View = 'landing' | 'name-entry' | 'lobby';
type Mode = 'create' | 'join';

function App() {
  // Runs for the lifetime of the app regardless of which screen is
  // showing (App itself never unmounts, even though its return value
  // switches between the landing screen and RoomView) - so a stale tab
  // gets caught and reloaded even mid-game, not just on the menu.
  useVersionWatcher();

  const [view, setView] = useState<View>('landing');
  const [mode, setMode] = useState<Mode>('join');
  const [name, setName] = useState(() => getStoredName());
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [activeRoomCode, setActiveRoomCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // A player's identity is just a random ID this browser remembers -
  // no accounts. useState's "lazy initializer" (passing a function
  // instead of a value) means getOrCreatePlayerId() only runs once, on
  // the first render, instead of on every re-render.
  const [playerId] = useState(() => getOrCreatePlayerId());

  function openNameEntry(nextMode: Mode) {
    setMode(nextMode);
    setError('');
    setView('name-entry');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); // don't let the browser reload the page
    setError('');
    setIsSubmitting(true);

    try {
      const trimmedName = name.trim();
      if (!trimmedName) {
        throw new Error('Enter a name.');
      }

      const roomCode =
        mode === 'create'
          ? await createRoom(playerId, trimmedName)
          : await joinRoomAndReturnCode(roomCodeInput, trimmedName);

      storeName(trimmedName);
      setActiveRoomCode(roomCode);
      setView('lobby');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function joinRoomAndReturnCode(
    codeInput: string,
    trimmedName: string,
  ): Promise<string> {
    const code = codeInput.trim().toUpperCase();
    if (!code) {
      throw new Error('Enter a room code.');
    }
    await joinRoom(code, playerId, trimmedName);
    return code;
  }

  if (view === 'lobby') {
    return <RoomView roomCode={activeRoomCode} playerId={playerId} />;
  }

  return (
    <main className="app">
      <p className="build-badge">build {__BUILD_SHA__}</p>
      <h1 className="title">COMUNOPOLY</h1>
      <p className="subtitle">The People's Monopoly</p>

      {view === 'landing' && (
        <div className="actions">
          <button onClick={() => openNameEntry('join')}>Join Room</button>
          <button onClick={() => openNameEntry('create')}>Create Room</button>
        </div>
      )}

      {view === 'name-entry' && (
        <form className="join-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Comrade..."
              autoFocus
              required
            />
          </label>

          {mode === 'join' && (
            <label>
              Room Code
              <input
                value={roomCodeInput}
                onChange={(event) =>
                  setRoomCodeInput(event.target.value.toUpperCase())
                }
                placeholder="XXXX"
                required
              />
            </label>
          )}

          {error && <p className="error">{error}</p>}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? 'Please wait...'
              : mode === 'create'
                ? 'Create Room'
                : 'Join Room'}
          </button>
          <button
            type="button"
            onClick={() => setView('landing')}
            disabled={isSubmitting}
          >
            Back
          </button>
        </form>
      )}
    </main>
  );
}

export default App;
