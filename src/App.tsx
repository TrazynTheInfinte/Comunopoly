import { useEffect, useState, type FormEvent } from 'react';
import './App.css';
import BrutalistBackground from './components/BrutalistBackground';
import RoomView from './components/RoomView';
import SoundToggle from './components/SoundToggle';
import { createRoom, joinRoom } from './lib/rooms';
import {
  clearActiveRoomCode,
  getOrCreatePlayerId,
  getStoredActiveRoomCode,
  getStoredName,
  storeActiveRoomCode,
  storeName,
} from './lib/playerIdentity';
import { wireAutoInitOnFirstInteraction } from './lib/sound';
import { useVersionWatcher } from './lib/versionWatcher';
import type { RoomMode } from './types/room';

type View = 'landing' | 'name-entry' | 'lobby';
type Mode = 'create' | 'join';

function App() {
  // Runs for the lifetime of the app regardless of which screen is
  // showing (App itself never unmounts, even though its return value
  // switches between the landing screen and RoomView) - so a stale tab
  // gets caught and reloaded even mid-game, not just on the menu.
  useVersionWatcher();

  // Browsers refuse to play audio until the page has had a real user
  // gesture - this covers whoever never touches the dedicated sound
  // toggle, since their very first click (Join/Create Room, anything)
  // still counts.
  useEffect(() => {
    wireAutoInitOnFirstInteraction();
  }, []);

  // A room from a previous session (or before an accidental refresh)
  // restores straight back into the lobby/game instead of the landing
  // screen - see lib/playerIdentity.ts. RoomView clears this again if
  // the room turns out to no longer exist (handleRoomNotFound below).
  const [view, setView] = useState<View>(() => (getStoredActiveRoomCode() ? 'lobby' : 'landing'));
  const [mode, setMode] = useState<Mode>('join');
  const [roomMode, setRoomMode] = useState<RoomMode>('experienced');
  const [name, setName] = useState(() => getStoredName());
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [activeRoomCode, setActiveRoomCode] = useState(() => getStoredActiveRoomCode() ?? '');
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
          ? await createRoom(playerId, trimmedName, roomMode)
          : await joinRoomAndReturnCode(roomCodeInput, trimmedName);

      storeName(trimmedName);
      storeActiveRoomCode(roomCode);
      setActiveRoomCode(roomCode);
      setView('lobby');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  /** The room we tried to restore into (or were just in) turned out to no longer exist - fall back to the landing screen instead of leaving RoomView stuck. */
  function handleRoomNotFound() {
    clearActiveRoomCode();
    setActiveRoomCode('');
    setView('landing');
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
    return (
      <>
        <BrutalistBackground />
        <SoundToggle />
        <RoomView roomCode={activeRoomCode} playerId={playerId} onRoomNotFound={handleRoomNotFound} />
      </>
    );
  }

  return (
    <main className="app">
      <BrutalistBackground />
      <SoundToggle />
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

          {mode === 'create' && (
            <fieldset className="room-mode-picker">
              <legend>Piece assignment</legend>
              <label>
                <input
                  type="radio"
                  name="roomMode"
                  checked={roomMode === 'experienced'}
                  onChange={() => setRoomMode('experienced')}
                />
                Experienced - everyone gets a random Piece automatically
              </label>
              <label>
                <input
                  type="radio"
                  name="roomMode"
                  checked={roomMode === 'beginner'}
                  onChange={() => setRoomMode('beginner')}
                />
                Beginner - everyone picks their own (without seeing its power)
              </label>
            </fieldset>
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
