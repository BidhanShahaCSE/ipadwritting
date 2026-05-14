/* ─── Core Types for NotePad Pro ────────────────────────────── */

export type ToolType =
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'lasso'
  | 'text'
  | 'line'
  | 'shape'
  | 'image'
  | 'voice'
  | 'hand';

export type ShapeType = 'rectangle' | 'ellipse' | 'triangle' | 'arrow';

export type BackgroundType = 'blank' | 'lined' | 'dotted' | 'graph' | 'dark';

export type PageSizeType = 'a4' | 'letter' | 'custom';

export const PAGE_SIZES: Record<PageSizeType, { width: number; height: number }> = {
  a4: { width: 794, height: 1123 },
  letter: { width: 816, height: 1056 },
  custom: { width: 1024, height: 1400 },
};

/* ─── Point with pressure/tilt ──────────────────────────────── */
export interface Point {
  x: number;
  y: number;
  pressure: number;
  tiltX?: number;
  tiltY?: number;
  timestamp: number;
}

/* ─── Stroke (drawn path) ───────────────────────────────────── */
export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  size: number;
  opacity: number;
  tool: 'pen' | 'highlighter' | 'line';
  isErased?: boolean;
}

/* ─── Text Box ──────────────────────────────────────────────── */
export interface TextBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
}

/* ─── Image Element ─────────────────────────────────────────── */
export interface ImageElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  src: string; // base64 data URL
  rotation: number;
  zIndex: number;
}

/* ─── Audio Recording ───────────────────────────────────────── */
export interface AudioRecording {
  id: string;
  noteId: string;
  pageIndex: number;
  blob: Blob;
  duration: number;
  createdAt: number;
  x: number;
  y: number;
}

/* ─── Page ──────────────────────────────────────────────────── */
export interface Page {
  id: string;
  background: BackgroundType;
  pageSize: PageSizeType;
  customWidth?: number;
  customHeight?: number;
  strokes: Stroke[];
  textBoxes: TextBox[];
  images: ImageElement[];
  audioIds: string[];
  pdfPageIndex?: number; // 0-indexed PDF page
}

/* ─── Note ──────────────────────────────────────────────────── */
export interface Note {
  id: string;
  title: string;
  folderId: string | null;
  pages: Page[];
  createdAt: number;
  updatedAt: number;
  thumbnail?: string; // base64 thumbnail
  pdfId?: string;
}

/* ─── Folder ────────────────────────────────────────────────── */
export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
  color: string;
}

/* ─── PDF Document ──────────────────────────────────────────── */
export interface PDFDocument {
  id: string;
  title: string;
  data: ArrayBuffer;
  pageCount: number;
  annotations: Record<number, Stroke[]>; // pageIndex -> strokes
  createdAt: number;
  updatedAt: number;
}

/* ─── Undo/Redo Action ──────────────────────────────────────── */
export interface HistoryAction {
  type: 'stroke_add' | 'stroke_remove' | 'text_add' | 'text_update' | 'text_remove'
    | 'image_add' | 'image_update' | 'image_remove' | 'page_add' | 'page_remove'
    | 'multi';
  pageIndex: number;
  data: unknown;
  inverse: unknown;
}

/* ─── Color Palette ─────────────────────────────────────────── */
export const COLOR_PALETTE: { name: string; value: string }[] = [
  { name: 'Black', value: '#000000' },
  { name: 'Dark Gray', value: '#636366' },
  { name: 'Red', value: '#FF3B30' },
  { name: 'Orange', value: '#FF9500' },
  { name: 'Yellow', value: '#FFCC00' },
  { name: 'Green', value: '#34C759' },
  { name: 'Teal', value: '#5AC8FA' },
  { name: 'Blue', value: '#007AFF' },
  { name: 'Indigo', value: '#5856D6' },
  { name: 'Purple', value: '#AF52DE' },
  { name: 'Pink', value: '#FF2D55' },
  { name: 'White', value: '#FFFFFF' },
];

/* ─── Split View Pane ───────────────────────────────────────── */
export interface SplitPane {
  id: string;
  noteId: string | null;
  pdfId: string | null;
  width: number; // percentage
}
