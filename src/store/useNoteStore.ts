import { create } from 'zustand';
import {
  type ToolType,
  type ShapeType,
  type Stroke,
  type Page,
  type Note,
  type TextBox,
  type ImageElement,
  type HistoryAction,
  type BackgroundType,
  type PageSizeType,
} from '../types';
import { v4 as uuid } from 'uuid';

interface NoteState {
  /* ── Active note ─────────────────────── */
  activeNote: Note | null;
  activePageIndex: number;
  isDirty: boolean;

  /* ── Tool state ──────────────────────── */
  activeTool: ToolType;
  activeShape: ShapeType;
  strokeColor: string;
  strokeSize: number;
  highlighterColor: string;
  highlighterSize: number;
  eraserSize: number;
  fontSize: number;
  fontFamily: string;
  textColor: string;
  textBold: boolean;
  textItalic: boolean;
  textUnderline: boolean;

  /* ── Canvas state ────────────────────── */
  zoom: number;
  panX: number;
  panY: number;
  isDrawing: boolean;
  activeStroke: Stroke | null;

  /* ── Selection state ─────────────────── */
  selectedStrokeIds: string[];
  selectedTextBoxId: string | null;
  selectedImageId: string | null;

  /* ── History ─────────────────────────── */
  history: HistoryAction[];
  historyIndex: number;

  /* ── Actions ─────────────────────────── */
  setActiveNote: (note: Note | null) => void;
  setActivePageIndex: (idx: number) => void;
  setActiveTool: (tool: ToolType) => void;
  setActiveShape: (shape: ShapeType) => void;
  setStrokeColor: (color: string) => void;
  setStrokeSize: (size: number) => void;
  setHighlighterColor: (color: string) => void;
  setHighlighterSize: (size: number) => void;
  setEraserSize: (size: number) => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setTextColor: (color: string) => void;
  setTextBold: (bold: boolean) => void;
  setTextItalic: (italic: boolean) => void;
  setTextUnderline: (underline: boolean) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setIsDrawing: (drawing: boolean) => void;
  setActiveStroke: (stroke: Stroke | null) => void;
  setSelectedStrokeIds: (ids: string[]) => void;
  setSelectedTextBoxId: (id: string | null) => void;
  setSelectedImageId: (id: string | null) => void;
  markDirty: () => void;
  markClean: () => void;

  /* ── Page/Stroke operations ──────────── */
  addStrokeToActivePage: (stroke: Stroke) => void;
  removeStrokesFromActivePage: (ids: string[]) => void;
  addTextBoxToActivePage: (textBox: TextBox) => void;
  updateTextBoxOnActivePage: (id: string, updates: Partial<TextBox>) => void;
  removeTextBoxFromActivePage: (id: string) => void;
  addImageToActivePage: (image: ImageElement) => void;
  updateImageOnActivePage: (id: string, updates: Partial<ImageElement>) => void;
  removeImageFromActivePage: (id: string) => void;
  addAudioIdToActivePage: (audioId: string) => void;
  removeAudioIdFromActivePage: (audioId: string) => void;
  addPage: (background?: BackgroundType, pageSize?: PageSizeType) => void;
  removePage: (index: number) => void;
  setPageBackground: (index: number, bg: BackgroundType) => void;
  updateNoteTitle: (title: string) => void;

  /* ── Undo / Redo ─────────────────────── */
  pushHistory: (action: HistoryAction) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

function createEmptyPage(background: BackgroundType = 'blank', pageSize: PageSizeType = 'a4'): Page {
  return {
    id: uuid(),
    background,
    pageSize,
    strokes: [],
    textBoxes: [],
    images: [],
    audioIds: [],
  };
}

export function createNewNote(title = 'Untitled Note'): Note {
  return {
    id: uuid(),
    title,
    folderId: null,
    pages: [createEmptyPage()],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

const MAX_HISTORY = 100;

export const useNoteStore = create<NoteState>((set, get) => ({
  /* ── Initial state ───────────────────── */
  activeNote: null,
  activePageIndex: 0,
  isDirty: false,

  activeTool: 'pen',
  activeShape: 'rectangle',
  strokeColor: '#000000',
  strokeSize: 3,
  highlighterColor: '#FFCC00',
  highlighterSize: 20,
  eraserSize: 20,
  fontSize: 16,
  fontFamily: 'Inter',
  textColor: '#000000',
  textBold: false,
  textItalic: false,
  textUnderline: false,

  zoom: 1,
  panX: 0,
  panY: 0,
  isDrawing: false,
  activeStroke: null,

  selectedStrokeIds: [],
  selectedTextBoxId: null,
  selectedImageId: null,

  history: [],
  historyIndex: -1,

  /* ── Setters ─────────────────────────── */
  setActiveNote: (note) => set({ activeNote: note, activePageIndex: 0, history: [], historyIndex: -1, isDirty: false }),
  setActivePageIndex: (idx) => set({ activePageIndex: idx, selectedStrokeIds: [], selectedTextBoxId: null, selectedImageId: null }),
  setActiveTool: (tool) => set({ activeTool: tool, selectedStrokeIds: [], selectedTextBoxId: null, selectedImageId: null }),
  setActiveShape: (shape) => set({ activeShape: shape }),
  setStrokeColor: (color) => set({ strokeColor: color }),
  setStrokeSize: (size) => set({ strokeSize: size }),
  setHighlighterColor: (color) => set({ highlighterColor: color }),
  setHighlighterSize: (size) => set({ highlighterSize: size }),
  setEraserSize: (size) => set({ eraserSize: size }),
  setFontSize: (size) => set({ fontSize: size }),
  setFontFamily: (family) => set({ fontFamily: family }),
  setTextColor: (color) => set({ textColor: color }),
  setTextBold: (bold) => set({ textBold: bold }),
  setTextItalic: (italic) => set({ textItalic: italic }),
  setTextUnderline: (underline) => set({ textUnderline: underline }),
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(5, zoom)) }),
  setPan: (x, y) => set({ panX: x, panY: y }),
  setIsDrawing: (drawing) => set({ isDrawing: drawing }),
  setActiveStroke: (stroke) => set({ activeStroke: stroke }),
  setSelectedStrokeIds: (ids) => set({ selectedStrokeIds: ids }),
  setSelectedTextBoxId: (id) => set({ selectedTextBoxId: id }),
  setSelectedImageId: (id) => set({ selectedImageId: id }),
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),

  /* ── Page/Stroke ops ─────────────────── */
  addStrokeToActivePage: (stroke) => {
    const { activeNote, activePageIndex } = get();
    if (!activeNote) return;
    const pages = [...activeNote.pages];
    pages[activePageIndex] = {
      ...pages[activePageIndex],
      strokes: [...pages[activePageIndex].strokes, stroke],
    };
    set({
      activeNote: { ...activeNote, pages, updatedAt: Date.now() },
      isDirty: true,
    });
  },

  removeStrokesFromActivePage: (ids) => {
    const { activeNote, activePageIndex } = get();
    if (!activeNote) return;
    const pages = [...activeNote.pages];
    pages[activePageIndex] = {
      ...pages[activePageIndex],
      strokes: pages[activePageIndex].strokes.filter((s) => !ids.includes(s.id)),
    };
    set({
      activeNote: { ...activeNote, pages, updatedAt: Date.now() },
      isDirty: true,
    });
  },

  addTextBoxToActivePage: (textBox) => {
    const { activeNote, activePageIndex } = get();
    if (!activeNote) return;
    const pages = [...activeNote.pages];
    pages[activePageIndex] = {
      ...pages[activePageIndex],
      textBoxes: [...pages[activePageIndex].textBoxes, textBox],
    };
    set({
      activeNote: { ...activeNote, pages, updatedAt: Date.now() },
      isDirty: true,
    });
  },

  updateTextBoxOnActivePage: (id, updates) => {
    const { activeNote, activePageIndex } = get();
    if (!activeNote) return;
    const pages = [...activeNote.pages];
    pages[activePageIndex] = {
      ...pages[activePageIndex],
      textBoxes: pages[activePageIndex].textBoxes.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    };
    set({
      activeNote: { ...activeNote, pages, updatedAt: Date.now() },
      isDirty: true,
    });
  },

  removeTextBoxFromActivePage: (id) => {
    const { activeNote, activePageIndex } = get();
    if (!activeNote) return;
    const pages = [...activeNote.pages];
    pages[activePageIndex] = {
      ...pages[activePageIndex],
      textBoxes: pages[activePageIndex].textBoxes.filter((t) => t.id !== id),
    };
    set({
      activeNote: { ...activeNote, pages, updatedAt: Date.now() },
      isDirty: true,
    });
  },

  addImageToActivePage: (image) => {
    const { activeNote, activePageIndex } = get();
    if (!activeNote) return;
    const pages = [...activeNote.pages];
    pages[activePageIndex] = {
      ...pages[activePageIndex],
      images: [...pages[activePageIndex].images, image],
    };
    set({
      activeNote: { ...activeNote, pages, updatedAt: Date.now() },
      isDirty: true,
    });
  },

  updateImageOnActivePage: (id, updates) => {
    const { activeNote, activePageIndex } = get();
    if (!activeNote) return;
    const pages = [...activeNote.pages];
    pages[activePageIndex] = {
      ...pages[activePageIndex],
      images: pages[activePageIndex].images.map((img) =>
        img.id === id ? { ...img, ...updates } : img
      ),
    };
    set({
      activeNote: { ...activeNote, pages, updatedAt: Date.now() },
      isDirty: true,
    });
  },

  removeImageFromActivePage: (id) => {
    const { activeNote, activePageIndex } = get();
    if (!activeNote) return;
    const pages = [...activeNote.pages];
    pages[activePageIndex] = {
      ...pages[activePageIndex],
      images: pages[activePageIndex].images.filter((img) => img.id !== id),
    };
    set({
      activeNote: { ...activeNote, pages, updatedAt: Date.now() },
      isDirty: true,
    });
  },

  addAudioIdToActivePage: (audioId) => {
    const { activeNote, activePageIndex } = get();
    if (!activeNote) return;
    const pages = [...activeNote.pages];
    pages[activePageIndex] = {
      ...pages[activePageIndex],
      audioIds: [...pages[activePageIndex].audioIds, audioId],
    };
    set({
      activeNote: { ...activeNote, pages, updatedAt: Date.now() },
      isDirty: true,
    });
  },

  removeAudioIdFromActivePage: (audioId) => {
    const { activeNote, activePageIndex } = get();
    if (!activeNote) return;
    const pages = [...activeNote.pages];
    pages[activePageIndex] = {
      ...pages[activePageIndex],
      audioIds: pages[activePageIndex].audioIds.filter((id) => id !== audioId),
    };
    set({
      activeNote: { ...activeNote, pages, updatedAt: Date.now() },
      isDirty: true,
    });
  },

  addPage: (background = 'blank', pageSize = 'a4') => {
    const { activeNote, activePageIndex } = get();
    if (!activeNote) return;
    const pages = [...activeNote.pages];
    const newPage = createEmptyPage(background, pageSize);
    pages.splice(activePageIndex + 1, 0, newPage);
    set({
      activeNote: { ...activeNote, pages, updatedAt: Date.now() },
      activePageIndex: activePageIndex + 1,
      isDirty: true,
    });
  },

  removePage: (index) => {
    const { activeNote, activePageIndex } = get();
    if (!activeNote || activeNote.pages.length <= 1) return;
    const pages = activeNote.pages.filter((_, i) => i !== index);
    const newIdx = Math.min(activePageIndex, pages.length - 1);
    set({
      activeNote: { ...activeNote, pages, updatedAt: Date.now() },
      activePageIndex: newIdx,
      isDirty: true,
    });
  },

  setPageBackground: (index, bg) => {
    const { activeNote } = get();
    if (!activeNote) return;
    const pages = [...activeNote.pages];
    pages[index] = { ...pages[index], background: bg };
    set({
      activeNote: { ...activeNote, pages, updatedAt: Date.now() },
      isDirty: true,
    });
  },

  updateNoteTitle: (title) => {
    const { activeNote } = get();
    if (!activeNote) return;
    set({
      activeNote: { ...activeNote, title, updatedAt: Date.now() },
      isDirty: true,
    });
  },

  /* ── Undo / Redo ─────────────────────── */
  pushHistory: (action) => {
    const { history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(action);
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const { history, historyIndex, activeNote } = get();
    if (historyIndex < 0 || !activeNote) return;
    const action = history[historyIndex];
    const pages = [...activeNote.pages];
    const pi = action.pageIndex;

    switch (action.type) {
      case 'stroke_add': {
        const strokeId = (action.data as Stroke).id;
        pages[pi] = { ...pages[pi], strokes: pages[pi].strokes.filter((s) => s.id !== strokeId) };
        break;
      }
      case 'stroke_remove': {
        const strokes = action.data as Stroke[];
        pages[pi] = { ...pages[pi], strokes: [...pages[pi].strokes, ...strokes] };
        break;
      }
      case 'text_add': {
        const tbId = (action.data as TextBox).id;
        pages[pi] = { ...pages[pi], textBoxes: pages[pi].textBoxes.filter((t) => t.id !== tbId) };
        break;
      }
      case 'text_update': {
        const old = action.inverse as TextBox;
        pages[pi] = { ...pages[pi], textBoxes: pages[pi].textBoxes.map((t) => t.id === old.id ? old : t) };
        break;
      }
      case 'text_remove': {
        const tb = action.data as TextBox;
        pages[pi] = { ...pages[pi], textBoxes: [...pages[pi].textBoxes, tb] };
        break;
      }
      case 'image_add': {
        const imgId = (action.data as ImageElement).id;
        pages[pi] = { ...pages[pi], images: pages[pi].images.filter((i) => i.id !== imgId) };
        break;
      }
      case 'image_update': {
        const oldImg = action.inverse as ImageElement;
        pages[pi] = { ...pages[pi], images: pages[pi].images.map((i) => i.id === oldImg.id ? oldImg : i) };
        break;
      }
      case 'image_remove': {
        const img = action.data as ImageElement;
        pages[pi] = { ...pages[pi], images: [...pages[pi].images, img] };
        break;
      }
    }

    set({
      activeNote: { ...activeNote, pages, updatedAt: Date.now() },
      historyIndex: historyIndex - 1,
      isDirty: true,
    });
  },

  redo: () => {
    const { history, historyIndex, activeNote } = get();
    if (historyIndex >= history.length - 1 || !activeNote) return;
    const action = history[historyIndex + 1];
    const pages = [...activeNote.pages];
    const pi = action.pageIndex;

    switch (action.type) {
      case 'stroke_add': {
        const stroke = action.data as Stroke;
        pages[pi] = { ...pages[pi], strokes: [...pages[pi].strokes, stroke] };
        break;
      }
      case 'stroke_remove': {
        const ids = (action.data as Stroke[]).map((s) => s.id);
        pages[pi] = { ...pages[pi], strokes: pages[pi].strokes.filter((s) => !ids.includes(s.id)) };
        break;
      }
      case 'text_add': {
        const tb = action.data as TextBox;
        pages[pi] = { ...pages[pi], textBoxes: [...pages[pi].textBoxes, tb] };
        break;
      }
      case 'text_update': {
        const newTb = action.data as TextBox;
        pages[pi] = { ...pages[pi], textBoxes: pages[pi].textBoxes.map((t) => t.id === newTb.id ? newTb : t) };
        break;
      }
      case 'text_remove': {
        const tbId = (action.data as TextBox).id;
        pages[pi] = { ...pages[pi], textBoxes: pages[pi].textBoxes.filter((t) => t.id !== tbId) };
        break;
      }
      case 'image_add': {
        const img = action.data as ImageElement;
        pages[pi] = { ...pages[pi], images: [...pages[pi].images, img] };
        break;
      }
      case 'image_update': {
        const newImg = action.data as ImageElement;
        pages[pi] = { ...pages[pi], images: pages[pi].images.map((i) => i.id === newImg.id ? newImg : i) };
        break;
      }
      case 'image_remove': {
        const imgId = (action.data as ImageElement).id;
        pages[pi] = { ...pages[pi], images: pages[pi].images.filter((i) => i.id !== imgId) };
        break;
      }
    }

    set({
      activeNote: { ...activeNote, pages, updatedAt: Date.now() },
      historyIndex: historyIndex + 1,
      isDirty: true,
    });
  },

  canUndo: () => get().historyIndex >= 0,
  canRedo: () => get().historyIndex < get().history.length - 1,
}));
