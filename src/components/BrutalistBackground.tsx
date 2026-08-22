import './BrutalistBackground.css';

// Purely decorative - a constructivist-poster backdrop (concrete grain,
// bold diagonal bars, a star, a ring) sitting fixed behind every screen.
// Rendered once at the App root so it never remounts/flickers between
// the landing screen, the lobby, and an in-progress game.
function BrutalistBackground() {
  return (
    <div className="brutalist-bg" aria-hidden="true">
      <div className="brutalist-bg-texture" />
      <div className="brutalist-bg-bar brutalist-bg-bar--tl" />
      <div className="brutalist-bg-bar brutalist-bg-bar--br" />
      <div className="brutalist-bg-star" />
      <div className="brutalist-bg-ring" />
    </div>
  );
}

export default BrutalistBackground;
