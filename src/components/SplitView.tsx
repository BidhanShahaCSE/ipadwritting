import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { useNoteStore } from '../store/useNoteStore';
import { exportNoteToPDF, saveNoteToFiles, shareNote } from '../export/ExportManager';

const SplitView: React.FC = () => {
  const { showSplitView, setShowSplitView, notes } = useAppStore();
  const { activeNote } = useNoteStore();

  if (!showSplitView) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center" style={{background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)'}}>
      <div className="frosted-popup p-6 animate-scale-in" style={{width: '90%', maxWidth: 600, maxHeight: '80vh'}}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{color: 'var(--color-text)'}}>Open Another Note</h2>
          <button onClick={() => setShowSplitView(false)} className="tool-btn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Actions for current note */}
        {activeNote && (
          <div className="mb-4 p-3 rounded-xl" style={{background: 'var(--color-hover)'}}>
            <p className="text-sm font-medium mb-2" style={{color: 'var(--color-text)'}}>Current: {activeNote.title}</p>
            <div className="flex gap-2">
              <button
                onClick={() => { exportNoteToPDF(activeNote); setShowSplitView(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{background: 'var(--color-accent)', color: 'white'}}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export PDF
              </button>
              <button
                onClick={() => { saveNoteToFiles(activeNote); setShowSplitView(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{background: '#0A7CFF', color: 'white'}}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3.75v10.5m0 0l3.75-3.75M12 14.25L8.25 10.5M3.75 16.5v1.875A1.875 1.875 0 005.625 20.25h12.75a1.875 1.875 0 001.875-1.875V16.5" />
                </svg>
                Save to Files
              </button>
              <button
                onClick={() => { shareNote(activeNote); setShowSplitView(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{background: 'var(--color-hover)', color: 'var(--color-text)'}}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
                Share
              </button>
            </div>
          </div>
        )}

        {/* Note list */}
        <div className="overflow-y-auto" style={{maxHeight: 300}}>
          <p className="text-xs font-medium mb-2" style={{color: 'var(--color-text-secondary)'}}>All Notes</p>
          {notes.filter(n => n.id !== activeNote?.id).map(note => (
            <button
              key={note.id}
              onClick={() => {
                useNoteStore.getState().setActiveNote(note);
                setShowSplitView(false);
              }}
              className="w-full text-left p-3 rounded-xl mb-1 transition-colors"
              style={{color: 'var(--color-text)'}}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div className="text-sm font-medium">{note.title}</div>
              <div className="text-xs mt-0.5" style={{color: 'var(--color-text-secondary)'}}>{note.pages.length} pages</div>
            </button>
          ))}
          {notes.filter(n => n.id !== activeNote?.id).length === 0 && (
            <p className="text-sm text-center py-8" style={{color: 'var(--color-text-secondary)'}}>No other notes yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SplitView;
