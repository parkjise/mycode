import { useState, useCallback, useEffect, useRef } from 'react';
import { Category, Note } from '../types';
import { supabase, toDbNote, fromDbNote, toDbCategory, fromDbCategory } from '../lib/supabase';

const NOTES_KEY = 'snipshot:notes';
const NOTE_CATEGORIES_KEY = 'snipshot:note-categories';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function persist<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const DEFAULT_NOTE_CATEGORIES: Category[] = [
  { id: 'note-general', name: 'General',  color: '#8888a8', order: 0 },
  { id: 'note-work',    name: 'Work',     color: '#3178c6', order: 1 },
  { id: 'note-personal',name: 'Personal', color: '#10b981', order: 2 },
  { id: 'note-ideas',   name: 'Ideas',    color: '#f59e0b', order: 3 },
];

export function useNotes(userId: string | null, authReady: boolean) {
  const [notes, setNotes] = useState<Note[]>(() => load<Note[]>(NOTES_KEY, []));
  const [noteCategories, setNoteCategories] = useState<Category[]>(() => {
    const loaded = load<Category[]>(NOTE_CATEGORIES_KEY, DEFAULT_NOTE_CATEGORIES);
    return loaded.map((c, i) => ({ ...c, order: c.order ?? i }));
  });
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  const loadFromCloud = useCallback(async () => {
    if (!supabase) return;
    const uid = userIdRef.current;
    if (!uid) return;
    const db = supabase;
    setSyncing(true);
    try {
      const [{ data: notesData, error: nErr }, { data: catsData, error: cErr }] = await Promise.all([
        db.from('notes').select('*').eq('user_id', uid).order('updated_at', { ascending: false }),
        db.from('categories').select('*').eq('user_id', uid).eq('type', 'note'),
      ]);

      if (nErr) console.error('notes fetch error:', nErr);
      if (cErr) console.error('note categories fetch error:', cErr);

      if (notesData && notesData.length > 0) {
        const loaded = notesData.map(fromDbNote);
        setNotes(loaded);
        persist(NOTES_KEY, loaded);
      } else if (notesData && notesData.length === 0) {
        const localNotes = load<Note[]>(NOTES_KEY, []);
        if (localNotes.length > 0) {
          await Promise.all(localNotes.map((n) => db.from('notes').upsert(toDbNote(n, uid))));
        }
      }

      if (catsData && catsData.length > 0) {
        const loaded = catsData.map((d, i) => fromDbCategory(d, i));
        setNoteCategories(loaded);
        persist(NOTE_CATEGORIES_KEY, loaded);
      } else if (catsData && catsData.length === 0) {
        const localCats = load<Category[]>(NOTE_CATEGORIES_KEY, DEFAULT_NOTE_CATEGORIES);
        if (localCats.length > 0) {
          await Promise.all(localCats.map((c) => db.from('categories').upsert(toDbCategory(c, uid, 'note'))));
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => { loadFromCloud(); })
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [userId, authReady, loadFromCloud]);

  // ─── Notes CRUD ──────────────────────────────────────────────

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

  // ─── Note Categories CRUD ────────────────────────────────────

  const addNoteCategory = useCallback(async (name: string, color: string, parentId?: string) => {
    const maxOrder = noteCategories.reduce((max, c) => Math.max(max, c.order ?? 0), -1);
    const newCat: Category = { id: `note-cat-${Date.now()}`, name, color, parentId, order: maxOrder + 1 };
    setNoteCategories((prev) => {
      const next = [...prev, newCat];
      persist(NOTE_CATEGORIES_KEY, next);
      return next;
    });
    if (userId && supabase) {
      await supabase.from('categories').insert(toDbCategory(newCat, userId, 'note'));
    }
    return newCat.id;
  }, [userId, noteCategories]);

  const renameNoteCategory = useCallback(async (id: string, name: string) => {
    setNoteCategories((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, name } : c));
      persist(NOTE_CATEGORIES_KEY, next);
      return next;
    });
    if (userId && supabase) {
      await supabase.from('categories').update({ name }).eq('id', id).eq('user_id', userId);
    }
  }, [userId]);

  const deleteNoteCategory = useCallback(async (id: string) => {
    setNotes((prev) => {
      const next = prev.map((n) => n.categoryId === id ? { ...n, categoryId: 'note-general' } : n);
      persist(NOTES_KEY, next);
      return next;
    });
    setNoteCategories((prev) => {
      const deleted = prev.find((c) => c.id === id);
      const next = prev
        .filter((c) => c.id !== id)
        .map((c) => c.parentId === id ? { ...c, parentId: deleted?.parentId } : c);
      persist(NOTE_CATEGORIES_KEY, next);
      return next;
    });
    if (userId && supabase) {
      await supabase.from('notes').update({ category_id: 'note-general' }).eq('category_id', id).eq('user_id', userId);
      await supabase.from('categories').delete().eq('id', id).eq('user_id', userId);
    }
  }, [userId]);

  const changeNoteCategoryColor = useCallback(async (id: string, color: string) => {
    setNoteCategories((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, color } : c));
      persist(NOTE_CATEGORIES_KEY, next);
      return next;
    });
    if (userId && supabase) {
      await supabase.from('categories').update({ color }).eq('id', id).eq('user_id', userId);
    }
  }, [userId]);

  const moveNoteCategoryUp = useCallback(async (id: string) => {
    const cat = noteCategories.find((c) => c.id === id);
    if (!cat) return;
    const siblings = noteCategories
      .filter((c) => (c.parentId ?? null) === (cat.parentId ?? null))
      .sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex((c) => c.id === id);
    if (idx === 0) return;
    const prev = siblings[idx - 1];
    const newCats = noteCategories.map((c) => {
      if (c.id === id) return { ...c, order: prev.order };
      if (c.id === prev.id) return { ...c, order: cat.order };
      return c;
    });
    setNoteCategories(newCats);
    persist(NOTE_CATEGORIES_KEY, newCats);
    if (userId && supabase) {
      await Promise.all([
        supabase.from('categories').update({ order: prev.order }).eq('id', id).eq('user_id', userId),
        supabase.from('categories').update({ order: cat.order }).eq('id', prev.id).eq('user_id', userId),
      ]);
    }
  }, [noteCategories, userId]);

  const moveNoteCategoryDown = useCallback(async (id: string) => {
    const cat = noteCategories.find((c) => c.id === id);
    if (!cat) return;
    const siblings = noteCategories
      .filter((c) => (c.parentId ?? null) === (cat.parentId ?? null))
      .sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex((c) => c.id === id);
    if (idx === siblings.length - 1) return;
    const next = siblings[idx + 1];
    const newCats = noteCategories.map((c) => {
      if (c.id === id) return { ...c, order: next.order };
      if (c.id === next.id) return { ...c, order: cat.order };
      return c;
    });
    setNoteCategories(newCats);
    persist(NOTE_CATEGORIES_KEY, newCats);
    if (userId && supabase) {
      await Promise.all([
        supabase.from('categories').update({ order: next.order }).eq('id', id).eq('user_id', userId),
        supabase.from('categories').update({ order: cat.order }).eq('id', next.id).eq('user_id', userId),
      ]);
    }
  }, [noteCategories, userId]);

  return {
    notes,
    noteCategories,
    activeNoteId,
    syncing,
    setActiveNoteId,
    saveNote,
    deleteNote,
    createNote,
    addNoteCategory,
    renameNoteCategory,
    deleteNoteCategory,
    changeNoteCategoryColor,
    moveNoteCategoryUp,
    moveNoteCategoryDown,
  };
}
