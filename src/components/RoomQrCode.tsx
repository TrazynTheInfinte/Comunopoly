import { useMemo } from 'react';
import qrcode from 'qrcode-generator';
import './RoomQrCode.css';

interface RoomQrCodeProps {
  roomCode: string;
}

/**
 * A QR code encoding a link straight back into this room (this
 * origin/base path plus ?room=CODE - see App.tsx's mount effect, which
 * reads that param and drops the scanner straight into name-entry with
 * the code already filled in) - lets a mobile player join by scanning
 * instead of typing the 4-letter code by hand.
 *
 * Generated entirely locally (qrcode-generator has no runtime
 * dependencies of its own, and needs no network access) - rendered as
 * plain SVG rects from the library's own module matrix rather than via
 * its createSvgTag/dangerouslySetInnerHTML, so it stays ordinary JSX
 * and picks up the theme's colors through CSS classes instead of
 * fill attributes baked into a generated string.
 */
function RoomQrCode({ roomCode }: RoomQrCodeProps) {
  const modules = useMemo(() => {
    const joinUrl = `${window.location.origin}${import.meta.env.BASE_URL}?room=${roomCode}`;
    const qr = qrcode(0, 'M');
    qr.addData(joinUrl);
    qr.make();
    const count = qr.getModuleCount();
    return Array.from({ length: count }, (_, row) =>
      Array.from({ length: count }, (_, col) => qr.isDark(row, col)),
    );
  }, [roomCode]);

  const size = modules.length;

  return (
    <div className="room-qr">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="room-qr-svg"
        role="img"
        aria-label="QR code that joins this room"
      >
        <rect className="room-qr-bg" width={size} height={size} />
        {modules.map((row, rowIndex) =>
          row.map(
            (isDark, colIndex) =>
              isDark && (
                <rect
                  key={`${rowIndex}-${colIndex}`}
                  className="room-qr-dot"
                  x={colIndex}
                  y={rowIndex}
                  width={1}
                  height={1}
                />
              ),
          ),
        )}
      </svg>
      <p className="room-qr-caption">Scan to Join</p>
    </div>
  );
}

export default RoomQrCode;
