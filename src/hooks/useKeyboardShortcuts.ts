import { useEffect } from 'react';
import { useNoteStore } from '../store/useNoteStore';

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const state = useNoteStore.getState();

      // Undo
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        state.undo();
        return;
      }
      // Redo
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        state.redo();
        return;
      }
      // Delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedStrokeIds.length > 0) {
        if (document.activeElement?.tagName !== 'INPUT' && !(document.activeElement as HTMLElement)?.isContentEditable) {
          e.preventDefault();
          const page = state.activeNote?.pages[state.activePageIndex];
          if (page) {
            const removed = page.strokes.filter(s => state.selectedStrokeIds.includes(s.id));
            state.removeStrokesFromActivePage(state.selectedStrokeIds);
            state.pushHistory({ type: 'stroke_remove', pageIndex: state.activePageIndex, data: removed, inverse: null });
            state.setSelectedStrokeIds([]);
          }
        }
        return;
      }

      // Tool shortcuts (only when not typing)
      if (!mod && document.activeElement?.tagName !== 'INPUT' && !(document.activeElement as HTMLElement)?.isContentEditable) {
        switch (e.key.toLowerCase()) {
          case 'p': state.setActiveTool('pen'); break;
          case 'h': state.setActiveTool('highlighter'); break;
          case 'e': state.setActiveTool('eraser'); break;
          case 'l': state.setActiveTool('lasso'); break;
          case 't': state.setActiveTool('text'); break;
          case 'v': state.setActiveTool('hand'); break;
          case 's': state.setActiveTool('shape'); break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
