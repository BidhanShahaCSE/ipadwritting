import React, { useState, useRef, useEffect } from 'react';
import { useNoteStore, createNewNote } from '../store/useNoteStore';
import { useAppStore } from '../store/useAppStore';
import { saveNote, deleteNote as dbDeleteNote, getAllNotes, getAllPDFs, savePDF, deletePDF as dbDeletePDF, saveFolder, deleteFolder as dbDeleteFolder, getAllFolders } from '../db/database';
import { readFileAsArrayBuffer } from '../utils/helpers';
import { formatRelativeDate } from '../utils/helpers';
import type { PDFDocument, Note } from '../types';
import { v4 as uuid } from 'uuid';

interface ContextMenu {
  x: number;
  y: number;
  noteId: string;
}

const Sidebar: React.FC = () => {
  const { activeNote, setActiveNote } = useNoteStore();
  const {
    sidebarOpen, notes, setNotes, addNote, removeNote, updateNote,
    searchQuery, setSearchQuery, sidebarTab, setSidebarTab,
    pdfs, setPdfs, addPdf, removePdf, folders, setFolders, addFolder, updateFolder, removeFolder,
    selectedFolderId, setSelectedFolderId,
  } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Load data on mount
  useEffect(() => {
    getAllNotes().then(setNotes);
    getAllPDFs().then(list => setPdfs(list as PDFDocument[]));
    getAllFolders().then(setFolders);
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [contextMenu]);

  const handleNewNote = async () => {
    const note = createNewNote();
    if (selectedFolderId) note.folderId = selectedFolderId;
    await saveNote(note);
    addNote(note);
    setActiveNote(note);
  };

  const handleSelectNote = (note: Note) => setActiveNote(note);

  const handleDeleteNote = async (id: string) => {
    await dbDeleteNote(id);
    removeNote(id);
    if (activeNote?.id === id) setActiveNote(null);
    setContextMenu(null);
  };

  const handleDeletePdf = async (id: string) => {
    await dbDeletePDF(id);
    removePdf(id);

    const linkedNotes = notes.filter((n) => n.pdfId === id);
    for (const note of linkedNotes) {
      await dbDeleteNote(note.id);
      removeNote(note.id);
    }

    if (activeNote && (activeNote.pdfId === id || linkedNotes.some((n) => n.id === activeNote.id))) {
      setActiveNote(null);
    }
  };

  const handleClearAllPdfs = async () => {
    if (pdfs.length === 0) return;
    const ok = window.confirm(`Clear all ${pdfs.length} PDFs? Linked PDF notes will also be removed.`);
    if (!ok) return;
    for (const pdf of pdfs) {
      await handleDeletePdf(pdf.id);
    }
  };

  const handleRename = async (id: string) => {
    if (!editTitle.trim()) { setEditingId(null); return; }
    const note = notes.find(n => n.id === id);
    if (note) {
      const updated = { ...note, title: editTitle, updatedAt: Date.now() };
      await saveNote(updated);
      updateNote(updated);
      if (activeNote?.id === id) useNoteStore.getState().updateNoteTitle(editTitle);
    }
    setEditingId(null);
  };

  const handleDuplicate = async (id: string) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    const dup: Note = {
      ...JSON.parse(JSON.stringify(note)),
      id: uuid(),
      title: `${note.title} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    // Give new IDs to all pages
    dup.pages = dup.pages.map((p: Note['pages'][0]) => ({ ...p, id: uuid() }));
    await saveNote(dup);
    addNote(dup);
    setContextMenu(null);
  };

  const handleMoveToFolder = async (noteId: string, folderId: string | null) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    const updated = { ...note, folderId, updatedAt: Date.now() };
    await saveNote(updated);
    updateNote(updated);
    if (activeNote?.id === noteId) {
      useNoteStore.getState().setActiveNote(updated);
    }
    setContextMenu(null);
  };

  const handleOpenPDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await readFileAsArrayBuffer(file);
    const pdf: PDFDocument = {
      id: uuid(), title: file.name.replace('.pdf', ''), data,
      pageCount: 0, annotations: {}, createdAt: Date.now(), updatedAt: Date.now(),
    };
    addPdf(pdf);
    await savePDF(pdf);
    e.target.value = '';
    try {
      const { loadPdfDocument, renderPdfPageToCanvas } = await import('../pdf/PdfEngine');
      const pdfDoc = await loadPdfDocument(pdf.id, data);
      const pageCount = pdfDoc.numPages;

      // Keep the persisted PDF record up to date.
      await savePDF({ ...pdf, pageCount, updatedAt: Date.now() });
      const pages = [];
      for (let i = 0; i < pageCount; i++) {
        const page = await pdfDoc.getPage(i + 1);
        const viewport = page.getViewport({ scale: 1.0 });
        pages.push({
          id: uuid(), background: 'blank' as const, pageSize: 'custom' as const,
          customWidth: Math.max(1, Math.round(viewport.width)),
          customHeight: Math.max(1, Math.round(viewport.height)),
          pdfPageIndex: i,
          strokes: [], textBoxes: [], images: [], audioIds: [],
        });
      }
      let thumbnail: string | undefined;
      const previewCanvas = await renderPdfPageToCanvas(pdf.id, 0, data, 1);
      if (previewCanvas) {
        const thumbCanvas = document.createElement('canvas');
        const maxW = 200;
        const scale = maxW / previewCanvas.width;
        thumbCanvas.width = maxW;
        thumbCanvas.height = Math.max(1, Math.round(previewCanvas.height * scale));
        const tctx = thumbCanvas.getContext('2d');
        if (tctx) {
          tctx.drawImage(previewCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
          thumbnail = thumbCanvas.toDataURL('image/webp', 0.7);
        }
      }

      const note = { id: uuid(), title: pdf.title, folderId: null, pages, pdfId: pdf.id, thumbnail, createdAt: Date.now(), updatedAt: Date.now() };
      await saveNote(note);
      addNote(note);
      setActiveNote(note);
    } catch (err) { console.error('Failed to parse PDF', err); }
  };

  const handleNewFolder = async () => {
    const folder = { id: uuid(), name: 'New Folder', parentId: null, createdAt: Date.now(), color: '#007AFF' };
    await saveFolder(folder);
    addFolder(folder);
    setEditingFolderId(folder.id);
    setEditFolderName(folder.name);
  };

  const handleRenameFolder = async (id: string) => {
    if (!editFolderName.trim()) { setEditingFolderId(null); return; }
    const folder = folders.find(f => f.id === id);
    if (folder) {
      const updated = { ...folder, name: editFolderName };
      await saveFolder(updated);
      updateFolder(updated);
    }
    setEditingFolderId(null);
  };

  const handleDeleteFolder = async (id: string) => {
    await dbDeleteFolder(id);
    removeFolder(id);
    // Unassign notes from this folder
    for (const note of notes.filter(n => n.folderId === id)) {
      const updated = { ...note, folderId: null };
      await saveNote(updated);
      updateNote(updated);
    }
  };

  const filteredNotes = notes.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder = selectedFolderId ? n.folderId === selectedFolderId : true;
    return matchesSearch && matchesFolder;
  });

  if (!sidebarOpen) return null;

  return (
    <div className="flex flex-col h-full sidebar-transition animate-slide-in" style={{width: 280, background: 'var(--color-sidebar)', borderRight: '1px solid var(--color-border)'}}>
      {/* Header */}
      <div className="p-4 pb-2">
        <h1 className="text-xl font-bold mb-3" style={{color: 'var(--color-text)'}}>
          <span style={{color: 'var(--color-accent)'}}>MY</span>NOTE
        </h1>
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" fill="none" stroke="var(--color-text-secondary)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input type="search" placeholder="Search notes..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="sidebar-search-input" />
        </div>
        <div className="flex gap-1 rounded-xl p-1" style={{background: 'var(--color-hover)'}}>
          {(['notes', 'pdfs', 'folders'] as const).map(tab => (
            <button key={tab} onClick={() => setSidebarTab(tab)}
              className="flex-1 py-1.5 text-xs font-medium rounded-lg transition-all capitalize"
              style={{ background: sidebarTab === tab ? 'var(--color-bg)' : 'transparent', color: sidebarTab === tab ? 'var(--color-accent)' : 'var(--color-text-secondary)', boxShadow: sidebarTab === tab ? 'var(--shadow-card)' : 'none' }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Folder filter bar */}
      {sidebarTab === 'notes' && selectedFolderId && (
        <div className="mx-3 mb-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs" style={{background: 'var(--color-active)', color: 'var(--color-accent)'}}>
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15z"/></svg>
          <span className="font-medium truncate">{folders.find(f => f.id === selectedFolderId)?.name}</span>
          <button onClick={() => setSelectedFolderId(null)} className="ml-auto" style={{color: 'var(--color-text-secondary)'}}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {sidebarTab === 'notes' && filteredNotes.map(note => (
          <div key={note.id}
            className={`note-card group ${activeNote?.id === note.id ? 'selected' : ''}`}
            onClick={() => handleSelectNote(note)}
            onDoubleClick={() => { setEditingId(note.id); setEditTitle(note.title); }}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, noteId: note.id }); }}
          >
            <div className="flex gap-2.5">
              {/* Thumbnail */}
              {note.thumbnail ? (
                <div className="note-thumbnail"><img src={note.thumbnail} alt="" /></div>
              ) : (
                <div className="note-thumbnail flex items-center justify-center">
                  <svg className="w-5 h-5 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                {editingId === note.id ? (
                  <input autoFocus type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    onBlur={() => handleRename(note.id)} onKeyDown={e => e.key === 'Enter' && handleRename(note.id)}
                    className="text-sm font-medium" onClick={e => e.stopPropagation()} />
                ) : (
                  <>
                    <div className="text-sm font-medium truncate" style={{color: 'var(--color-text)'}}>{note.title}</div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs" style={{color: 'var(--color-text-secondary)'}}>{formatRelativeDate(note.updatedAt)}</span>
                      <span className="text-xs" style={{color: 'var(--color-text-secondary)'}}>{note.pages.length} pg</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            {/* Quick delete */}
            <button className="note-actions absolute top-2 right-2"
              onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
              style={{color: 'var(--color-text-secondary)'}}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        {sidebarTab === 'pdfs' && (
          <>
            {pdfs.length > 0 && (
              <div className="px-1 pb-1">
                <button
                  onClick={handleClearAllPdfs}
                  className="w-full text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: 'rgba(255, 59, 48, 0.12)', color: 'var(--color-danger)' }}
                >
                  Clear All PDFs
                </button>
              </div>
            )}
            {pdfs.map(pdf => {
              const linkedNote = notes.find(n => n.pdfId === pdf.id);
              return (
                <div key={pdf.id} className={`note-card relative ${activeNote?.pdfId === pdf.id ? 'selected' : ''}`}
                  onClick={() => { if (linkedNote) setActiveNote(linkedNote); }}>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="#FF3B30" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
                    </svg>
                    <span className="text-sm font-medium truncate pr-7" style={{color: 'var(--color-text)'}}>{pdf.title}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeletePdf(pdf.id); }}
                    className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-md"
                    style={{ color: 'var(--color-text-secondary)', background: 'var(--color-hover)' }}
                    title="Clear PDF"
                    aria-label={`Clear ${pdf.title}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </>
        )}

        {sidebarTab === 'folders' && (
          <>
            {/* All Notes pseudo-folder */}
            <div className={`folder-item ${!selectedFolderId ? 'selected' : ''}`}
              onClick={() => { setSelectedFolderId(null); setSidebarTab('notes'); }}>
              <svg className="w-5 h-5" fill="var(--color-text-secondary)" viewBox="0 0 24 24">
                <path d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"/>
              </svg>
              <span className="text-sm font-medium" style={{color: 'var(--color-text)'}}>All Notes</span>
              <span className="ml-auto text-xs" style={{color: 'var(--color-text-secondary)'}}>{notes.length}</span>
            </div>
            {folders.map(f => (
              <div key={f.id} className={`folder-item group ${selectedFolderId === f.id ? 'selected' : ''}`}
                onClick={() => { setSelectedFolderId(f.id); setSidebarTab('notes'); }}
                onDoubleClick={() => { setEditingFolderId(f.id); setEditFolderName(f.name); }}>
                <svg className="w-5 h-5" fill={f.color} viewBox="0 0 24 24">
                  <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z"/>
                </svg>
                {editingFolderId === f.id ? (
                  <input autoFocus type="text" value={editFolderName} onChange={e => setEditFolderName(e.target.value)}
                    onBlur={() => handleRenameFolder(f.id)} onKeyDown={e => e.key === 'Enter' && handleRenameFolder(f.id)}
                    className="text-sm font-medium flex-1" onClick={e => e.stopPropagation()} />
                ) : (
                  <span className="text-sm font-medium flex-1 truncate" style={{color: 'var(--color-text)'}}>{f.name}</span>
                )}
                <span className="text-xs" style={{color: 'var(--color-text-secondary)'}}>{notes.filter(n => n.folderId === f.id).length}</span>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                  onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f.id); }}
                  style={{color: 'var(--color-text-secondary)'}}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Bottom actions */}
      <div className="p-3 border-t flex gap-2" style={{borderColor: 'var(--color-border)'}}>
        <button onClick={handleNewNote}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95"
          style={{background: 'var(--color-accent)', color: 'white'}}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Note
        </button>
        <button onClick={() => pdfInputRef.current?.click()}
          className="flex items-center justify-center w-10 h-10 rounded-xl transition-all active:scale-95"
          style={{background: 'var(--color-hover)', color: 'var(--color-text)'}} title="Open PDF">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </button>
        <button onClick={handleNewFolder}
          className="flex items-center justify-center w-10 h-10 rounded-xl transition-all active:scale-95"
          style={{background: 'var(--color-hover)', color: 'var(--color-text)'}} title="New Folder">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
        </button>
        <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handleOpenPDF} />
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={e => e.stopPropagation()}>
          <div className="context-menu-item" onClick={() => { setEditingId(contextMenu.noteId); setEditTitle(notes.find(n => n.id === contextMenu.noteId)?.title || ''); setContextMenu(null); }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z"/></svg>
            Rename
          </div>
          <div className="context-menu-item" onClick={() => handleDuplicate(contextMenu.noteId)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"/></svg>
            Duplicate
          </div>
          {folders.length > 0 && (
            <>
              <div className="context-menu-separator" />
              {folders.map(f => (
                <div key={f.id} className="context-menu-item" onClick={() => handleMoveToFolder(contextMenu.noteId, f.id)}>
                  <svg className="w-4 h-4" fill={f.color} viewBox="0 0 24 24"><path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15z"/></svg>
                  Move to {f.name}
                </div>
              ))}
              {notes.find(n => n.id === contextMenu.noteId)?.folderId && (
                <div className="context-menu-item" onClick={() => handleMoveToFolder(contextMenu.noteId, null)}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/></svg>
                  Remove from folder
                </div>
              )}
            </>
          )}
          <div className="context-menu-separator" />
          <div className="context-menu-item danger" onClick={() => handleDeleteNote(contextMenu.noteId)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
            Delete
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
