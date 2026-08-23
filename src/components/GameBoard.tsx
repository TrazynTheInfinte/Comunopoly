import { useCallback, useEffect, useRef, useState } from 'react';
import { getTile } from '../data/board';
import { STARTING_PIECES } from '../data/pieces';
import { findCard } from '../data/cards';
import type { CardDeck } from '../types/game';
import {
  acceptVolgaOfferAndSync,
  accuseOfTrotskyAndSync,
  acknowledgeCardAndSync,
  buyPropertyAndSync,
  declineVolgaOfferAndSync,
  endTurnAndSync,
  rejoinFromAfkAndSync,
  rollDiceAndSync,
  skipPurchaseAndSync,
} from '../lib/gameSync';
import { isPlayerAway } from '../lib/presence';
import { playCardDraw } from '../lib/sound';
import type { Room } from '../types/room';
import ActionModal from './ActionModal';
import AnimatedNumber from './AnimatedNumber';
import Board from './Board';
import CardChoicePrompt from './CardChoicePrompt';
import CardTargetPrompt from './CardTargetPrompt';
import CatRedirectPrompt from './CatRedirectPrompt';
import DevPanel from './DevPanel';
import DiceRoller from './DiceRoller';
import EndgameResultsScreen from './EndgameResultsScreen';
import EndgameTargetPrompt from './EndgameTargetPrompt';
import FlyingCard from './FlyingCard';
import Hand from './Hand';
import NkvdQuizPrompt from './NkvdQuizPrompt';
import PieceChoicePrompt from './PieceChoicePrompt';
import PieceInfoPanel from './PieceInfoPanel';
import RubberDuckEncounterBanner from './RubberDuckEncounterBanner';
import ShowTrialVoteBanner from './ShowTrialVoteBanner';
import SmuggleOfferPrompt from './SmuggleOfferPrompt';
import YourTurnBanner from './YourTurnBanner';
import { useAfkSelfCheck } from './useAfkSelfCheck';
import { useCardFlight } from './useCardFlight';
import { useGameMusic } from './useGameMusic';
import { useHostAfkWatchdog } from './useHostAfkWatchdog';
import { useIsDesktop } from './useIsDesktop';
import { useSoundEvents } from './useSoundEvents';
import { useStagedGame } from './useStagedGame';
import { useYourTurnChime } from './useYourTurnChime';
import './GameBoard.css';

interface GameBoardProps {
  room: Room;
  roomCode: string;
  playerId: string;
  /** Passed straight through to EndgameResultsScreen (see RoomView) - unused otherwise, since there's no leave-mid-game affordance, only from the Lobby and the Endgame results screen. */
  onLeave: () => void;
}

function pieceName(pieceId: string): string {
  return STARTING_PIECES.find((piece) => piece.id === pieceId)?.name ?? pieceId;
}

// Player IDs are crypto.randomUUID() (see lib/playerIdentity.ts) - a
// pattern distinctive enough that a plain regex match against one never
// collides with normal log text. engine.ts can't put a player's actual
// display name in a log message itself (it only knows player IDs -
// display names live on the separate Room document, see the standing
// note in game/engine.ts), so a message that needs to name someone by
// name embeds their raw ID instead, and this substitutes it back in at
// display time, where the Room is available.
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function formatLogEntry(entry: string, room: Room): string {
  return entry.replace(UUID_PATTERN, (id) => room.players[id]?.name ?? 'a departed player');
}

// The actual board visual lives in <Board> below; everything in this
// file past that is still the plain functional readout (status, actions,
// decision prompts, event log) - that part isn't a placeholder, it's
// just not meant to be pretty, since decisions need to stay legible.
function GameBoard({ room, roomCode, playerId, onLeave }: GameBoardProps) {
  const [isRolling, setIsRolling] = useState(false);
  const [accusedId, setAccusedId] = useState('');
  const [rollTrigger, setRollTrigger] = useState(0);
  // A card visibly flying from the deck pile just clicked (Board.tsx's
  // onDeckClick reports where) to wherever the real reveal panel lands
  // (layoutActionsRef below) - purely cosmetic, cleared once the flight
  // animation finishes on its own (see FlyingCard).
  const [cardFlight, setCardFlight] = useState<{ deck: CardDeck; from: DOMRect; to: DOMRect } | null>(null);
  const layoutActionsRef = useRef<HTMLElement>(null);
  // Only consulted below a screen-width breakpoint (see GameBoard.css) -
  // above it, CSS shows every section regardless of this and the tab
  // buttons themselves stay hidden, so this state is simply inert on a
  // wide screen rather than needing its own "are we on mobile" check.
  const [mobileTab, setMobileTab] = useState<'board' | 'status'>('board');
  // Drives the desktop-only dice-roller/propaganda-banner swap below
  // (playtest feedback) - see useIsDesktop for why this needs to be a
  // real JS check rather than pure CSS: only one DiceRoller can ever be
  // mounted at a time, or its sound effects would double up.
  const isDesktop = useIsDesktop();
  // Delays revealing anything about a state update besides the mover's
  // token walking there, so a card that Disappears the drawer (or any
  // other landing effect) doesn't seem to happen before their piece has
  // visibly finished moving - see useStagedGame for the full story.
  const game = useStagedGame(room.game);
  // Hooks can't be called conditionally, so this (and useStagedGame
  // above) has to run before the `if (!game) return null` guard below -
  // an empty array is a harmless placeholder for the one render where
  // game isn't available yet.
  useSoundEvents(game?.log ?? []);
  useGameMusic(game);
  // Both computed defensively here (game may still be undefined on this
  // render) so the two watchdog hooks below - which also can't be
  // called conditionally - have real values rather than needing their
  // own duplicate "is game even loaded yet" checks.
  const isMyTurnEarly = !!game && game.turnOrder[game.currentTurnIndex] === playerId;
  const isHost = playerId === room.hostId;
  const afkPrompt = useAfkSelfCheck(roomCode, game, playerId, isMyTurnEarly);
  useHostAfkWatchdog(roomCode, room, game, isHost);
  useYourTurnChime(isMyTurnEarly);
  const handleCardFlight = useCallback(
    (deck: CardDeck, from: DOMRect, to: DOMRect) => setCardFlight({ deck, from, to }),
    [],
  );
  useCardFlight(game, layoutActionsRef.current, handleCardFlight);

  // RoomView only ever renders GameBoard once room.game exists, but
  // TypeScript can't see that from here, so we still need this check to
  // satisfy it (and to bail out safely if it's ever wrong).
  if (!game) return null;

  if (game.endgame?.results) {
    return <EndgameResultsScreen room={room} game={game} roomCode={roomCode} playerId={playerId} onLeave={onLeave} />;
  }

  const currentTurnPlayerId = game.turnOrder[game.currentTurnIndex];
  const isMyTurn = currentTurnPlayerId === playerId;
  const pendingTile =
    game.pendingDecision?.type === 'purchase' || game.pendingDecision?.type === 'volgaOffer'
      ? getTile(game.pendingDecision.tileId)
      : null;
  // Shown to EVERY viewer, not just whoever's resolving it - a drawn
  // card used to only render for pendingDecision.forPlayerId, so
  // everyone else just saw nothing happen until the drawer clicked
  // Continue. Only the actual resolver gets the button (see the
  // isPendingCardMine check below); everyone else gets a read-only
  // "waiting on" view of the same card.
  const pendingCard = game.pendingDecision?.type === 'cardDrawn' ? findCard(game.pendingDecision.cardId) : null;
  const isPendingCardMine =
    game.pendingDecision?.type === 'cardDrawn' && game.pendingDecision.forPlayerId === playerId;
  const me = game.players[playerId];
  const myPendingPieceChoice = game.pendingPieceChoices.includes(playerId);
  const myPendingEndgameTarget = game.endgame?.pendingTargetChoices.includes(playerId) ?? false;
  const canAccuseOfTrotsky =
    isMyTurn && game.trotskyHidingSpot !== null && me?.position === game.trotskyHidingSpot;
  const accusableOthers = game.turnOrder.filter((id) => id !== playerId);
  const effectiveAccusedId = accusableOthers.includes(accusedId) ? accusedId : (accusableOthers[0] ?? '');

  const isDevPanelUnlocked =
    playerId === room.hostId &&
    room.players[playerId]?.name.trim().toLowerCase() === 'comrade stalin';

  async function handleRoll() {
    setIsRolling(true);
    setRollTrigger((n) => n + 1);
    try {
      await rollDiceAndSync(roomCode, game!);
    } finally {
      setIsRolling(false);
    }
  }

  return (
    <main className="game-board">
      {afkPrompt.visible && (
        <div className="afk-prompt-overlay">
          <div className="afk-prompt">
            <p>Still there? It's your turn.</p>
            <button onClick={afkPrompt.confirmStillHere}>Yes, I'm here</button>
            <p className="afk-prompt-countdown">
              Turn skips automatically in {afkPrompt.secondsLeft}s...
            </p>
          </div>
        </div>
      )}

      {cardFlight && (
        <FlyingCard
          deck={cardFlight.deck}
          from={cardFlight.from}
          to={cardFlight.to}
          onDone={() => setCardFlight(null)}
        />
      )}

      {me && <PieceInfoPanel pieceId={me.pieceId} />}

      {isMyTurn && <YourTurnBanner key={currentTurnPlayerId} />}

      <p className="turn-indicator">
        {isMyTurn ? 'Your turn' : `${room.players[currentTurnPlayerId]?.name}'s turn`}
      </p>

      <div className="board-layout" data-mobile-tab={mobileTab}>
        {/* Only shown below the mobile breakpoint (see GameBoard.css) -
            switches which of the two tab groups below is visible.
            layout-actions is in neither group, so whatever needs a
            response (Roll Dice, a card reveal, a vote) stays reachable
            no matter which tab is active. */}
        <div className="mobile-tabs">
          <button
            type="button"
            className={mobileTab === 'board' ? 'is-active' : ''}
            onClick={() => setMobileTab('board')}
          >
            Board
          </button>
          <button
            type="button"
            className={mobileTab === 'status' ? 'is-active' : ''}
            onClick={() => setMobileTab('status')}
          >
            Status
          </button>
        </div>

        <section className="layout-status">
          <div className="game-status">
            {game.lastRoll && (
              <p className="dice-result">
                {game.lastRoll[1] === 0
                  ? `Rolled ${game.lastRoll[0]} (one die)`
                  : `Rolled ${game.lastRoll[0]} + ${game.lastRoll[1]}${game.lastRollWasDoubles ? ' (doubles!)' : ''}`}
              </p>
            )}
            {game.trotskyHidingSpot !== null && (
              <p className="trotsky-banner">
                Stalin has marked {getTile(game.trotskyHidingSpot).name} - land there to accuse
                someone of being Trotsky. Guess right and they're exposed and Disappear; guess wrong
                and you go to jail instead.
              </p>
            )}
            {game.endgame && !game.endgame.results && (
              <p className="trotsky-banner">
                {game.endgame.pendingTargetChoices.length > 0
                  ? "The Piece Pool is empty - everyone's had their final turn. Waiting on Endgame targets."
                  : 'The Piece Pool is empty - everyone gets one more turn before the Endgame.'}
              </p>
            )}
          </div>

          <ul className="player-summary">
            {game.turnOrder.map((id) => {
              const player = game.players[id];
              return (
                <li key={id} className={id === currentTurnPlayerId ? 'is-current' : ''}>
                  <span className="player-name">
                    {room.players[id] && (
                      <span
                        className={`presence-dot ${isPlayerAway(room.players[id]) ? 'is-away' : ''}`}
                        title={isPlayerAway(room.players[id]) ? 'Away' : 'Online'}
                      />
                    )}
                    {room.players[id]?.name} ({pieceName(player.pieceId)})
                  </span>
                  <span className="player-roubles">
                    ₽<AnimatedNumber value={player.roubles} />
                    {/* West stash (secured or still waiting) is only shown to its
                        own owner - everyone else seeing exactly how much someone
                        has smuggled (and how much more is en route) defeats the
                        point of Smuggling being a secret, protected stash. */}
                    {id === playerId && (player.westRoubles > 0 || player.pendingWestRoubles > 0) && (
                      <>
                        {' (West: ₽'}
                        <AnimatedNumber value={player.westRoubles} />
                        {player.pendingWestRoubles > 0 && (
                          <>
                            {' + ₽'}
                            <AnimatedNumber value={player.pendingWestRoubles} />
                            {' waiting'}
                          </>
                        )}
                        {')'}
                      </>
                    )}
                  </span>
                  <span className="player-position">
                    {player.isSpectating ? 'Spectating' : getTile(player.position).name}
                    {player.inJail ? ' [JAIL]' : ''}
                    {game.pendingPieceChoices.includes(id) ? ' [choosing a new Piece]' : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="layout-actions" ref={layoutActionsRef}>
          {me?.isAfkSpectating && (
            <div className="purchase-prompt card-prompt afk-rejoin-banner">
              <p>You were benched for being away too long - you're just spectating for now.</p>
              <button onClick={() => rejoinFromAfkAndSync(roomCode, game, playerId)}>
                Rejoin the Game
              </button>
            </div>
          )}

          {myPendingPieceChoice && (
            <ActionModal>
              <PieceChoicePrompt playerId={playerId} roomCode={roomCode} game={game} />
            </ActionModal>
          )}

          {myPendingEndgameTarget && (
            <ActionModal>
              <EndgameTargetPrompt playerId={playerId} room={room} roomCode={roomCode} game={game} />
            </ActionModal>
          )}

          {isMyTurn && !myPendingPieceChoice && !game.pendingDecision && (
            <div className="actions">
              {/* Roll is only available before this turn's first roll, or
                  again after doubles ("if you get a double, you get to roll
                  again"). Once a non-doubles roll has happened, only End Turn
                  shows - otherwise a player could just keep re-rolling
                  forever instead of passing the turn. */}
              {(!game.lastRoll || game.lastRollWasDoubles) && (
                <button onClick={handleRoll} disabled={isRolling}>
                  {isRolling ? 'Rolling...' : 'Roll Dice'}
                </button>
              )}
              {game.lastRoll && !game.lastRollWasDoubles && (
                <button onClick={() => endTurnAndSync(roomCode, game)}>End Turn</button>
              )}
              {game.lastRollWasDoubles && <p className="hint">Doubles! Roll again.</p>}
            </div>
          )}

          {isMyTurn && pendingTile && game.pendingDecision?.type === 'purchase' && (
            <ActionModal>
              <div className="purchase-prompt">
                <p>
                  Buy {pendingTile.name}
                  {'price' in pendingTile && (
                    <>
                      {' for '}
                      {pendingTile.kind === 'railroad' && me?.pieceId === 'battleship' ? (
                        <>
                          <span className="board-popup-price-struck">₽{pendingTile.price}</span>{' '}
                          ₽{Math.floor(pendingTile.price / 2)}
                        </>
                      ) : (
                        `₽${pendingTile.price}`
                      )}
                    </>
                  )}
                  ?
                </p>
                <div className="purchase-prompt-actions">
                  <button onClick={() => buyPropertyAndSync(roomCode, game)}>Buy</button>
                  <button onClick={() => skipPurchaseAndSync(roomCode, game)}>Skip</button>
                </div>
              </div>
            </ActionModal>
          )}

          {isMyTurn && pendingTile && game.pendingDecision?.type === 'volgaOffer' && (
            <ActionModal>
              <div className="purchase-prompt">
                <p>
                  Give away everything you own to claim {pendingTile.name}? Your properties will be
                  split evenly among the other players.
                </p>
                <div className="purchase-prompt-actions">
                  <button onClick={() => acceptVolgaOfferAndSync(roomCode, game)}>Give It Up</button>
                  <button onClick={() => declineVolgaOfferAndSync(roomCode, game)}>Decline</button>
                </div>
              </div>
            </ActionModal>
          )}

          {pendingCard && game.pendingDecision?.type === 'cardDrawn' && (
            <ActionModal>
              <div key={game.pendingDecision.cardId} className="purchase-prompt card-prompt card-reveal">
                <CardRevealSound />
                <p className="card-title">{pendingCard.title}</p>
                <p>{pendingCard.text}</p>
                {isPendingCardMine ? (
                  <button onClick={() => acknowledgeCardAndSync(roomCode, game)}>Continue</button>
                ) : (
                  <p className="hint">
                    Waiting for {room.players[game.pendingDecision.forPlayerId]?.name}...
                  </p>
                )}
              </div>
            </ActionModal>
          )}

          {game.pendingDecision?.type === 'cardChoice' && (
            <ActionModal>
              <CardChoicePrompt
                deck={game.pendingDecision.deck}
                roomCode={roomCode}
                game={game}
                isMine={isMyTurn}
                chooserName={room.players[currentTurnPlayerId]?.name}
              />
            </ActionModal>
          )}

          {isMyTurn && game.pendingDecision?.type === 'smuggleOffer' && (
            <ActionModal>
              <SmuggleOfferPrompt
                maxAmount={game.pendingDecision.maxAmount}
                roomCode={roomCode}
                game={game}
              />
            </ActionModal>
          )}

          {isMyTurn && game.pendingDecision?.type === 'catRedirect' && (
            <ActionModal>
              <CatRedirectPrompt
                cardId={game.pendingDecision.cardId}
                room={room}
                roomCode={roomCode}
                playerId={playerId}
                game={game}
              />
            </ActionModal>
          )}

          {game.pendingDecision?.type === 'cardTarget' &&
            game.pendingDecision.forPlayerId === playerId && (
              <ActionModal>
                <CardTargetPrompt
                  cardId={game.pendingDecision.cardId}
                  room={room}
                  roomCode={roomCode}
                  playerId={playerId}
                  game={game}
                />
              </ActionModal>
            )}

          {game.pendingDecision?.type === 'nkvdQuiz' &&
            game.pendingDecision.forPlayerId === playerId && (
              <ActionModal>
                <NkvdQuizPrompt
                  questionIndex={game.pendingDecision.questionIndex}
                  roomCode={roomCode}
                  game={game}
                />
              </ActionModal>
            )}

          <RubberDuckEncounterBanner room={room} roomCode={roomCode} playerId={playerId} game={game} />

          {canAccuseOfTrotsky && (
            <div className="purchase-prompt card-prompt">
              <p>Accuse someone of being Trotsky:</p>
              <select value={effectiveAccusedId} onChange={(event) => setAccusedId(event.target.value)}>
                {accusableOthers.map((id) => (
                  <option key={id} value={id}>
                    {room.players[id]?.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => accuseOfTrotskyAndSync(roomCode, game, effectiveAccusedId)}
                disabled={!effectiveAccusedId}
              >
                Accuse
              </button>
            </div>
          )}

          <ShowTrialVoteBanner room={room} roomCode={roomCode} playerId={playerId} game={game} />
        </section>

        <section className="layout-log">
          <ul className="event-log">
            {game.log
              .slice()
              .reverse()
              .map((entry, index) => (
                <li key={index}>{formatLogEntry(entry, room)}</li>
              ))}
          </ul>

          {/* Desktop swaps places with the dice roller below (feedback
              from an early playtest) - mobile keeps the banner here and
              the dice roller next to the board, since that one needs to
              stay visible on the "Board" tab while a roll plays out. */}
          {isDesktop ? (
            <DiceRoller game={room.game ?? game} rollTrigger={rollTrigger} />
          ) : (
            <img
              className="propaganda-banner"
              src={`${import.meta.env.BASE_URL}images/communist-banner.jpg`}
              alt="Capitalism has no future. Fight for communism."
            />
          )}

          {isDevPanelUnlocked && <DevPanel room={room} roomCode={roomCode} game={game} />}
        </section>

        <div className="board-column layout-board">
          <Board room={room} roomCode={roomCode} playerId={playerId} game={game} />
        </div>

        <div className="dice-column layout-dice">
          {/* Live, not staged - the dice should start tumbling the
              instant a roll happens, not wait for the token's walk to
              finish revealing everything else. */}
          {isDesktop ? (
            <img
              className="propaganda-banner"
              src={`${import.meta.env.BASE_URL}images/communist-banner.jpg`}
              alt="Capitalism has no future. Fight for communism."
            />
          ) : (
            <DiceRoller game={room.game ?? game} rollTrigger={rollTrigger} />
          )}
        </div>
      </div>

      <Hand room={room} roomCode={roomCode} playerId={playerId} game={game} />
    </main>
  );
}

// A silent helper that just plays the card-draw sound once, the moment
// it mounts - since the card-reveal banner it lives inside is keyed by
// cardId (see above), React mounts a fresh one of these every time a
// new card is actually drawn, which is exactly the trigger we want.
function CardRevealSound() {
  useEffect(() => {
    playCardDraw();
  }, []);
  return null;
}

export default GameBoard;
