import React from 'react';
import { useNoteStore } from '../store/useNoteStore';
import { useAppStore } from '../store/useAppStore';
import type { BackgroundType } from '../types';

const BottomToolbar: React.FC = () => {
  const {
    activeNote,
    activePageIndex,
    addPage,
    removePage,
    setPageBackground,
    zoom,
    setZoom,
  } = useNoteStore();
  const { showPageStrip, togglePageStrip } = useAppStore();

  if (!activeNote) return null;
  const totalPages = activeNote.pages.length;
  const currentPage = activeNote.pages[activePageIndex];
  const isPdfNote = Boolean(activeNote.pdfId);

  const allBackgrounds: { id: BackgroundType; label: string; title: string }[] = [
    { id: 'blank', label: 'B', title: 'Blank' },
    { id: 'lined', label: 'L', title: 'Lined' },
    { id: 'dotted', label: 'D', title: 'Dotted' },
    { id: 'graph', label: 'G', title: 'Graph' },
    { id: 'dark', label: 'N', title: 'Dark' },
  ];
  const backgrounds = isPdfNote
    ? allBackgrounds.filter((bg) => bg.id === 'graph' || bg.id === 'dark')
    : allBackgrounds;

  return (
    <div
      className="glass flex items-center gap-2 px-4 pt-2 border-t"
      style={{
        borderColor: 'var(--color-border)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)',
      }}
    >
      <span className="text-xs font-medium px-2 whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
        Page {activePageIndex + 1} / {totalPages}
      </span>
      <button
        className="tool-btn"
        onClick={togglePageStrip}
        title={showPageStrip ? 'Minimize Page Panel' : 'Show Page Panel'}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={showPageStrip ? 'M19.5 12h-15M7.5 7.5l-3 4.5 3 4.5' : 'M4.5 12h15M16.5 7.5l3 4.5-3 4.5'}
          />
        </svg>
      </button>

      <div className="w-px h-6 mx-1" style={{ background: 'var(--color-border)' }} />

      <button className="tool-btn" onClick={() => addPage(currentPage.background, currentPage.pageSize)} title="Add Page">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
      <button
        className="tool-btn"
        onClick={() => removePage(activePageIndex)}
        disabled={totalPages <= 1}
        style={{ opacity: totalPages <= 1 ? 0.3 : 1 }}
        title="Delete Page"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 12h-15" />
        </svg>
      </button>

      <div className="w-px h-6 mx-1" style={{ background: 'var(--color-border)' }} />

      <div className="flex gap-1">
        {backgrounds.map((bg) => (
          <button
            key={bg.id}
            onClick={() => setPageBackground(activePageIndex, bg.id)}
            className={`w-7 h-7 rounded-lg text-[10px] font-semibold flex items-center justify-center transition-all ${
              currentPage.background === bg.id ? 'ring-2 ring-blue-500' : ''
            }`}
            style={{ background: 'var(--color-hover)' }}
            title={bg.title}
          >
            {bg.label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      <button className="tool-btn" onClick={() => setZoom(zoom - 0.1)} title="Zoom Out">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM13.5 10.5h-6" />
        </svg>
      </button>
      <span className="text-xs font-mono min-w-[3rem] text-center" style={{ color: 'var(--color-text-secondary)' }}>
        {Math.round(zoom * 100)}%
      </span>
      <button className="tool-btn" onClick={() => setZoom(zoom + 0.1)} title="Zoom In">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
        </svg>
      </button>
      <button className="tool-btn" onClick={() => setZoom(1)} title="Reset Zoom">
        <span className="text-xs font-medium">1:1</span>
      </button>
    </div>
  );
};

export default BottomToolbar;
