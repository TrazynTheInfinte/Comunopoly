import { getTile } from '../data/board';
import './PropertiesPanel.css';

interface PropertiesPanelProps {
  ownedTileIds: number[];
}

// Shows the viewing player's own holdings, regardless of whose turn it
// is - mainly so you can double-check what you actually own. This is
// also where a future "buy a house/hotel" action will live, once the
// house/hotel rent-tier system exists (a separate, bigger increment -
// right now rent is still a flat placeholder rate).
function PropertiesPanel({ ownedTileIds }: PropertiesPanelProps) {
  const tiles = ownedTileIds.map(getTile);

  return (
    <section className="properties-panel">
      <p className="properties-panel-title">Your Properties</p>
      {tiles.length === 0 && <p className="hint">You don't own anything yet.</p>}
      <ul className="properties-list">
        {tiles.map((tile) => (
          <li
            key={tile.id}
            className={tile.kind === 'property' ? `color-${tile.colorGroup}` : ''}
          >
            <span>{tile.name}</span>
            {(tile.kind === 'property' || tile.kind === 'railroad') && (
              <span className="tile-price">₽{tile.price}</span>
            )}
            {tile.kind === 'utility' && <span className="tile-tag">Utility</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default PropertiesPanel;
