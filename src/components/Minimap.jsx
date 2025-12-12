import React, { useRef, useEffect } from 'react';

export const Minimap = ({ stream, zoom, pan, onPanChange }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Handle clicking/dragging on the minimap
  const handleInteraction = (e) => {
    if (!containerRef.current || zoom <= 1) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width; // 0 to 1
    const y = (e.clientY - rect.top) / rect.height; // 0 to 1

    // Convert Click Pos (0-1) to Pan (-0.5 to 0.5 range logic)
    // We want the CLICKED point to be the CENTER of the viewport

    // Viewport Width Ratio = 1 / zoom
    // Center is 0.5.
    // If we click 0.1 (left side), we want box center to be at 0.1.
    // Box Left = 0.1 - (W/2).

    // Reverse Map:
    // Box Left % = 50% - (pan.x * 100%) - (BoxWidth / 2)
    // Box Center % = Box Left % + BoxWidth / 2
    // Box Center % = 50% - (pan.x * 100%)

    // So: ClickX (as %) = 0.5 - pan.x / zoom
    // pan.x / zoom = 0.5 - ClickX
    // pan.x = (0.5 - ClickX) * zoom

    const newPanX = (0.5 - x) * zoom;
    const newPanY = (0.5 - y) * zoom;

    onPanChange(newPanX, newPanY);
  };

  // Mouse Drag Logic
  const handleMouseMove = (e) => {
    if (e.buttons === 1) { // Left click held
        handleInteraction(e);
    }
  };

  if (zoom <= 1) return null;

  // Calculate Box Position
  // Viewport size in minimap coordinates (normalized 0-1)
  const vw = 1 / zoom;
  const vh = 1 / zoom;

  // Center Position
  // pan.x is positive when image is shifted right (viewing left part)
  // so viewer is at left (low x).
  // box center x = 0.5 - pan.x / zoom
  const cx = 0.5 - (pan.x / zoom);
  const cy = 0.5 - (pan.y / zoom);

  // Box Top-Left
  const left = (cx - vw / 2) * 100;
  const top = (cy - vh / 2) * 100;

  return (
    <div
        className="glass-panel"
        ref={containerRef}
        onMouseDown={handleInteraction}
        onMouseMove={handleMouseMove}
        style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            width: '160px',
            aspectRatio: '3/2', // Assuming default aspect ratio, but could be dynamic
            zIndex: 40,
            overflow: 'hidden',
            cursor: 'crosshair',
            padding: 0,
            pointerEvents: 'auto',
            border: '2px solid rgba(255,255,255,0.2)'
        }}
    >
      {/* Background Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.8,
            filter: 'brightness(0.7)'
        }}
      />

      {/* Viewport Box */}
      <div style={{
          position: 'absolute',
          left: `${left}%`,
          top: `${top}%`,
          width: `${vw * 100}%`,
          height: `${vh * 100}%`,
          border: '2px solid var(--color-primary)',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)', // Dim outside area
          pointerEvents: 'none' // Let clicks pass to container
      }}/>
    </div>
  );
};
