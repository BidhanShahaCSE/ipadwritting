import * as pdfjsLib from 'pdfjs-dist';

// Initialize worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;

const docCache = new Map<string, pdfjsLib.PDFDocumentProxy>();
const pageCache = new Map<string, HTMLCanvasElement>();

export async function loadPdfDocument(id: string, data: ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
  if (docCache.has(id)) {
    return docCache.get(id)!;
  }
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDoc = await loadingTask.promise;
  docCache.set(id, pdfDoc);
  return pdfDoc;
}

export async function renderPdfPageToCanvas(pdfId: string, pageIndex: number, data?: ArrayBuffer): Promise<HTMLCanvasElement | null> {
  const cacheKey = `${pdfId}-${pageIndex}`;
  if (pageCache.has(cacheKey)) {
    return pageCache.get(cacheKey)!;
  }

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

  // @ts-ignore
  const renderContext = {
    canvasContext: ctx,
    viewport: viewport,
    canvas: canvas,
  };

  await page.render(renderContext as any).promise;
  
  pageCache.set(cacheKey, canvas);
  return canvas;
}
