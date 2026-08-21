import { castShowTrialVoteAndSync } from '../lib/gameSync';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';

interface ShowTrialVoteBannerProps {
  room: Room;
  roomCode: string;
  playerId: string;
  game: GameState;
}

// Shown to every player, regardless of whose turn it is - a Show Trial
// vote runs independently of normal turn order, since anyone can be
// asked to weigh in at any time.
function ShowTrialVoteBanner({ room, roomCode, playerId, game }: ShowTrialVoteBannerProps) {
  const vote = game.activeVote;
  if (!vote) return null;

  const myVote = vote.votes[playerId];
  const votedCount = Object.keys(vote.votes).length;

  return (
    <div className="purchase-prompt card-prompt">
      <p className="card-title">Show Trial</p>
      <p>
        {room.players[vote.callerId]?.name} called a trial for{' '}
        {room.players[vote.targetPlayerId]?.name}. The caller's vote counts double. (
        {votedCount}/{game.turnOrder.length} voted)
      </p>
      {myVote ? (
        <p className="hint">You voted: {myVote}.</p>
      ) : (
        <div className="hand-card-action">
          <button onClick={() => castShowTrialVoteAndSync(roomCode, game, playerId, 'release')}>
            Release
          </button>
          <button onClick={() => castShowTrialVoteAndSync(roomCode, game, playerId, 'disappear')}>
            Disappear
          </button>
        </div>
      )}
    </div>
  );
}

export default ShowTrialVoteBanner;
