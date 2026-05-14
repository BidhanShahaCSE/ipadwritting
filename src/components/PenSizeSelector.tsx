import React from 'react';
import { useNoteStore } from '../store/useNoteStore';
import { useAppStore } from '../store/useAppStore';
import { PEN_SIZES, HIGHLIGHTER_SIZES } from '../utils/colors';

const PenSizeSelector: React.FC = () => {
  const {
    activeTool,
    strokeSize,
    setStrokeSize,
    strokeOpacity,
    setStrokeOpacity,
    highlighterSize,
    setHighlighterSize,
    highlighterOpacity,
    setHighlighterOpacity,
    eraserSize,
    setEraserSize,
    strokeColor,
    highlighterColor,
  } = useNoteStore();
  const { showPenSizeSelector } = useAppStore();

  if (!showPenSizeSelector) return null;

  const sizes = activeTool === 'highlighter' ? HIGHLIGHTER_SIZES : activeTool === 'eraser' ? [10, 20, 30, 40, 50] : PEN_SIZES;
  const currentSize = activeTool === 'highlighter' ? highlighterSize : activeTool === 'eraser' ? eraserSize : strokeSize;
  const setSize = activeTool === 'highlighter' ? setHighlighterSize : activeTool === 'eraser' ? setEraserSize : setStrokeSize;
  const previewColor = activeTool === 'highlighter' ? highlighterColor : activeTool === 'eraser' ? '#999' : strokeColor;

  const showIntensity = activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'line' || activeTool === 'shape';
  const currentOpacity = activeTool === 'highlighter' ? highlighterOpacity : strokeOpacity;
  const setOpacity = activeTool === 'highlighter' ? setHighlighterOpacity : setStrokeOpacity;

  return (
    <div className="frosted-popup absolute bottom-14 left-1/2 -translate-x-1/2 p-4 z-50 animate-scale-in" style={{width: 240}}
      onPointerDown={e => e.stopPropagation()}>
      <div className="text-xs font-medium mb-3" style={{color:'var(--color-text-secondary)'}}>
        {activeTool === 'eraser' ? 'Eraser' : activeTool === 'highlighter' ? 'Highlighter' : 'Pen'} Size
      </div>

      {/* Size presets */}
      <div className="flex items-end justify-between mb-4 px-2" style={{height: 40}}>
        {sizes.map(s => (
          <button
            key={s}
            onClick={() => setSize(s)}
            className="flex flex-col items-center gap-1"
          >
            <div
              className="rounded-full transition-all"
              style={{
                width: Math.max(4, s * 1.5),
                height: Math.max(4, s * 1.5),
                backgroundColor: currentSize === s ? previewColor : 'var(--color-text-secondary)',
                opacity: currentSize === s ? 1 : 0.4,
                border: currentSize === s ? '2px solid var(--color-accent)' : 'none',
              }}
            />
          </button>
        ))}
      </div>

      {/* Slider */}
      <input
        type="range"
        min={1}
        max={activeTool === 'eraser' ? 60 : activeTool === 'highlighter' ? 40 : 30}
        value={currentSize}
        onChange={e => setSize(Number(e.target.value))}
        className="w-full"
      />

      <div className="text-center mt-2 text-xs font-mono" style={{color:'var(--color-text-secondary)'}}>
        {currentSize}px
      </div>

      {showIntensity && (
        <>
          <div className="mt-4 text-xs font-medium" style={{color:'var(--color-text-secondary)'}}>
            Intensity
          </div>

          <div className="mt-2 h-3 rounded-full" style={{background: 'var(--color-hover)'}}>
            <div
              className="h-3 rounded-full"
              style={{
                width: `${Math.round(currentOpacity * 100)}%`,
                background: previewColor,
                opacity: currentOpacity,
              }}
            />
          </div>

          <input
            type="range"
            min={activeTool === 'highlighter' ? 5 : 10}
            max={100}
            step={5}
            value={Math.round(currentOpacity * 100)}
            onChange={e => setOpacity(Number(e.target.value) / 100)}
            className="w-full mt-3"
          />

          <div className="text-center mt-2 text-xs font-mono" style={{color:'var(--color-text-secondary)'}}>
            {Math.round(currentOpacity * 100)}%
          </div>
        </>
      )}
    </div>
  );
};

export default PenSizeSelector;
