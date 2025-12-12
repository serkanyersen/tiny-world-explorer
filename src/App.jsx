import { useState, useRef, useEffect, useMemo } from 'react';
import { useCamera } from './hooks/useCamera';
import { ControlPanel } from './components/ControlPanel';

import { Gallery } from './components/Gallery';
import { Minimap } from './components/Minimap';
import './index.css';

const DEFAULT_FILTERS = {
  zoom: 1,
  brightness: 100,
  contrast: 100,
  saturate: 100,
  sepia: 0,

  invert: 0,
  edgeDetection: false,
  falseColor: false,
  emboss: 0,
  sharpen: 0,
  grid: false,
  crosshair: false
};

function App() {
  const {
    stream,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    error,
    takePhoto,
    startRecording,
    stopRecording,
    isRecording,
    compatibilityMode,
    setCompatibilityMode,
    debugInfo
  } = useCamera();

  const [mediaItems, setMediaItems] = useState([]);
  const [showGallery, setShowGallery] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('3/2');
  const [isFlashing, setIsFlashing] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [frozenFrame, setFrozenFrame] = useState(null);
  const [showControls, setShowControls] = useState(true);

  // Pan State (Normalized -0.5 to 0.5)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Prevent saving settings while we are loading them
  const isLoadedRef = useRef(false);

  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const videoRef = useRef(null);

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  // Load Settings
  useEffect(() => {
    if (!selectedDeviceId) return;

    const saved = localStorage.getItem(`camera_settings_${selectedDeviceId}`);
    isLoadedRef.current = false; // Block saving while loading

    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            setFilters(parsed.filters || DEFAULT_FILTERS);
            setAspectRatio(parsed.aspectRatio || '3/2');
            // Only update compatibility mode if it's different to avoid unnecessary stream restarts
            if (parsed.compatibilityMode !== undefined) {
               setCompatibilityMode(parsed.compatibilityMode);
            }
        } catch (e) {
            console.error("Failed to parse settings", e);
            setFilters(DEFAULT_FILTERS);
            setAspectRatio('3/2');
        }
    } else {
        // Defaults for new device
        setFilters(DEFAULT_FILTERS);
        setAspectRatio('3/2');
    }

    // Allow saving after a brief tick to ensure state has settled
    setTimeout(() => { isLoadedRef.current = true; }, 100);

  }, [selectedDeviceId, setCompatibilityMode]);

  // Save Settings
  useEffect(() => {
    if (!selectedDeviceId || !isLoadedRef.current) return;

    const settings = {
        filters,
        aspectRatio,
        compatibilityMode
    };
    localStorage.setItem(`camera_settings_${selectedDeviceId}`, JSON.stringify(settings));
  }, [filters, aspectRatio, compatibilityMode, selectedDeviceId]);

  const videoStyle = useMemo(() => {
    // Safety: Force pan to 0 if zoom is 1
    const effectivePan = filters.zoom === 1 ? { x: 0, y: 0 } : pan;

    return {
        maxWidth: '100%',
        maxHeight: '100%',
        aspectRatio: aspectRatio === 'native' ? 'auto' : aspectRatio,
        objectFit: 'fill', // Force stretch to fix distortion
        transform: `translate(${effectivePan.x * 100}%, ${effectivePan.y * 100}%) scale(${filters.zoom})`,
        filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) sepia(${filters.sepia}%) invert(${filters.invert}%) ${filters.edgeDetection ? 'url(#edge-detection)' : ''} ${filters.falseColor ? 'url(#false-color)' : ''} ${filters.emboss > 0 ? 'url(#emboss)' : ''} ${filters.sharpen > 0 ? 'url(#sharpen)' : ''}`,
        transition: isDraggingRef.current ? 'none' : 'transform 0.1s ease-out, filter 0.1s ease-out'
    };
  }, [filters, aspectRatio, pan]);

  // Reset pan when zoom is 1
  useEffect(() => {
    if (filters.zoom === 1) {
        setPan({ x: 0, y: 0 });
    }
  }, [filters.zoom]);

  // Pan Logic Handlers
  const handlePanChange = (newX, newY) => {
     // Constrain Pan
     if (filters.zoom <= 1) return;
     const maxPan = (filters.zoom - 1) / 2;

     // Clamp
     const clampedX = Math.max(-maxPan, Math.min(maxPan, newX));
     const clampedY = Math.max(-maxPan, Math.min(maxPan, newY));

     setPan({ x: clampedX, y: clampedY });
  };

  const handleMouseDown = (e) => {
    if (filters.zoom > 1 && !splitMode) {
        isDraggingRef.current = true;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        e.preventDefault(); // Prevent text selection
    }
  };

  const handleMouseMove = (e) => {
    if (isDraggingRef.current && videoRef.current) {
        const deltaX = e.clientX - lastMousePosRef.current.x;
        const deltaY = e.clientY - lastMousePosRef.current.y;

        lastMousePosRef.current = { x: e.clientX, y: e.clientY };

        // Convert pixel delta to percentage
        const rect = videoRef.current.getBoundingClientRect();
        // NOTE: rect.width is the SCALED width.
        // We want delta relative to the ORIGINAL container width (because translate % is based on element size)
        // Wait, element size is constant (100% of container). Scale is applied visuals.
        // videoRef.current.offsetWidth is unscaled width? Yes.

        const w = videoRef.current.offsetWidth;
        const h = videoRef.current.offsetHeight;

        // Update Pan
        // If I drag mouse Right (positive delta), Image should move Right (positive translate).
        // Correct.

        const panDeltaX = deltaX / w;
        const panDeltaY = deltaY / h;

        // Use functional state to avoid stale closure during rapid updates if we used that,
        // but here we have access to 'pan' via closure?
        // Better to check current constraints.

        // Actually, we must use the clamped logic.
        // Let's call helper.
        // We need 'current pan' + delta.
        // Since event handler closes over 'pan', it might change.
        // Let's use setPan callback.

        setPan(prev => {
             const maxPan = (filters.zoom - 1) / 2;
             const nx = prev.x + panDeltaX;
             const ny = prev.y + panDeltaY;

             return {
                x: Math.max(-maxPan, Math.min(maxPan, nx)),
                y: Math.max(-maxPan, Math.min(maxPan, ny))
             };
        });
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Attach global mouse up to catch dragging outside
  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Dynamic Kernel Generation
  const sharpenMatrix = useMemo(() => {
    // Identity: 0 0 0 0 1 0 0 0 0
    // Target: 0 -1 0 -1 5 -1 0 -1 0
    // Diff:   0 -1 0 -1 4 -1 0 -1 0
    // Factor s: 0 to 3
    const s = (filters.sharpen / 100) * 15;
    return `0 ${-s} 0 ${-s} ${1 + 4 * s} ${-s} 0 ${-s} 0`;
  }, [filters.sharpen]);

  const embossMatrix = useMemo(() => {
    // Identity: 0 0 0 0 1 0 0 0 0
    // Target: -2 -1 0 -1 1 1 0 1 2
    // Diff:   -2 -1 0 -1 0 1 0 1 2
    // Factor s: 0 to 3
    const s = (filters.emboss / 100) * 3;
    return `${-2 * s} ${-1 * s} 0 ${-1 * s} 1 ${1 * s} 0 ${1 * s} ${2 * s}`;
  }, [filters.emboss]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  /* Media Capture handlers */
  const handleTakePhoto = async () => {
    if (videoRef.current) {
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 150);

        const photoUrl = takePhoto(videoRef.current);
        if (photoUrl) {
            setMediaItems(prev => [{ type: 'image', url: photoUrl, date: new Date() }, ...prev]);
        }
    }
  };

  const handleToggleRecord = async () => {
    if (isRecording) {
        const videoUrl = await stopRecording();
        if (videoUrl) {
            setMediaItems(prev => [{ type: 'video', url: videoUrl, date: new Date() }, ...prev]);
        }
    } else {
        startRecording();
    }
  };

  const handleToggleSplit = () => {
    if (splitMode) {
        setSplitMode(false);
        setFrozenFrame(null);
    } else {
        if (videoRef.current) {
            const frame = takePhoto(videoRef.current);
            setFrozenFrame(frame);
            setSplitMode(true);
        }
    }
  };

  return (
    <div className="app-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* SVG Filters Definition */}
      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
        <defs>
          <filter id="edge-detection">
            <feConvolveMatrix
              order="3"
              kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1"
              preserveAlpha="true"
            />
            <feColorMatrix type="saturate" values="0"/>
          </filter>

          <filter id="false-color">
             <feColorMatrix type="luminanceToAlpha"/>
             <feComponentTransfer>
                <feFuncR type="table" tableValues="0 0 1 1"/>
                <feFuncG type="table" tableValues="0 1 1 0"/>
                <feFuncB type="table" tableValues="1 0 0 0"/>
             </feComponentTransfer>
          </filter>

          <filter id="emboss">
             <feConvolveMatrix
                order="3"
                kernelMatrix={embossMatrix}
                preserveAlpha="true"
             />
          </filter>

          <filter id="sharpen">
             <feConvolveMatrix
                order="3"
                kernelMatrix={sharpenMatrix}
                preserveAlpha="true"
             />
          </filter>
        </defs>
      </svg>

      {/* Header / Top Bar */}
      <header className="glass-panel" style={{
        zIndex: 20,
        margin: '16px',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/src/assets/logo.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
          <h1 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--color-primary)' }}>Tiny World Explorer</h1>
        </div>

        <div style={{ display: 'flex', gap: '16px'}}>
            <button
                className="btn-base btn-pill"
                onClick={() => setShowGallery(true)}
                style={{ gap: '8px' }}
            >
                <span>Gallery</span>
                <span style={{
                    background: 'var(--color-primary)',
                    color: 'black',
                    borderRadius: '10px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontWeight: 'bold'
                }}>{mediaItems.length}</span>
            </button>

            <button
                className="btn-base btn-pill"
                onClick={() => setShowControls(prev => !prev)}
                style={{
                    background: showControls ? 'var(--color-surface-transparent)' : 'transparent',
                    borderColor: showControls ? 'var(--color-primary)' : 'var(--color-border)',
                }}
                title={showControls ? "Hide Controls" : "Show Controls"}
            >
                {showControls ? "Hide Controls" : "Show Controls"}
            </button>

            <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="glass-panel"
                style={{
                    padding: '8px 12px',
                    color: 'white',
                    border: '1px solid var(--color-border)',
                    outline: 'none',
                    fontSize: '0.9rem'
                }}
                >
                {devices.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                    </option>
                ))}
            </select>

            <button
                className="btn-base btn-pill"
                onClick={() => setCompatibilityMode(prev => !prev)}
                title={compatibilityMode ? "Switch to High Res" : "Switch to Compatibility Mode (Low Res)"}
                style={{
                    background: compatibilityMode ? 'var(--color-primary)' : 'transparent',
                    color: compatibilityMode ? 'black' : 'white',
                    borderColor: 'var(--color-border)'
                }}
            >
                {compatibilityMode ? "LOW RES" : "HD"}
            </button>

            <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                style={{
                    background: 'none',
                    border: '1px solid var(--color-border)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    outline: 'none',
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                }}
            >
                <option value="3/2" style={{color: 'black'}}>3:2 (Default)</option>
                <option value="4/3" style={{color: 'black'}}>4:3</option>
                <option value="16/9" style={{color: 'black'}}>16:9</option>
                <option value="1/1" style={{color: 'black'}}>1:1</option>
                <option value="native" style={{color: 'black'}}>Native</option>
            </select>
        </div>
      </header>

      {showGallery && <Gallery mediaItems={mediaItems} onClose={() => setShowGallery(false)} />}

      {/* Main Viewport */}
      <main style={{
        flex: 1,
        position: 'relative',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        width: '100%'
      }}>
        {/* Debug Overlay */}
        {debugInfo && (
            <div style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                background: 'rgba(0,0,0,0.7)',
                color: '#0f0',
                padding: '8px',
                fontSize: '10px',
                fontFamily: 'monospace',
                pointerEvents: 'none',
                zIndex: 30,
                borderRadius: '4px'
            }}>
                <p>Res: {debugInfo.width}x{debugInfo.height} @ {Math.round(debugInfo.frameRate)}fps</p>
                <p>State: {debugInfo.readyState} | Muted: {debugInfo.muted ? 'Yes' : 'No'}</p>
                <p>Enabled: {debugInfo.enabled ? 'Yes' : 'No'}</p>
            </div>
        )}

        {/* Flash Overlay */}
        <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'white',
            opacity: isFlashing ? 1 : 0,
            pointerEvents: 'none',
            transition: 'opacity 0.1s ease-out',
            zIndex: 40
        }} />

        {error ? (
          <div style={{ color: 'var(--color-danger)', textAlign: 'center' }}>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <div style={{
                display: 'flex',
                width: '100%',
                height: '100%',
                gap: splitMode ? '4px' : '0'
            }}>
                {/* Split Screen: Frozen Left Side */}
                {splitMode && frozenFrame && (
                    <div style={{
                        flex: 1,
                        position: 'relative',
                        borderRight: '2px solid var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#000'
                    }}>
                        <img
                            src={frozenFrame}
                            alt="Reference"
                            style={{
                                ...videoStyle // Reuse exact same style logic (aspect-ratio, fit, zoom, filters)
                            }}
                        />
                        <div style={{
                            position: 'absolute',
                            top: '10px',
                            left: '10px',
                            background: 'rgba(0,0,0,0.6)',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            pointerEvents: 'none'
                        }}>Reference</div>
                    </div>
                )}

                {/* Live Video Side */}
                <div
                    style={{
                        flex: 1,
                        position: 'relative',
                        cursor: filters.zoom > 1 && !splitMode ? 'grab' : 'default',
                        overflow: 'hidden', // Ensure zoomed content doesn't spill
                        touchAction: 'none', // Prevent scroll on touch
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#000'
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                >
                    <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={videoStyle}
                    />
                    {splitMode && (
                        <div style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            background: 'var(--color-primary)',
                            color: 'black',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                        }}>Live</div>
                    )}
                </div>
            </div>

            {/* Overlays Container - Absolute over video */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                pointerEvents: 'none',
                overflow: 'hidden'
            }}>
                {filters.grid && (
                    <div style={{
                        width: '100%',
                        height: '100%',
                        backgroundImage: `
                            linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)
                        `,
                        backgroundSize: '10% 10%'
                    }} />
                )}

                {filters.crosshair && (
                    <>
                        <div style={{
                            position: 'absolute',
                            top: '50%', left: '0', right: '0',
                            height: '1px',
                            background: 'rgba(255, 0, 0, 0.5)'
                        }} />
                        <div style={{
                            position: 'absolute',
                            left: '50%', top: '0', bottom: '0',
                            width: '1px',
                            background: 'rgba(255, 0, 0, 0.5)'
                        }} />
                    </>
                )}
            </div>

            {showControls && (
                <ControlPanel filters={filters} setFilters={setFilters} onReset={resetFilters} />
            )}

            <Minimap
                stream={stream}
                zoom={filters.zoom}
                pan={pan}
                onPanChange={handlePanChange}
            />
          </>
        )}
      </main>

      {/* Footer / Controls */}
      {/* Footer / Controls */}
      <footer className="glass-panel" style={{
        zIndex: 20,
        margin: '24px',
        alignSelf: 'center',
        padding: '12px 24px',
        display: 'flex',
        gap: '24px',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <button
            className={`btn-record ${isRecording ? 'recording' : ''}`}
            onClick={handleToggleRecord}
            title={isRecording ? "Stop Recording" : "Start Recording"}
        >
            <div className="btn-record-inner" />
        </button>

        <button
            className="btn-base btn-pill"
            onClick={handleToggleSplit}
            style={{
                borderColor: splitMode ? 'var(--color-primary)' : 'var(--color-border)',
                color: splitMode ? 'var(--color-primary)' : 'white'
            }}
        >
            {splitMode ? "EXIT COMPARE" : "COMPARE"}
        </button>

        <button
            className="btn-primary"
            onClick={handleTakePhoto}
        >
          SNAP
        </button>
      </footer>
    </div>
  );
}

export default App;
