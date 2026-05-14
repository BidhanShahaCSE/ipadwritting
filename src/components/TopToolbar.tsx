import React, { useRef } from 'react';
import { useNoteStore } from '../store/useNoteStore';
import { useAppStore } from '../store/useAppStore';
import type { ToolType } from '../types';
import { readFileAsDataURL } from '../utils/helpers';
import { v4 as uuid } from 'uuid';

const TopToolbar: React.FC = () => {
  const {
    activeTool, setActiveTool, strokeColor, undo, redo,
    canUndo, canRedo, activeNote, selectedStrokeIds,
    removeStrokesFromActivePage, activePageIndex, pushHistory,
  } = useNoteStore();
  const {
    toggleSidebar, sidebarOpen, toggleDarkMode, darkMode,
    setShowColorPicker, showColorPicker,
    setShowPenSizeSelector, showPenSizeSelector,
    setIsRecording, isRecording, setShowSplitView,
    pdfFocusMode, togglePdfFocusMode,
  } = useAppStore();
  const imgInputRef = useRef<HTMLInputElement>(null);

  const hasActiveNote = Boolean(activeNote);

  const tools: { id: ToolType; icon: string; label: string }[] = [
    { id: 'pen', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z', label: 'Pen' },
    { id: 'highlighter', icon: 'M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42', label: 'Highlighter' },
    { id: 'eraser', icon: 'M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z', label: 'Eraser' },
    { id: 'lasso', icon: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Lasso' },
    { id: 'text', icon: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12', label: 'Text' },
    { id: 'line', icon: 'M4.5 19.5l15-15', label: 'Line' },
    { id: 'shape', icon: 'M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z', label: 'Shapes' },
    { id: 'hand', icon: 'M10.05 4.575a1.575 1.575 0 10-3.15 0v3.15a1.575 1.575 0 003.15 0v-3.15zm4.2 0a1.575 1.575 0 10-3.15 0v3.15a1.575 1.575 0 003.15 0v-3.15zM15 12.75a3 3 0 11-6 0 3 3 0 016 0z', label: 'Pan' },
  ];

  const handleImageInsert = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeNote) return;
    const dataUrl = await readFileAsDataURL(file);
    const img = new Image();
    img.onload = () => {
      const maxW = 400;
      const scale = maxW / img.width;
      const imgEl = {
        id: uuid(), x: 100, y: 100,
        width: Math.min(img.width, maxW),
        height: img.width > maxW ? img.height * scale : img.height,
        src: dataUrl, rotation: 0, zIndex: 10,
      };
      useNoteStore.getState().addImageToActivePage(imgEl);
      useNoteStore.getState().pushHistory({ type: 'image_add', pageIndex: activePageIndex, data: imgEl, inverse: null });
    };
    img.src = dataUrl;
    e.target.value = '';
  };

  const handleDeleteSelected = () => {
    if (selectedStrokeIds.length > 0 && activeNote) {
      const page = activeNote.pages[activePageIndex];
      const removed = page.strokes.filter(s => selectedStrokeIds.includes(s.id));
      removeStrokesFromActivePage(selectedStrokeIds);
      pushHistory({ type: 'stroke_remove', pageIndex: activePageIndex, data: removed, inverse: null });
    }
  };

  return (
    <div
      className="glass flex items-center gap-1 px-3 pb-2 border-b"
      style={{
        borderColor: 'var(--color-border)',
        paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)',
      }}
    >
      {/* Sidebar toggle */}
      <button className="tool-btn" onClick={toggleSidebar}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? 'M6 18L18 6M6 6l12 12' : 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5'} />
        </svg>
      </button>

      <div className="w-px h-6 mx-1" style={{background: 'var(--color-border)'}} />

      {/* Undo / Redo */}
      <button className="tool-btn" onClick={undo} disabled={!canUndo()} style={{opacity: canUndo() ? 1 : 0.3}}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
        </svg>
      </button>
      <button className="tool-btn" onClick={redo} disabled={!canRedo()} style={{opacity: canRedo() ? 1 : 0.3}}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
        </svg>
      </button>

      <div className="w-px h-6 mx-1" style={{background: 'var(--color-border)'}} />

      {/* Drawing tools */}
      {tools.map(t => (
        <button
          key={t.id}
          className={`tool-btn ${activeTool === t.id ? 'active' : ''}`}
          onClick={() => setActiveTool(t.id)}
          title={t.label}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={t.icon} />
          </svg>
        </button>
      ))}

      <div className="w-px h-6 mx-1" style={{background: 'var(--color-border)'}} />

      {/* Color button */}
      <button className="tool-btn relative" onClick={() => { setShowColorPicker(!showColorPicker); setShowPenSizeSelector(false); }}>
        <div className="w-5 h-5 rounded-full border-2" style={{backgroundColor: strokeColor, borderColor: 'var(--color-border)'}} />
      </button>

      {/* Size button */}
      <button className="tool-btn" onClick={() => { setShowPenSizeSelector(!showPenSizeSelector); setShowColorPicker(false); }}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        </svg>
      </button>

      <div className="w-px h-6 mx-1" style={{background: 'var(--color-border)'}} />

      {/* Image insert */}
      <button className="tool-btn" onClick={() => imgInputRef.current?.click()} title="Insert Image">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V4.5a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v15a1.5 1.5 0 001.5 1.5zM8.25 8.25h.008v.008H8.25V8.25z" />
        </svg>
      </button>
      <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageInsert} />

      {/* Voice record */}
      <button
        className={`tool-btn ${isRecording ? 'active' : ''}`}
        onClick={() => setIsRecording(!isRecording)}
        title="Voice Record"
      >
        <svg className="w-5 h-5" fill={isRecording ? '#FF3B30' : 'none'} stroke={isRecording ? '#FF3B30' : 'currentColor'} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
      </button>

      <div className="flex-1" />

      {/* Delete selected */}
      {selectedStrokeIds.length > 0 && (
        <button className="tool-btn" onClick={handleDeleteSelected} title="Delete Selected" style={{color: '#FF3B30'}}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      )}

      {/* Split view */}
      <button className="tool-btn" onClick={() => setShowSplitView(true)} title="Open Another">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 4.5v15m6-15v15M3.75 4.5h16.5a1.5 1.5 0 011.5 1.5v12a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V6a1.5 1.5 0 011.5-1.5z" />
        </svg>
      </button>

      {/* Fullscreen (focus mode) */}
      {hasActiveNote && (
        <button
          className={`tool-btn ${pdfFocusMode ? 'active' : ''}`}
          onClick={togglePdfFocusMode}
          title={pdfFocusMode ? 'Exit Full Screen' : 'Full Screen'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d={
                pdfFocusMode
                  ? 'M9 9H5.25V5.25M15 9h3.75V5.25M9 15H5.25v3.75M15 15h3.75v3.75'
                  : 'M4.5 9V4.5H9M19.5 9V4.5H15M4.5 15v4.5H9M19.5 15v4.5H15'
              }
            />
          </svg>
        </button>
      )}

      {/* Dark mode toggle */}
      <button className="tool-btn" onClick={toggleDarkMode} title={darkMode ? 'Light Mode' : 'Dark Mode'}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={darkMode ? 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z' : 'M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z'} />
        </svg>
      </button>
    </div>
  );
};

export default TopToolbar;
