import { useState, useCallback, useEffect, useRef } from 'react';
import { Note } from '../types';
import { supabase, toDbNote, fromDbNote } from '../lib/supabase';

const NOTES_KEY = 'snipshot:notes';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function persist<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function useNotes(userId: string | null, authReady: boolean) {
  const [notes, setNotes] = useState<Note[]>(() => load<Note[]>(NOTES_KEY, []));
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  const loadFromCloud = useCallback(async () => {
    if (!supabase) return;
    const uid = userIdRef.current;
    if (!uid) return; // guests use localStorage only
    const db = supabase;
    setSyncing(true);
    try {
      const { data, error } = await db
        .from('notes').select('*')
        .eq('user_id', uid)
        .order('updated_at', { ascending: false });
      if (error) { console.error('notes fetch error:', error); return; }
      if (data && data.length > 0) {
        const loaded = data.map(fromDbNote);
        setNotes(loaded);
        persist(NOTES_KEY, loaded);
      } else if (data && data.length === 0) {
        // cloud empty → upload local notes (first-time login sync)
        const localNotes = load<Note[]>(NOTES_KEY, []);
        if (localNotes.length > 0) {
          await Promise.all(localNotes.map((n) => db.from('notes').upsert(toDbNote(n, uid))));
        }
      }
    } catch (err) {
      console.error('Notes sync failed:', err);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase || !authReady) return;
    const db = supabase;
    loadFromCloud();
    const channel = db
      .channel(`notes-realtime-${userId ?? 'guest'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => { loadFromCloud(); })
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [userId, authReady, loadFromCloud]);

  const saveNote = useCallback(async (note: Note) => {
    setNotes((prev) => {
      const exists = prev.some((n) => n.id === note.id);
      const next = exists
        ? prev.map((n) => (n.id === note.id ? note : n))
        : [note, ...prev];
      persist(NOTES_KEY, next);
      return next;
    });
    setActiveNoteId(note.id);
    if (userId && supabase) {
      await supabase.from('notes').upsert(toDbNote(note, userId));
    }
  }, [userId]);

  const deleteNote = useCallback(async (id: string) => {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      persist(NOTES_KEY, next);
      return next;
    });
    setActiveNoteId((prev) => (prev === id ? null : prev));
    if (userId && supabase) {
      await supabase.from('notes').delete().eq('id', id).eq('user_id', userId);
    }
  }, [userId]);

  const createNote = useCallback((categoryId: string): Note => {
    return {
      id: `note-${Date.now()}`,
      title: '',
      content: '',
      categoryId,
      emoji: '📝',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }, []);

  return {
    notes,
    activeNoteId,
    syncing,
    setActiveNoteId,
    saveNote,
    deleteNote,
    createNote,
  };
}
