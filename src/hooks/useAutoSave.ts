import { useEffect, useRef } from 'react';
import { useNoteStore } from '../store/useNoteStore';
import { useAppStore } from '../store/useAppStore';
import { saveNote } from '../db/database';
import { renderBackground, renderAllStrokes } from '../canvas/StrokeRenderer';
import { PAGE_SIZES } from '../types';

function generateThumbnail(note: ReturnType<typeof useNoteStore.getState>['activeNote']): string | undefined {
  if (!note || note.pages.length === 0) return undefined;
  // Keep PDF note previews from the imported first-page snapshot.
  if (note.pdfId) return note.thumbnail;

  const page = note.pages[0];
  const size = page.pageSize === 'custom' && page.customWidth && page.customHeight
    ? { width: page.customWidth, height: page.customHeight }
    : PAGE_SIZES[page.pageSize];

  const canvas = document.createElement('canvas');
  const scale = 200 / size.width;
  canvas.width = 200;
  canvas.height = size.height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  ctx.scale(scale, scale);
  renderBackground(ctx, size.width, size.height, page.background, false);
  renderAllStrokes(ctx, page.strokes);

  // Render text as simple text
  for (const tb of page.textBoxes) {
    ctx.save();
    ctx.font = `${tb.bold ? 'bold ' : ''}${tb.fontSize}px ${tb.fontFamily}`;
    ctx.fillStyle = tb.color;
    ctx.textBaseline = 'top';
    ctx.fillText(tb.content, tb.x, tb.y);
    ctx.restore();
  }

  // Render simple image placeholders so thumbnails reflect image-heavy pages.
  for (const img of page.images) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.lineWidth = 1;
    ctx.fillRect(img.x, img.y, img.width, img.height);
    ctx.strokeRect(img.x, img.y, img.width, img.height);
    ctx.restore();
  }

  try {
    return canvas.toDataURL('image/webp', 0.4);
  } catch {
    return undefined;
  }
}

export function useAutoSave() {
  const { activeNote, isDirty, markClean } = useNoteStore();
  const { updateNote } = useAppStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeNote || !isDirty) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      // Generate thumbnail before saving
      const thumbnail = generateThumbnail(activeNote);
      const noteToSave = thumbnail ? { ...activeNote, thumbnail } : activeNote;

      await saveNote(noteToSave);
      updateNote(noteToSave);
      markClean();
    }, 2000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeNote, isDirty]);
}
