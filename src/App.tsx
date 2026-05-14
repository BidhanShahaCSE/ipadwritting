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

const App: React.FC = () => {
  const { activeNote } = useNoteStore();
  const { isDirty } = useNoteStore();

  useAutoSave();
  useKeyboardShortcuts();

  // Prevent default touch behaviors on iPad
  useEffect(() => {
    const prevent = (e: TouchEvent) => {
      if ((e.target as HTMLElement)?.closest('.canvas-container')) {
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

  return (
    <div className="flex h-full w-full overflow-hidden" style={{background: 'var(--color-bg)'}}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Top toolbar */}
        <TopToolbar />

        {/* Canvas area with thumbnail strip */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Page thumbnails */}
          {activeNote && <PageThumbnailStrip />}

          {/* Canvas */}
          <CanvasEngine />

          {/* Color picker popup */}
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50">
            <ColorPicker />
          </div>

          {/* Pen size popup */}
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50">
            <PenSizeSelector />
          </div>
        </div>

        {/* Bottom toolbar */}
        <BottomToolbar />

        {/* Auto-save indicator */}
        {isDirty && (
          <div className="absolute top-14 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium animate-fade-in"
            style={{background: 'var(--color-hover)', color: 'var(--color-text-secondary)'}}>
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
