import RuleBookButton from './RuleBookButton';
import SoundToggle from './SoundToggle';
import './AppHeader.css';

interface AppHeaderProps {
  /** The Rule Book only makes sense once you're in a Room (lobby or in-game) - the landing screen renders this without it. */
  showRuleBook?: boolean;
}

// The fixed top-left corner cluster (mobile: a full-width header bar
// instead - see AppHeader.css) shared by every screen. Owns the
// positioning; SoundToggle/RuleBookButton just lay out their own
// content within it.
function AppHeader({ showRuleBook = false }: AppHeaderProps) {
  return (
    <div className="app-header">
      <SoundToggle />
      {showRuleBook && <RuleBookButton />}
    </div>
  );
}

export default AppHeader;
