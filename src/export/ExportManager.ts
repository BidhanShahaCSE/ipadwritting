import { jsPDF } from 'jspdf';

import type { Note } from '../types';
import { PAGE_SIZES } from '../types';
import { renderBackground, renderAllStrokes } from '../canvas/StrokeRenderer';

/** Export a note as PDF */
export async function exportNoteToPDF(note: Note): Promise<void> {
  const firstPage = note.pages[0];
  const size = PAGE_SIZES[firstPage.pageSize];
  const pdf = new jsPDF({
    orientation: size.width > size.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [size.width, size.height],
  });

  for (let i = 0; i < note.pages.length; i++) {
    if (i > 0) pdf.addPage([size.width, size.height]);

    const page = note.pages[i];
    const pageSize = PAGE_SIZES[page.pageSize];

    // Create offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = pageSize.width;
    canvas.height = pageSize.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // Render background
    renderBackground(ctx, pageSize.width, pageSize.height, page.background, false);

    // Render strokes
    renderAllStrokes(ctx, page.strokes);

    // Render text boxes
    for (const tb of page.textBoxes) {
      ctx.save();
      ctx.font = `${tb.bold ? 'bold ' : ''}${tb.italic ? 'italic ' : ''}${tb.fontSize}px ${tb.fontFamily}`;
      ctx.fillStyle = tb.color;
      ctx.textBaseline = 'top';

      const lines = wrapText(ctx, tb.content, tb.width);
      let y = tb.y;
      for (const line of lines) {
        ctx.fillText(line, tb.x, y);
        y += tb.fontSize * 1.4;
      }
      ctx.restore();
    }

    // Render images
    for (const img of page.images) {
      try {
        const imgEl = new Image();
        imgEl.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
          imgEl.onload = () => {
            ctx.drawImage(imgEl, img.x, img.y, img.width, img.height);
            resolve();
          };
          imgEl.onerror = () => resolve();
          imgEl.src = img.src;
        });
      } catch {
        // Skip failed images
      }
    }

    // Add canvas to PDF
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, pageSize.width, pageSize.height);
  }

  pdf.save(`${note.title || 'Untitled'}.pdf`);
}

/** Share note using Web Share API */
export async function shareNote(note: Note): Promise<void> {
  if (!navigator.share) {
    alert('Web Share API is not supported on this device.');
    return;
  }

  try {
    // Generate a PDF blob for sharing
    const firstPage = note.pages[0];
    const size = PAGE_SIZES[firstPage.pageSize];
    const pdf = new jsPDF({
      orientation: size.width > size.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [size.width, size.height],
    });

    for (let i = 0; i < note.pages.length; i++) {
      if (i > 0) pdf.addPage([size.width, size.height]);
      const page = note.pages[i];
      const pageSize = PAGE_SIZES[page.pageSize];
      const canvas = document.createElement('canvas');
      canvas.width = pageSize.width;
      canvas.height = pageSize.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      renderBackground(ctx, pageSize.width, pageSize.height, page.background, false);
      renderAllStrokes(ctx, page.strokes);
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, pageSize.width, pageSize.height);
    }

    const blob = pdf.output('blob');
    const file = new File([blob], `${note.title || 'Note'}.pdf`, { type: 'application/pdf' });

    await navigator.share({
      title: note.title,
      files: [file],
    });
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.error('Share failed:', err);
    }
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}
