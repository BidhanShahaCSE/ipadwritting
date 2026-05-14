import React, { useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Sidebar from './components/Sidebar';
import TopToolbar from './components/TopToolbar';
import BottomToolbar from './components/BottomToolbar';
import CanvasEngine from './canvas/CanvasEngine';
import ColorPicker from './components/ColorPicker';
import PenSizeSelector from './components/PenSizeSelector';
import RecordingOverlay from './components/RecordingOverlay';
import PageThumbnailStrip from './components/PageThumbnailStrip';
import SplitView from './components/SplitView';
import { useAutoSave } from './hooks/useAutoSave';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useNoteStore } from './store/useNoteStore';
import { useAppStore } from './store/useAppStore';

const App: React.FC = () => {
  const { activeNote } = useNoteStore();
  const { isDirty } = useNoteStore();
  const { pdfFocusMode, setPdfFocusMode, togglePdfFocusMode } = useAppStore();

  const isFocusMode = pdfFocusMode && Boolean(activeNote);

  useAutoSave();
  useKeyboardShortcuts();

  // Prevent default touch behaviors on iPad
  useEffect(() => {
    const prevent = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
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
        {!isFocusMode && <TopToolbar />}

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
          {activeNote && !isFocusMode && <PageThumbnailStrip />}

          {/* Canvas */}
          <CanvasEngine />

          {/* Color picker popup */}
          {!isFocusMode && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50">
              <ColorPicker />
            </div>
          )}

          {/* Pen size popup */}
          {!isFocusMode && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50">
              <PenSizeSelector />
            </div>
          )}
        </div>

        {/* Bottom toolbar */}
        {!isFocusMode && <BottomToolbar />}

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
