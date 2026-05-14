import { openDB, type IDBPDatabase } from 'idb';
import type { Note, Folder, AudioRecording, PDFDocument } from '../types';

const DB_NAME = 'notepadpro_db';
const DB_VERSION = 1;

interface NotepadDB {
  notes: { key: string; value: Note };
  folders: { key: string; value: Folder };
  audios: { key: string; value: AudioRecording };
  pdfs: { key: string; value: PDFDocument };
}

let dbInstance: IDBPDatabase<NotepadDB> | null = null;

async function getDB(): Promise<IDBPDatabase<NotepadDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<NotepadDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('audios')) {
        db.createObjectStore('audios', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pdfs')) {
        db.createObjectStore('pdfs', { keyPath: 'id' });
      }
    },
  });

  return dbInstance;
}

/* ─── Notes ─────────────────────────────────────────────────── */
export async function getAllNotes(): Promise<Note[]> {
  const db = await getDB();
  const notes = await db.getAll('notes');
  return notes.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getNote(id: string): Promise<Note | undefined> {
  const db = await getDB();
  return db.get('notes', id);
}

export async function saveNote(note: Note): Promise<void> {
  const db = await getDB();
  await db.put('notes', note);
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('notes', id);
  // Also delete associated audio recordings
  const audios = await db.getAll('audios');
  for (const audio of audios) {
    if (audio.noteId === id) {
      await db.delete('audios', audio.id);
    }
  }
}

/* ─── Folders ───────────────────────────────────────────────── */
export async function getAllFolders(): Promise<Folder[]> {
  const db = await getDB();
  return db.getAll('folders');
}

export async function saveFolder(folder: Folder): Promise<void> {
  const db = await getDB();
  await db.put('folders', folder);
}

export async function deleteFolder(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('folders', id);
}

/* ─── Audio Recordings ──────────────────────────────────────── */
export async function getAllAudios(): Promise<AudioRecording[]> {
  const db = await getDB();
  return db.getAll('audios');
}

export async function getAudiosForNote(noteId: string): Promise<AudioRecording[]> {
  const db = await getDB();
  const all = await db.getAll('audios');
  return all.filter((a) => a.noteId === noteId);
}

export async function saveAudio(audio: AudioRecording): Promise<void> {
  const db = await getDB();
  await db.put('audios', audio);
}

export async function deleteAudio(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('audios', id);
}

export async function getAudio(id: string): Promise<AudioRecording | undefined> {
  const db = await getDB();
  return db.get('audios', id);
}

/* ─── PDFs ──────────────────────────────────────────────────── */
export async function getAllPDFs(): Promise<PDFDocument[]> {
  const db = await getDB();
  const pdfs = await db.getAll('pdfs');
  return pdfs.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getPDF(id: string): Promise<PDFDocument | undefined> {
  const db = await getDB();
  return db.get('pdfs', id);
}

export async function savePDF(pdf: PDFDocument): Promise<void> {
  const db = await getDB();
  await db.put('pdfs', pdf);
}

export async function deletePDF(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pdfs', id);
}
