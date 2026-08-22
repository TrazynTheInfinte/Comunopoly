import type { CSSProperties } from 'react';
import { BOARD } from '../data/board';
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
import './Board.css';

interface BoardProps {
  room: Room;
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

function DeckIcon({ tile }: { tile: BoardTile }) {
  if (tile.kind !== 'card') return null;
  return tile.deck === 'communistTest' ? <HammerIcon className="tile-icon" /> : <ChanceIcon className="tile-icon" />;
}

/**
 * The actual 40-tile board, laid out as a physical Monopoly-style square
 * (not the plain text readout that's still shown below it for actions/
 * decisions). Deliberately CSS/SVG only - no image assets. Piece-
 * specific tokens, tile-landing animation, and sound are all separate,
 * later passes; this one is just the board itself: layout, color
 * groups, tile icons, ownership/houses/mortgages, and plain colored
 * position markers.
 */
function Board({ room, game }: BoardProps) {
  const tokenColorFor = (playerId: string) => {
    const index = game.turnOrder.indexOf(playerId);
    return TOKEN_COLORS[index % TOKEN_COLORS.length];
  };

  const ownerOf = (tileId: number): string | null => {
    for (const id of game.turnOrder) {
      if (game.players[id].ownedTileIds.includes(tileId)) return id;
    }
    return null;
  };

  return (
    <div className="board">
      <div className="board-center">
        <div className="board-center-banner">COMMUNOPOLY</div>
        <div className="board-center-deck board-center-deck-communist">COMMUNIST TEST</div>
        <div className="board-center-deck board-center-deck-nochance">NO CHANCE</div>
      </div>

      {BOARD.map((tile) => {
        const { row, col } = gridPositionOf(tile.id);
        const side = sideOf(tile.id);
        const owner = tile.kind === 'property' || tile.kind === 'railroad' ? ownerOf(tile.id) : null;
        const houses = game.propertyHouses[tile.id] ?? 0;
        const mortgaged = game.mortgagedTileIds.includes(tile.id);
        const occupants = game.turnOrder.filter((id) => game.players[id].position === tile.id);

        return (
          <div
            key={tile.id}
            className={`board-tile board-tile-${tile.kind} board-tile-${side}`}
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
              <div className="tile-occupants">
                {occupants.map((id) => (
                  <span
                    key={id}
                    className="tile-token"
                    style={{ background: tokenColorFor(id) }}
                    title={room.players[id]?.name}
                  >
                    {room.players[id]?.name?.[0]?.toUpperCase() ?? '?'}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default Board;
