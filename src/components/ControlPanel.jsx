import React from 'react';

const ControlRow = ({ label, value, min, max, onChange, unit = '' }) => (
  <div style={{ marginBottom: '16px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
      <span>{label}</span>
      <span>{Math.round(value)}{unit}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step="1"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{
        width: '100%',
        accentColor: 'var(--color-primary)',
        height: '4px',
        background: 'rgba(255,255,255,0.2)',
        borderRadius: '2px',
        appearance: 'none',
        outline: 'none'
      }}
    />
  </div>
);

export const ControlPanel = ({ filters, setFilters, onReset }) => {
  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="glass-panel control-panel-container" style={{
      position: 'absolute',
      right: '24px',
      top: '50%',
      transform: 'translateY(-50%)',
      width: '280px',
      padding: '24px',
      zIndex: 10,
      maxHeight: '80vh',
      overflowY: 'auto'
    }}>
      <h3 style={{
        marginBottom: '20px',
        fontSize: '18px',
        fontWeight: 600,
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        Adjustments
        <button
          onClick={onReset}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-primary)',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          RESET
        </button>
      </h3>

      <ControlRow
        label="Digital Zoom"
        value={filters.zoom}
        min={1}
        max={5}
        // Use smaller step for smoother zoom
        onChange={(v) => updateFilter('zoom', v)}
        unit="x"
      />

      <div style={{ height: '1px', background: 'var(--color-border)', margin: '16px 0' }} />

      <ControlRow
        label="Brightness"
        value={filters.brightness}
        min={50}
        max={200}
        onChange={(v) => updateFilter('brightness', v)}
        unit="%"
      />

      <ControlRow
        label="Contrast"
        value={filters.contrast}
        min={50}
        max={200}
        onChange={(v) => updateFilter('contrast', v)}
        unit="%"
      />

      <ControlRow
        label="Saturation"
        value={filters.saturate}
        min={0}
        max={200}
        onChange={(v) => updateFilter('saturate', v)}
        unit="%"
      />

      <ControlRow
        label="Sepia"
        value={filters.sepia}
        min={0}
        max={100}
        onChange={(v) => updateFilter('sepia', v)}
        unit="%"
      />

      <ControlRow
        label="Invert"
        value={filters.invert}
        min={0}
        max={100}
        onChange={(v) => updateFilter('invert', v)}
        unit="%"
      />

      <div style={{ height: '1px', background: 'var(--color-border)', margin: '16px 0' }} />

      <h4 style={{ marginBottom: '12px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>Overlays</h4>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '14px' }}>Grid</span>
        <input
          type="checkbox"
          checked={filters.grid}
          onChange={(e) => updateFilter('grid', e.target.checked)}
          style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '14px' }}>Crosshair</span>
        <input
          type="checkbox"
          checked={filters.crosshair}
          onChange={(e) => updateFilter('crosshair', e.target.checked)}
          style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
        />
      </div>
    </div>
  );
};
