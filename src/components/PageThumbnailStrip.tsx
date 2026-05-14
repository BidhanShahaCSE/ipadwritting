import React from 'react';
import { useNoteStore } from '../store/useNoteStore';
import type { BackgroundType, Page } from '../types';
import { PAGE_SIZES } from '../types';

const bgColors: Record<BackgroundType, string> = {
  blank: '#FFFFFF',
  lined: '#FAFAFA',
  dotted: '#F8F8FA',
  graph: '#F5F5F7',
  dark: '#1C1C1E',
};

const ThumbnailPreview: React.FC<{
  page: Page;
}> = ({ page }) => {
  const size =
    page.pageSize === 'custom' && page.customWidth && page.customHeight
      ? { width: page.customWidth, height: page.customHeight }
      : PAGE_SIZES[page.pageSize];

  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
    >
      <rect x={0} y={0} width={width} height={height} fill={bgColors[page.background] || '#FFFFFF'} />

      {page.strokes.slice(0, 80).map((stroke) => {
        if (!stroke.points.length) return null;
        const sampledPoints = stroke.points.filter((_, i) => i % 2 === 0);
        const pointsText = sampledPoints.map((p) => `${p.x},${p.y}`).join(' ');
        if (!pointsText) return null;
        return (
          <polyline
            key={stroke.id}
            points={pointsText}
            fill="none"
            stroke={stroke.color}
            strokeOpacity={stroke.opacity}
            strokeWidth={Math.max(1, stroke.size)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}

      {page.images.slice(0, 12).map((img) => (
        <rect
          key={img.id}
          x={img.x}
          y={img.y}
          width={Math.max(6, img.width)}
          height={Math.max(6, img.height)}
          rx={8}
          ry={8}
          fill="rgba(0,0,0,0.08)"
          stroke="rgba(0,0,0,0.18)"
          strokeWidth={1}
        />
      ))}

      {page.textBoxes.slice(0, 30).map((tb) => (
        <g key={tb.id}>
          <rect
            x={tb.x}
            y={tb.y}
            width={Math.max(20, tb.width)}
            height={Math.max(14, tb.height)}
            rx={4}
            ry={4}
            fill="rgba(0,0,0,0.04)"
          />
          {tb.content.trim().length > 0 && (
            <text
              x={tb.x + 4}
              y={tb.y + Math.max(10, tb.fontSize)}
              fontSize={Math.max(8, tb.fontSize)}
              fill={tb.color}
              opacity={0.9}
              fontWeight={tb.bold ? '700' : '400'}
            >
              {tb.content.slice(0, 40)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
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
          <div className="w-full h-full" style={{ position: 'relative' }}>
            <ThumbnailPreview page={page} />
            {/* Page number */}
            <span
              className="absolute bottom-0.5 right-1 text-[8px] font-medium"
              style={{ color: page.background === 'dark' ? '#8E8E93' : '#636366' }}
            >
              {idx + 1}
            </span>
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
