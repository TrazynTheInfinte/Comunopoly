import { useState } from 'react';
import './App.css';

// A React "component" is just a function that returns JSX (the
// HTML-looking syntax below). React calls this function again - a
// "re-render" - whenever its state changes, and updates the real page to
// match whatever the function returns.
function App() {
  // useState gives this component a piece of memory that survives
  // between re-renders. Calling the setter (e.g. setView) both stores the
  // new value AND tells React "re-render this component."
  const [view, setView] = useState<'landing' | 'join'>('landing');
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');

  return (
    <main className="app">
      <h1 className="title">COMUNOPOLY</h1>
      <p className="subtitle">The People's Monopoly</p>

      {view === 'landing' && (
        <div className="actions">
          <button onClick={() => setView('join')}>Join Room</button>
          {/* Creating a room is really just "join with a freshly
              generated Room Code" - left disabled until the Firebase
              room logic exists to actually generate and store one. */}
          <button disabled>Create Room</button>
        </div>
      )}

      {view === 'join' && (
        <form
          className="join-form"
          onSubmit={(event) => {
            // Forms reload the page by default when submitted - we're
            // handling submission ourselves, so stop that.
            event.preventDefault();
            console.log('TODO: join room', { name, roomCode });
          }}
        >
          <label>
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Comrade..."
              required
            />
          </label>
          <label>
            Room Code
            <input
              value={roomCode}
              onChange={(event) =>
                setRoomCode(event.target.value.toUpperCase())
              }
              placeholder="XXXX"
              required
            />
          </label>
          <button type="submit">Enter</button>
          <button type="button" onClick={() => setView('landing')}>
            Back
          </button>
        </form>
      )}
    </main>
  );
}

export default App;
