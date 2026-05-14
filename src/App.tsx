import React, { useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Sidebar from './components/Sidebar';
import TopToolbar from './components/TopToolbar';
import BottomToolbar from './components/BottomToolbar';
import CanvasEngine from './canvas/CanvasEngine';
import PdfQuickViewer from './components/PdfQuickViewer';
import ColorPicker from './components/ColorPicker';
import PenSizeSelector from './components/PenSizeSelector';
import RecordingOverlay from './components/RecordingOverlay';
import PageThumbnailStrip from './components/PageThumbnailStrip';
import SplitView from './components/SplitView';
import { useAutoSave } from './hooks/useAutoSave';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useNoteStore } from './store/useNoteStore';
import { useAppStore } from './store/useAppStore';
import { saveNoteToFiles } from './export/ExportManager';

const App: React.FC = () => {
  const { activeNote } = useNoteStore();
  const { isDirty } = useNoteStore();
  const { pdfFocusMode, setPdfFocusMode, togglePdfFocusMode, toggleSidebar, sidebarOpen, toggleDarkMode, darkMode, showPageStrip } = useAppStore();

  const isFocusMode = pdfFocusMode && Boolean(activeNote);
  const isPdfViewerNote = Boolean(activeNote?.pdfId);
  const showDrawingUi = !isFocusMode && !isPdfViewerNote;

  useAutoSave();
  useKeyboardShortcuts();

  // Prevent default touch behaviors on iPad
  useEffect(() => {
    const prevent = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.pdf-native-viewer')) return;
      // Allow natural scrolling inside the continuous canvas scroll area
      if (target?.closest('.canvas-scroll')) return;
      if (target?.closest('.canvas-container')) {
        e.preventDefault();
      }
    };
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => document.removeEventListener('touchmove', prevent);
  }, []);

  // Handle clipboard paste for images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items || !activeNote) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const img = new Image();
            img.onload = () => {
              const maxW = 400;
              const scale = maxW / img.width;
              const imgEl = {
                id: uuidv4(),
                x: 100, y: 100,
                width: Math.min(img.width, maxW),
                height: img.width > maxW ? img.height * scale : img.height,
                src: dataUrl, rotation: 0, zIndex: 10,
              };
              useNoteStore.getState().addImageToActivePage(imgEl);
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(file);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeNote]);

  // Handle drag and drop for images
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!activeNote) return;

      const files = e.dataTransfer?.files;
      if (!files) return;

      for (const file of files) {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const img = new Image();
            img.onload = () => {
              const maxW = 400;
              const scale = maxW / img.width;
              const id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
              const imgEl = {
                id,
                x: 100, y: 100,
                width: Math.min(img.width, maxW),
                height: img.width > maxW ? img.height * scale : img.height,
                src: dataUrl, rotation: 0, zIndex: 10,
              };
              useNoteStore.getState().addImageToActivePage(imgEl);
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(file);
        }
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [activeNote]);

  // If there is no active note, leave focus mode.
  useEffect(() => {
    if (pdfFocusMode && !activeNote) {
      setPdfFocusMode(false);
    }
  }, [pdfFocusMode, activeNote, setPdfFocusMode]);

  return (
    <div className="flex h-full w-full overflow-hidden" style={{background: 'var(--color-bg)'}}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Top toolbar */}
        {showDrawingUi && <TopToolbar />}
        {!isFocusMode && isPdfViewerNote && (
          <div
            className="glass flex items-center gap-2 px-3 pb-2 border-b"
            style={{
              borderColor: 'var(--color-border)',
              paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)',
            }}
          >
            <button className="tool-btn" onClick={toggleSidebar} title={sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? 'M6 18L18 6M6 6l12 12' : 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5'} />
              </svg>
            </button>
            <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
              {activeNote?.title || 'PDF Viewer'}
            </div>
            <div className="flex-1" />
            <button
              className="tool-btn"
              onClick={() => {
                if (!activeNote) return;
                void saveNoteToFiles(activeNote);
              }}
              title="Save to Files (Audio Included)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3.75v10.5m0 0l3.75-3.75M12 14.25L8.25 10.5M3.75 16.5v1.875A1.875 1.875 0 005.625 20.25h12.75a1.875 1.875 0 001.875-1.875V16.5" />
              </svg>
            </button>
            <button
              className={`tool-btn ${pdfFocusMode ? 'active' : ''}`}
              onClick={togglePdfFocusMode}
              title={pdfFocusMode ? 'Exit Full Screen' : 'Full Screen'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d={
                    pdfFocusMode
                      ? 'M9 9H5.25V5.25M15 9h3.75V5.25M9 15H5.25v3.75M15 15h3.75v3.75'
                      : 'M4.5 9V4.5H9M19.5 9V4.5H15M4.5 15v4.5H9M19.5 15v4.5H15'
                  }
                />
              </svg>
            </button>
            <button className="tool-btn" onClick={toggleDarkMode} title={darkMode ? 'Light Mode' : 'Dark Mode'}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={darkMode ? 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z' : 'M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z'} />
              </svg>
            </button>
          </div>
        )}

        {/* Full-screen mode exit button */}
        {isFocusMode && (
          <button
            className="glass tool-btn absolute z-50"
            onClick={togglePdfFocusMode}
            title="Exit Full Screen"
            style={{
              top: 'calc(env(safe-area-inset-top) + 0.5rem)',
              right: '0.5rem',
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Canvas area with thumbnail strip */}
        <div
          className="flex-1 flex overflow-hidden relative"
          style={
            isFocusMode
              ? {
                  paddingTop: 'env(safe-area-inset-top)',
                  paddingBottom: 'env(safe-area-inset-bottom)',
                }
              : undefined
          }
        >
          {/* Page thumbnails */}
          {activeNote && showDrawingUi && showPageStrip && <PageThumbnailStrip />}

          {/* Canvas or PDF Viewer */}
          {isPdfViewerNote ? <PdfQuickViewer pdfId={activeNote?.pdfId} /> : <CanvasEngine />}

          {/* Color picker popup */}
          {showDrawingUi && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50">
              <ColorPicker />
            </div>
          )}

          {/* Pen size popup */}
          {showDrawingUi && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50">
              <PenSizeSelector />
            </div>
          )}
        </div>

        {/* Bottom toolbar */}
        {showDrawingUi && <BottomToolbar />}

        {/* Auto-save indicator */}
        {isDirty && (
          <div
            className="absolute right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium animate-fade-in"
            style={{
              background: 'var(--color-hover)',
              color: 'var(--color-text-secondary)',
              top: 'calc(env(safe-area-inset-top) + 3.5rem)',
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            Saving...
          </div>
        )}
      </div>

      {/* Overlays */}
      <RecordingOverlay />
      <SplitView />
    </div>
  );
};

export default App;
