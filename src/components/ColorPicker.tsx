import React, { useState, useRef, useEffect } from 'react';
import { useNoteStore } from '../store/useNoteStore';
import { useAppStore } from '../store/useAppStore';
import { COLOR_PALETTE } from '../types';
import { hsbToHex, hexToHsb } from '../utils/colors';

const ColorPicker: React.FC = () => {
  const { strokeColor, setStrokeColor, activeTool, setHighlighterColor, highlighterColor } = useNoteStore();
  const { showColorPicker, setShowColorPicker } = useAppStore();
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [brightness, setBrightness] = useState(100);
  const [showCustom, setShowCustom] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const currentColor = activeTool === 'highlighter' ? highlighterColor : strokeColor;

  useEffect(() => {
    const hsb = hexToHsb(currentColor);
    setHue(hsb.h);
    setSaturation(hsb.s);
    setBrightness(hsb.b);
  }, [currentColor]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    if (showColorPicker) document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [showColorPicker]);

  const selectColor = (color: string) => {
    if (activeTool === 'highlighter') {
      setHighlighterColor(color);
    } else {
      setStrokeColor(color);
    }
  };

  const applyCustomColor = () => {
    const hex = hsbToHex(hue, saturation, brightness);
    selectColor(hex);
  };

  if (!showColorPicker) return null;

  return (
    <div ref={pickerRef} className="frosted-popup absolute bottom-14 left-1/2 -translate-x-1/2 p-4 z-50 animate-scale-in" style={{width: 280}}>
      {/* Preset colors */}
      <div className="grid grid-cols-6 gap-2 mb-3">
        {COLOR_PALETTE.map(c => (
          <button
            key={c.value}
            className={`color-swatch ${currentColor === c.value ? 'selected' : ''}`}
            style={{ backgroundColor: c.value, border: c.value === '#FFFFFF' ? '1px solid var(--color-border)' : undefined }}
            onClick={() => selectColor(c.value)}
            title={c.name}
          />
        ))}
      </div>

      {/* Toggle custom picker */}
      <button
        className="w-full text-xs font-medium py-1.5 rounded-lg transition-colors"
        style={{ color: 'var(--color-accent)', background: 'var(--color-hover)' }}
        onClick={() => setShowCustom(!showCustom)}
      >
        {showCustom ? 'Hide Custom' : 'Custom Color'}
      </button>

      {showCustom && (
        <div className="mt-3 space-y-3">
          {/* Hue slider */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{color:'var(--color-text-secondary)'}}>Hue</label>
            <input type="range" min={0} max={360} value={hue} onChange={e => { setHue(Number(e.target.value)); applyCustomColor(); }}
              className="w-full" style={{background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'}} />
          </div>
          {/* Saturation slider */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{color:'var(--color-text-secondary)'}}>Saturation</label>
            <input type="range" min={0} max={100} value={saturation} onChange={e => { setSaturation(Number(e.target.value)); applyCustomColor(); }} className="w-full" />
          </div>
          {/* Brightness slider */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{color:'var(--color-text-secondary)'}}>Brightness</label>
            <input type="range" min={0} max={100} value={brightness} onChange={e => { setBrightness(Number(e.target.value)); applyCustomColor(); }} className="w-full" />
          </div>
          {/* Preview */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl border" style={{backgroundColor: hsbToHex(hue, saturation, brightness), borderColor: 'var(--color-border)'}} />
            <span className="text-xs font-mono" style={{color:'var(--color-text-secondary)'}}>{hsbToHex(hue, saturation, brightness)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
