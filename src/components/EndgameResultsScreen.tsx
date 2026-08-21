import { STARTING_PIECES } from '../data/pieces';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';
import './EndgameResultsScreen.css';

interface EndgameResultsScreenProps {
  room: Room;
  game: GameState;
}

function pieceName(pieceId: string): string {
  return STARTING_PIECES.find((piece) => piece.id === pieceId)?.name ?? pieceId;
}

// Shown once every Score is in (game.endgame.results is set) - replaces
// the board entirely, since the game is genuinely over at this point.
function EndgameResultsScreen({ room, game }: EndgameResultsScreenProps) {
  const results = game.endgame?.results;
  if (!results) return null;

  const ranked = Object.entries(results).sort(([, a], [, b]) => b - a);
  const spectators = game.turnOrder.filter((id) => game.players[id]?.isSpectating);

  return (
    <main className="endgame-screen">
      <h1 className="endgame-title">Endgame</h1>
      <ul className="endgame-ranking">
        {ranked.map(([id, score], index) => (
          <li key={id} className={index === 0 ? 'is-winner' : ''}>
            <span className="endgame-rank">#{index + 1}</span>
            <span className="endgame-name">
              {room.players[id]?.name} ({pieceName(game.players[id].pieceId)})
            </span>
            <span className="endgame-score">{score}</span>
          </li>
        ))}
      </ul>

      {spectators.length > 0 && (
        <p className="endgame-spectators">
          Disappeared with no Piece left to take: {spectators.map((id) => room.players[id]?.name).join(', ')}.
          No Score - out of the running.
        </p>
      )}
    </main>
  );
}

export default EndgameResultsScreen;
