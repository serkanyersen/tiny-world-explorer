import React, { useState } from 'react';

export const Gallery = ({ mediaItems, onClose }) => {
  const [selectedItem, setSelectedItem] = useState(null);

  return (
    <div className="glass-panel" style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 50,
      background: 'rgba(0,0,0,0.9)',
      padding: '40px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600 }}>Gallery</h2>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '99px',
            cursor: 'pointer'
          }}
        >
          Close
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '16px',
        overflowY: 'auto'
      }}>
        {mediaItems.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--color-text-secondary)', marginTop: '40px' }}>
            <p>No photos or videos yet.</p>
          </div>
        )}

        {mediaItems.map((item, index) => (
          <div
            key={index}
            style={{
              aspectRatio: '16/9',
              background: '#222',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              cursor: 'pointer',
              border: '2px solid transparent',
              transition: 'all 0.2s',
              position: 'relative'
            }}
            onClick={() => setSelectedItem(item)}
          >
            <a
                href={item.url}
                download={`tiny-world-${item.type}-${item.date.getTime()}.${item.type === 'video' ? 'webm' : 'png'}`}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  width: '32px',
                  height: '32px',
                  background: 'rgba(0, 0, 0, 0.5)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  fontSize: '16px',
                  zIndex: 10,
                  border: '1px solid rgba(255,255,255,0.3)'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                title="Download"
            >
              ⬇️
            </a>
            {item.type === 'image' ? (
              <img src={item.url} alt={`Capture ${index}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
                <video src={item.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            <div style={{
                position: 'absolute',
                bottom: '8px',
                right: '8px',
                background: 'rgba(0,0,0,0.6)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                textTransform: 'uppercase'
            }}>
                {item.type}
            </div>
          </div>
        ))}
      </div>

      {selectedItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'black',
          zIndex: 60,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '40px'
        }} onClick={() => setSelectedItem(null)}>
          {selectedItem.type === 'image' ? (
             <img src={selectedItem.url} style={{ maxHeight: '100%', maxWidth: '100%', borderRadius: '8px' }} />
          ) : (
             <video src={selectedItem.url} controls autoPlay style={{ maxHeight: '100%', maxWidth: '100%', borderRadius: '8px' }} />
          )}
        </div>
      )}
    </div>
  );
};
