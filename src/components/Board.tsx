import { useState, type CSSProperties } from 'react';
import { BOARD } from '../data/board';
import { drawFromPileAndSync } from '../lib/gameSync';
import type { BoardTile, GameState } from '../types/game';
import type { Room } from '../types/room';
import {
  ArrowIcon,
  BarsIcon,
  BulbIcon,
  ChanceIcon,
  CuffsIcon,
  DropletIcon,
  EyeIcon,
  HammerIcon,
  ParkingIcon,
  StarIcon,
  TrainIcon,
} from './BoardTileIcon';
import { STARTING_PIECES } from '../data/pieces';
import PieceIcon from './PieceIcon';
import { useBoardStamps } from './useBoardStamps';
import { useRecentTileFlashes } from './useRecentTileFlashes';
import './Board.css';

interface BoardProps {
  room: Room;
  roomCode: string;
  playerId: string;
  game: GameState;
}

// Stable per-seat colors for the plain position tokens - not Piece art
// (that's a separate, later pass), just enough to tell players apart on
// the board itself.
const TOKEN_COLORS = [
  '#c9a227',
  '#3f7ca8',
  '#4c6b3a',
  '#b5677f',
  '#8a5a2b',
  '#5b3a73',
  '#2f8f7a',
  '#a3231f',
  '#7a7a3a',
  '#c96a24',
  '#3a5a7a',
  '#6b3a5b',
];

type Side = 'bottom' | 'left' | 'top' | 'right' | 'corner';

function sideOf(id: number): Side {
  if (id === 0 || id === 10 || id === 20 || id === 30) return 'corner';
  if (id >= 1 && id <= 9) return 'bottom';
  if (id >= 11 && id <= 19) return 'left';
  if (id >= 21 && id <= 29) return 'top';
  return 'right';
}

/** Maps a tile ID to its 1-based row/column in the 11x11 board grid - see the comment above BOARD in data/board.ts for why this specific mapping (bottom row right-to-left from STOY, then counterclockwise... actually clockwise - up the left, across the top, down the right) is correct. */
function gridPositionOf(id: number): { row: number; col: number } {
  if (id === 0) return { row: 11, col: 11 };
  if (id >= 1 && id <= 9) return { row: 11, col: 11 - id };
  if (id === 10) return { row: 11, col: 1 };
  if (id >= 11 && id <= 19) return { row: 11 - (id - 10), col: 1 };
  if (id === 20) return { row: 1, col: 1 };
  if (id >= 21 && id <= 29) return { row: 1, col: id - 19 };
  if (id === 30) return { row: 1, col: 11 };
  return { row: id - 29, col: 11 };
}

/** Shrinks tokens when more than one player shares a tile (most obviously everyone starting on STOY), so they still fit within that one square instead of overflowing it - see the --occupant-scale usage on .tile-token/.tile-token-icon in Board.css. */
function occupantScaleFor(occupantCount: number): number {
  if (occupantCount <= 1) return 1;
  if (occupantCount === 2) return 0.72;
  if (occupantCount === 3) return 0.58;
  return 0.48;
}

function pieceName(pieceId: string): string {
  return STARTING_PIECES.find((piece) => piece.id === pieceId)?.name ?? pieceId;
}

function DeckIcon({ tile }: { tile: BoardTile }) {
  if (tile.kind !== 'card') return null;
  return tile.deck === 'communistTest' ? <HammerIcon className="tile-icon" /> : <ChanceIcon className="tile-icon" />;
}

/** A rubber-stamp-style flourish over a jailed/Disappeared player's tile - see useBoardStamps for how the moment is detected. */
function PosterStamp({ kind, style }: { kind: 'jail' | 'disappear'; style: CSSProperties }) {
  return (
    <div className={`board-stamp board-stamp-${kind}`} style={style}>
      {kind === 'jail' ? 'To the Gulag' : 'Disappeared'}
    </div>
  );
}

/**
 * The actual 40-tile board, laid out as a physical Monopoly-style square
 * (not the plain text readout that's still shown below it for actions/
 * decisions). Deliberately CSS/SVG only - no image assets. Sound is a
 * separate, later pass; this one covers the board itself (layout, color
 * groups, tile icons, ownership/houses/mortgages, the two clickable
 * card piles), a distinct token icon per Piece, and tokens stepping
 * tile-by-tile across the board instead of snapping to a new position
 * (that stepping itself is driven by `game` already being the "staged"
 * state from useStagedGame, not anything this component does itself).
 */
function Board({ room, roomCode, playerId, game }: BoardProps) {
  // Which occupant token (if any) currently has its owner label open -
  // a tap/click toggles it, since a hover-only title tooltip doesn't
  // work on touch devices at all, and works well enough on desktop that
  // it's kept alongside this as a bonus.
  const [openTokenId, setOpenTokenId] = useState<string | null>(null);

  const tokenColorFor = (id: string) => {
    const index = game.turnOrder.indexOf(id);
    return TOKEN_COLORS[index % TOKEN_COLORS.length];
  };

  const ownerOf = (tileId: number): string | null => {
    for (const id of game.turnOrder) {
      if (game.players[id].ownedTileIds.includes(tileId)) return id;
    }
    return null;
  };

  const isMyTurn = game.turnOrder[game.currentTurnIndex] === playerId;
  // Visible to everyone watching (the glow is shared game state), but
  // only clickable for whoever's turn it actually is.
  const awaitingDeck = game.pendingDecision?.type === 'awaitingCardDraw' ? game.pendingDecision.deck : null;

  const stamps = useBoardStamps(game);
  const tileFlashes = useRecentTileFlashes(game.log);
  // Last one wins if two flashes somehow land on the same tile in the
  // same tick - fine, it's a brief cosmetic flourish either way.
  const flashKindByTileId = new Map(tileFlashes.map((flash) => [flash.tileId, flash.kind]));

  return (
    <div className="board" onClick={() => setOpenTokenId(null)}>
      <div className="board-center">
        <div className="board-center-banner">COMMUNOPOLY</div>
        <button
          type="button"
          className={`board-center-deck board-center-deck-communist ${awaitingDeck === 'communistTest' ? 'is-clickable' : ''}`}
          disabled={!isMyTurn || awaitingDeck !== 'communistTest'}
          onClick={() => drawFromPileAndSync(roomCode, game)}
        >
          <HammerIcon className="board-center-deck-icon" />
          COMMUNIST TEST
        </button>
        <button
          type="button"
          className={`board-center-deck board-center-deck-nochance ${awaitingDeck === 'noChance' ? 'is-clickable' : ''}`}
          disabled={!isMyTurn || awaitingDeck !== 'noChance'}
          onClick={() => drawFromPileAndSync(roomCode, game)}
        >
          <ChanceIcon className="board-center-deck-icon" />
          NO CHANCE
        </button>
      </div>

      {BOARD.map((tile) => {
        const { row, col } = gridPositionOf(tile.id);
        const side = sideOf(tile.id);
        const owner = tile.kind === 'property' || tile.kind === 'railroad' ? ownerOf(tile.id) : null;
        const houses = game.propertyHouses[tile.id] ?? 0;
        const mortgaged = game.mortgagedTileIds.includes(tile.id);
        const occupants = game.turnOrder.filter(
          (id) => !game.players[id].isSpectating && game.players[id].position === tile.id,
        );
        const flashKind = flashKindByTileId.get(tile.id);

        return (
          <div
            key={tile.id}
            className={`board-tile board-tile-${tile.kind} board-tile-${side} ${flashKind ? `tile-flash-${flashKind}` : ''}`}
            style={{
              gridRow: row,
              gridColumn: col,
              ...(tile.kind === 'property' ? { '--group-color': `var(--group-${tile.colorGroup})` } : {}),
            } as CSSProperties}
          >
            {tile.kind === 'property' && <div className="tile-colorbar" />}

            {owner && (
              <div className="tile-owner-mark" style={{ background: tokenColorFor(owner) }} title="Owned" />
            )}
            {mortgaged && <div className="tile-mortgaged">MORTGAGED</div>}

            <div className="tile-body">
              {tile.kind === 'card' && <DeckIcon tile={tile} />}
              {tile.kind === 'railroad' && <TrainIcon className="tile-icon" />}
              {tile.kind === 'utility' && tile.id === 12 && <BulbIcon className="tile-icon" />}
              {tile.kind === 'utility' && tile.id === 28 && <DropletIcon className="tile-icon" />}
              {tile.kind === 'special' && tile.id === 37 && <StarIcon className="tile-icon" />}
              {tile.kind === 'special' && tile.id === 39 && <EyeIcon className="tile-icon" />}
              {tile.kind === 'freeParking' && <ParkingIcon className="tile-icon" />}
              {tile.kind === 'goToJail' && <CuffsIcon className="tile-icon" />}
              {tile.kind === 'jail' && <BarsIcon className="tile-icon" />}
              {tile.kind === 'go' && <ArrowIcon className="tile-icon" />}

              <span className="tile-name">{tile.name}</span>
              {(tile.kind === 'property' || tile.kind === 'railroad') && (
                <span className="tile-price">₽{tile.price}</span>
              )}
              {tile.kind === 'utility' && <span className="tile-price">Can't Buy</span>}
              {tile.kind === 'special' && <span className="tile-price">Can't Buy</span>}
              {tile.kind === 'go' && <span className="tile-price">Collect ₽200</span>}
              {tile.kind === 'jail' && <span className="tile-price">In Jail / Visiting</span>}
            </div>

            {houses > 0 && (
              <div className="tile-houses">
                {houses === 5 ? (
                  <span className="tile-hotel">HOTEL</span>
                ) : (
                  Array.from({ length: houses }).map((_, i) => <span key={i} className="tile-house" />)
                )}
              </div>
            )}

            {occupants.length > 0 && (
              <div
                className="tile-occupants"
                style={{ '--occupant-scale': occupantScaleFor(occupants.length) } as CSSProperties}
              >
                {occupants.map((id) => (
                  <span
                    key={id}
                    className="tile-token"
                    style={{ background: tokenColorFor(id) }}
                    title={`${room.players[id]?.name} (${pieceName(game.players[id].pieceId)})`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenTokenId((current) => (current === id ? null : id));
                    }}
                  >
                    <PieceIcon pieceId={game.players[id].pieceId} className="tile-token-icon" />
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {stamps.map((stamp) => {
        const { row, col } = gridPositionOf(stamp.tileId);
        return (
          <PosterStamp
            key={stamp.key}
            kind={stamp.kind}
            style={{
              top: `${((row - 0.5) / 11) * 100}%`,
              left: `${((col - 0.5) / 11) * 100}%`,
            }}
          />
        );
      })}

      {openTokenId && game.players[openTokenId] && (
        (() => {
          const { row, col } = gridPositionOf(game.players[openTokenId].position);
          return (
            <div
              className="tile-token-owner"
              style={{
                top: `${((row - 0.5) / 11) * 100}%`,
                left: `${((col - 0.5) / 11) * 100}%`,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              {room.players[openTokenId]?.name}
              <br />
              {pieceName(game.players[openTokenId].pieceId)}
            </div>
          );
        })()
      )}
    </div>
  );
}

export default Board;
