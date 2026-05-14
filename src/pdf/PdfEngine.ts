import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

// Initialize worker (bundle-local; avoids CDN/CORS/offline issues)
GlobalWorkerOptions.workerSrc = workerSrc;

const docCache = new Map<string, PDFDocumentProxy>();
const pageCache = new Map<string, HTMLCanvasElement>();

export async function loadPdfDocument(id: string, data: ArrayBuffer): Promise<PDFDocumentProxy> {
  if (docCache.has(id)) {
    return docCache.get(id)!;
  }
  if (data.byteLength === 0) {
    throw new Error('PDF data is empty (possibly detached). Re-import the PDF.');
  }
  // pdf.js may transfer/detach the passed buffer to the worker; keep the stored buffer intact.
  const loadingTask = getDocument({ data: data.slice(0) });
  const pdfDoc = await loadingTask.promise;
  docCache.set(id, pdfDoc);
  return pdfDoc;
}

export async function renderPdfPageToCanvas(pdfId: string, pageIndex: number, data?: ArrayBuffer): Promise<HTMLCanvasElement | null> {
  const cacheKey = `${pdfId}-${pageIndex}`;
  if (pageCache.has(cacheKey)) {
    return pageCache.get(cacheKey)!;
  }

  try {
    let pdfDoc = docCache.get(pdfId);
    if (!pdfDoc && data) {
      pdfDoc = await loadPdfDocument(pdfId, data);
    }
    if (!pdfDoc) return null;

    // pageIndex is 0-based in our app, PDF.js is 1-based
    const page = await pdfDoc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 2.0 }); // Render at 2x for retina quality

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderContext = {
      canvasContext: ctx,
      viewport,
    };

    await page.render(renderContext as any).promise;

    pageCache.set(cacheKey, canvas);
    return canvas;
  } catch (err) {
    console.error('PDF render failed', { pdfId, pageIndex, err });
    return null;
  }
}
