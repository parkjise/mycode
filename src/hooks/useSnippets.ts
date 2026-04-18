import { useState, useCallback } from 'react';
import { Category, Snippet } from '../types';

const SNIPPETS_KEY = 'snipshot:snippets';
const CATEGORIES_KEY = 'snipshot:categories';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'general',    name: 'General',      color: '#8888a8' },
  { id: 'javascript', name: 'JavaScript',   color: '#f7df1e' },
  { id: 'typescript', name: 'TypeScript',   color: '#3178c6' },
  { id: 'react',      name: 'React',        color: '#61dafb' },
  { id: 'css',        name: 'CSS / Styles', color: '#ff7262' },
];

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function persist<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function useSnippets() {
  const [categories, setCategories] = useState<Category[]>(() =>
    load<Category[]>(CATEGORIES_KEY, DEFAULT_CATEGORIES)
  );

  const [snippets, setSnippets] = useState<Snippet[]>(() =>
    load<Snippet[]>(SNIPPETS_KEY, [])
  );

  const [activeId, setActiveId] = useState<string | null>(null);

  // ─── CRUD ──────────────────────────────────────────────────

  const saveSnippet = useCallback((snippet: Snippet) => {
    setSnippets((prev) => {
      const exists = prev.some((s) => s.id === snippet.id);
      const next = exists
        ? prev.map((s) => (s.id === snippet.id ? snippet : s))
        : [snippet, ...prev];
      persist(SNIPPETS_KEY, next);
      return next;
    });
    setActiveId(snippet.id);
  }, []);

  const deleteSnippet = useCallback((id: string) => {
    setSnippets((prev) => {
      const next = prev.filter((s) => s.id !== id);
      persist(SNIPPETS_KEY, next);
      return next;
    });
    setActiveId((prev) => (prev === id ? null : prev));
  }, []);

  const renameSnippet = useCallback((id: string, name: string) => {
    setSnippets((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, name, updatedAt: Date.now() } : s
      );
      persist(SNIPPETS_KEY, next);
      return next;
    });
  }, []);

  const moveSnippet = useCallback((id: string, categoryId: string) => {
    setSnippets((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, categoryId, updatedAt: Date.now() } : s
      );
      persist(SNIPPETS_KEY, next);
      return next;
    });
  }, []);

  // ─── Categories ─────────────────────────────────────────────

  const addCategory = useCallback((name: string, color: string) => {
    const newCat: Category = { id: `cat-${Date.now()}`, name, color };
    setCategories((prev) => {
      const next = [...prev, newCat];
      persist(CATEGORIES_KEY, next);
      return next;
    });
    return newCat.id;
  }, []);

  const renameCategory = useCallback((id: string, name: string) => {
    setCategories((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, name } : c));
      persist(CATEGORIES_KEY, next);
      return next;
    });
  }, []);

  const deleteCategory = useCallback((id: string) => {
    // Move orphaned snippets to 'general'
    setSnippets((prev) => {
      const next = prev.map((s) =>
        s.categoryId === id ? { ...s, categoryId: 'general' } : s
      );
      persist(SNIPPETS_KEY, next);
      return next;
    });
    setCategories((prev) => {
      const next = prev.filter((c) => c.id !== id);
      persist(CATEGORIES_KEY, next);
      return next;
    });
  }, []);

  return {
    categories,
    snippets,
    activeId,
    setActiveId,
    saveSnippet,
    deleteSnippet,
    renameSnippet,
    moveSnippet,
    addCategory,
    renameCategory,
    deleteCategory,
  };
}
