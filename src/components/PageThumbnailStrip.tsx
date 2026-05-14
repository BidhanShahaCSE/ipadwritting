import React from 'react';
import { useNoteStore } from '../store/useNoteStore';
import type { BackgroundType } from '../types';

const bgColors: Record<BackgroundType, string> = {
  blank: '#FFFFFF',
  lined: '#FAFAFA',
  dotted: '#F8F8FA',
  graph: '#F5F5F7',
  dark: '#1C1C1E',
};

const PageThumbnailStrip: React.FC = () => {
  const { activeNote, activePageIndex, setActivePageIndex, addPage } = useNoteStore();

  if (!activeNote) return null;

  return (
    <div className="thumbnail-strip">
      {activeNote.pages.map((page, idx) => (
        <div
          key={page.id}
          className={`thumbnail-item ${activePageIndex === idx ? 'active' : ''}`}
          onClick={() => {
            setActivePageIndex(idx);
            const el = document.querySelector(`[data-page-index="${idx}"]`) as HTMLElement | null;
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          <div
            className="w-full h-full"
            style={{
              backgroundColor: bgColors[page.background] || '#FFFFFF',
              position: 'relative',
            }}
          >
            {/* Page number */}
            <span
              className="absolute bottom-0.5 right-1 text-[8px] font-medium"
              style={{ color: page.background === 'dark' ? '#8E8E93' : '#636366' }}
            >
              {idx + 1}
            </span>

            {/* Simple stroke preview dots */}
            {page.strokes.length > 0 && (
              <div className="absolute inset-1 opacity-30">
                {page.strokes.slice(0, 5).map((s, si) => (
                  <div
                    key={si}
                    className="absolute rounded-full"
                    style={{
                      width: 2,
                      height: 2,
                      backgroundColor: s.color,
                      left: `${(s.points[0]?.x / 794) * 100}%`,
                      top: `${(s.points[0]?.y / 1123) * 100}%`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Add page button */}
      <button
        onClick={() => addPage()}
        className="w-full aspect-[0.707] rounded-lg border-2 border-dashed flex items-center justify-center transition-colors"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
    </div>
  );
};

export default PageThumbnailStrip;
