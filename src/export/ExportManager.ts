import { jsPDF } from 'jspdf';
import JSZip from 'jszip';

import type { Note } from '../types';
import { PAGE_SIZES } from '../types';
import { renderBackground, renderAllStrokes } from '../canvas/StrokeRenderer';
import { getAudiosForNote } from '../db/database';

type NotePage = Note['pages'][number];

type ShareCapableNavigator = Navigator;

function getPageSize(page: NotePage): { width: number; height: number } {
  if (page.pageSize === 'custom' && page.customWidth && page.customHeight) {
    return { width: page.customWidth, height: page.customHeight };
  }
  return PAGE_SIZES[page.pageSize];
}

function sanitizeFileNamePart(value: string): string {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.slice(0, 80) || 'Untitled Note';
}

function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function presentFileForSaving(file: File, title: string): Promise<void> {
  const nav = navigator as ShareCapableNavigator;

  if (typeof nav.share === 'function') {
    const shareData: ShareData = { title, files: [file] };
    const canShareFile = typeof nav.canShare === 'function'
      ? nav.canShare({ files: [file] })
      : true;

    if (canShareFile) {
      try {
        await nav.share(shareData);
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
      }
    }
  }

  triggerFileDownload(file, file.name);
}

async function renderPageToCanvas(page: NotePage): Promise<HTMLCanvasElement | null> {
  const pageSize = getPageSize(page);
  const canvas = document.createElement('canvas');
  canvas.width = pageSize.width;
  canvas.height = pageSize.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  renderBackground(ctx, pageSize.width, pageSize.height, page.background, false);
  renderAllStrokes(ctx, page.strokes);

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

  for (const img of page.images) {
    try {
      const imgEl = await loadImage(img.src);
      if (!imgEl) continue;
      ctx.drawImage(imgEl, img.x, img.y, img.width, img.height);
    } catch {
      // Skip failed images
    }
  }

  return canvas;
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function buildNotePdf(note: Note): Promise<jsPDF> {
  const firstPage = note.pages[0];
  const firstSize = firstPage ? getPageSize(firstPage) : PAGE_SIZES.a4;
  const pdf = new jsPDF({
    orientation: firstSize.width > firstSize.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [firstSize.width, firstSize.height],
  });

  if (note.pages.length === 0) {
    return pdf;
  }

  for (let i = 0; i < note.pages.length; i++) {
    const page = note.pages[i];
    const pageSize = getPageSize(page);

    if (i > 0) {
      pdf.addPage([pageSize.width, pageSize.height]);
    }

    const canvas = await renderPageToCanvas(page);
    if (!canvas) continue;

    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, pageSize.width, pageSize.height);
  }

  return pdf;
}

function getAudioExtension(blob: Blob): string {
  const mime = blob.type.split(';')[0].toLowerCase();
  switch (mime) {
    case 'audio/webm':
      return 'webm';
    case 'audio/mp4':
      return 'm4a';
    case 'audio/mpeg':
      return 'mp3';
    case 'audio/wav':
    case 'audio/x-wav':
      return 'wav';
    case 'audio/ogg':
      return 'ogg';
    default:
      if (mime.startsWith('audio/')) {
        return mime.slice('audio/'.length) || 'bin';
      }
      return 'bin';
  }
}

/** Export a note as PDF */
export async function exportNoteToPDF(note: Note): Promise<void> {
  const pdf = await buildNotePdf(note);
  const safeTitle = sanitizeFileNamePart(note.title || 'Untitled');
  pdf.save(`${safeTitle}.pdf`);
}

/** Share note using Web Share API */
export async function shareNote(note: Note): Promise<void> {
  const nav = navigator as ShareCapableNavigator;
  if (typeof nav.share !== 'function') {
    alert('Web Share API is not supported on this device.');
    return;
  }

  try {
    const pdf = await buildNotePdf(note);
    const blob = pdf.output('blob');
    const safeTitle = sanitizeFileNamePart(note.title || 'Note');
    const file = new File([blob], `${safeTitle}.pdf`, { type: 'application/pdf' });

    await nav.share({
      title: note.title,
      files: [file],
    });
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.error('Share failed:', err);
    }
  }
}

/** Save note to iPad Files. If audio exists, save as a bundled zip package. */
export async function saveNoteToFiles(note: Note): Promise<void> {
  try {
    const safeTitle = sanitizeFileNamePart(note.title || 'Untitled Note');
    const pdf = await buildNotePdf(note);
    const pdfBlob = pdf.output('blob');
    const audios = await getAudiosForNote(note.id);

    if (audios.length === 0) {
      const pdfFile = new File([pdfBlob], `${safeTitle}.pdf`, { type: 'application/pdf' });
      await presentFileForSaving(pdfFile, safeTitle);
      return;
    }

    const zip = new JSZip();
    const root = zip.folder(safeTitle);
    if (!root) {
      throw new Error('Could not create export folder');
    }

    root.file(`${safeTitle}.pdf`, pdfBlob);
    root.file(
      'manifest.json',
      JSON.stringify(
        {
          title: note.title,
          noteId: note.id,
          pages: note.pages.length,
          exportedAt: new Date().toISOString(),
          audioCount: audios.length,
        },
        null,
        2
      )
    );

    const audioFolder = root.folder('audio');
    if (!audioFolder) {
      throw new Error('Could not create audio folder');
    }

    const sortedAudios = [...audios].sort((a, b) => a.createdAt - b.createdAt);
    for (let i = 0; i < sortedAudios.length; i++) {
      const audio = sortedAudios[i];
      const ext = getAudioExtension(audio.blob);
      const filename = `audio-${String(i + 1).padStart(2, '0')}-page-${audio.pageIndex + 1}.${ext}`;
      audioFolder.file(filename, audio.blob);
    }

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const zipFile = new File([zipBlob], `${safeTitle}.zip`, { type: 'application/zip' });
    await presentFileForSaving(zipFile, safeTitle);
  } catch (err) {
    console.error('Save to Files failed:', err);
    alert('Could not save note to Files. Please try again.');
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
