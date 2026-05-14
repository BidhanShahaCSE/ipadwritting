import { create } from 'zustand';
import type { Note, Folder, PDFDocument, SplitPane } from '../types';

interface AppState {
  /* ── UI state ────────────────────────── */
  sidebarOpen: boolean;
  darkMode: boolean;
  pdfFocusMode: boolean;
  pdfFocusPrevSidebarOpen: boolean;
  sidebarTab: 'notes' | 'pdfs' | 'folders';
  searchQuery: string;
  selectedFolderId: string | null;

  /* ── Data lists ──────────────────────── */
  notes: Note[];
  folders: Folder[];
  pdfs: PDFDocument[];

  /* ── Split view ──────────────────────── */
  splitPanes: SplitPane[];
  showSplitView: boolean;

  /* ── Recording state ─────────────────── */
  isRecording: boolean;
  recordingTime: number;

  /* ── Color picker ────────────────────── */
  showColorPicker: boolean;
  showPenSizeSelector: boolean;

  /* ── Actions ─────────────────────────── */
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setDarkMode: (dark: boolean) => void;
  toggleDarkMode: () => void;
  setPdfFocusMode: (focus: boolean) => void;
  togglePdfFocusMode: () => void;
  setSidebarTab: (tab: 'notes' | 'pdfs' | 'folders') => void;
  setSearchQuery: (q: string) => void;
  setSelectedFolderId: (id: string | null) => void;

  setNotes: (notes: Note[]) => void;
  addNote: (note: Note) => void;
  updateNote: (note: Note) => void;
  removeNote: (id: string) => void;

  setFolders: (folders: Folder[]) => void;
  addFolder: (folder: Folder) => void;
  updateFolder: (folder: Folder) => void;
  removeFolder: (id: string) => void;

  setPdfs: (pdfs: PDFDocument[]) => void;
  addPdf: (pdf: PDFDocument) => void;
  removePdf: (id: string) => void;

  setSplitPanes: (panes: SplitPane[]) => void;
  setShowSplitView: (show: boolean) => void;
  addSplitPane: (pane: SplitPane) => void;
  removeSplitPane: (id: string) => void;

  setIsRecording: (recording: boolean) => void;
  setRecordingTime: (time: number) => void;
  setShowColorPicker: (show: boolean) => void;
  setShowPenSizeSelector: (show: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  darkMode: false,
  pdfFocusMode: false,
  pdfFocusPrevSidebarOpen: true,
  sidebarTab: 'notes',
  searchQuery: '',
  selectedFolderId: null,
  notes: [],
  folders: [],
  pdfs: [],
  splitPanes: [],
  showSplitView: false,
  isRecording: false,
  recordingTime: 0,
  showColorPicker: false,
  showPenSizeSelector: false,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setDarkMode: (dark) => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ darkMode: dark });
  },
  toggleDarkMode: () =>
    set((s) => {
      const next = !s.darkMode;
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return { darkMode: next };
    }),

  setPdfFocusMode: (focus) =>
    set((s) => {
      if (focus) {
        return {
          pdfFocusMode: true,
          pdfFocusPrevSidebarOpen: s.sidebarOpen,
          sidebarOpen: false,
          showColorPicker: false,
          showPenSizeSelector: false,
          showSplitView: false,
        };
      }

      return {
        pdfFocusMode: false,
        sidebarOpen: s.pdfFocusPrevSidebarOpen,
        showColorPicker: false,
        showPenSizeSelector: false,
      };
    }),
  togglePdfFocusMode: () =>
    set((s) => {
      const next = !s.pdfFocusMode;
      if (next) {
        return {
          pdfFocusMode: true,
          pdfFocusPrevSidebarOpen: s.sidebarOpen,
          sidebarOpen: false,
          showColorPicker: false,
          showPenSizeSelector: false,
          showSplitView: false,
        };
      }
      return {
        pdfFocusMode: false,
        sidebarOpen: s.pdfFocusPrevSidebarOpen,
        showColorPicker: false,
        showPenSizeSelector: false,
      };
    }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSelectedFolderId: (id) => set({ selectedFolderId: id }),

  setNotes: (notes) => set({ notes }),
  addNote: (note) => set((s) => ({ notes: [note, ...s.notes] })),
  updateNote: (note) =>
    set((s) => ({
      notes: s.notes.map((n) => (n.id === note.id ? note : n)),
    })),
  removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

  setFolders: (folders) => set({ folders }),
  addFolder: (folder) => set((s) => ({ folders: [...s.folders, folder] })),
  updateFolder: (folder) =>
    set((s) => ({
      folders: s.folders.map((f) => (f.id === folder.id ? folder : f)),
    })),
  removeFolder: (id) => set((s) => ({ folders: s.folders.filter((f) => f.id !== id), selectedFolderId: s.selectedFolderId === id ? null : s.selectedFolderId })),

  setPdfs: (pdfs) => set({ pdfs }),
  addPdf: (pdf) => set((s) => ({ pdfs: [pdf, ...s.pdfs] })),
  removePdf: (id) => set((s) => ({ pdfs: s.pdfs.filter((p) => p.id !== id) })),

  setSplitPanes: (panes) => set({ splitPanes: panes }),
  setShowSplitView: (show) => set({ showSplitView: show }),
  addSplitPane: (pane) => set((s) => ({ splitPanes: [...s.splitPanes, pane] })),
  removeSplitPane: (id) => set((s) => ({ splitPanes: s.splitPanes.filter((p) => p.id !== id) })),

  setIsRecording: (recording) => set({ isRecording: recording }),
  setRecordingTime: (time) => set({ recordingTime: time }),
  setShowColorPicker: (show) => set({ showColorPicker: show }),
  setShowPenSizeSelector: (show) => set({ showPenSizeSelector: show }),
}));
