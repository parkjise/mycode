import { useState, useCallback, useEffect } from 'react';
import { Category, Snippet } from '../types';
import {
  supabase,
  toDbSnippet,
  fromDbSnippet,
  toDbCategory,
  fromDbCategory,
} from '../lib/supabase';

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
  } catch { return fallback; }
}

function persist<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── Hook ────────────────────────────────────────────────────

export function useSnippets(userId: string | null) {
  const [categories, setCategories] = useState<Category[]>(() =>
    load<Category[]>(CATEGORIES_KEY, DEFAULT_CATEGORIES)
  );
  const [snippets, setSnippets] = useState<Snippet[]>(() =>
    load<Snippet[]>(SNIPPETS_KEY, [])
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // ─── 앱 시작 시 클라우드 데이터 로드 (로그인 여부 무관) ──────
  useEffect(() => {
    if (!supabase) return;
    const db = supabase;

    const loadFromCloud = async () => {
      setSyncing(true);
      try {
        // 로그인 상태: 내 스니펫만 / 비로그인: 전체 공개 스니펫
        const snippetQuery = userId
          ? db.from('snippets').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
          : db.from('snippets').select('*').order('updated_at', { ascending: false });

        const categoryQuery = userId
          ? db.from('categories').select('*').eq('user_id', userId)
          : db.from('categories').select('*');

        const [{ data: dbSnippets }, { data: dbCategories }] = await Promise.all([
          snippetQuery,
          categoryQuery,
        ]);

        if (dbSnippets && dbSnippets.length > 0) {
          const loaded = dbSnippets.map(fromDbSnippet);
          setSnippets(loaded);
          persist(SNIPPETS_KEY, loaded);
        }

        if (dbCategories && dbCategories.length > 0) {
          const loaded = dbCategories.map(fromDbCategory);
          setCategories(loaded);
          persist(CATEGORIES_KEY, loaded);
        }
      } catch (err) {
        console.error('Cloud sync failed, using local data:', err);
      } finally {
        setSyncing(false);
      }
    };

    loadFromCloud();
  }, [userId]);

  // ─── CRUD (로컬 + 클라우드 동기화) ───────────────────────────

  const saveSnippet = useCallback(async (snippet: Snippet) => {
    // 1. 로컬 즉시 반영
    setSnippets((prev) => {
      const exists = prev.some((s) => s.id === snippet.id);
      const next = exists
        ? prev.map((s) => (s.id === snippet.id ? snippet : s))
        : [snippet, ...prev];
      persist(SNIPPETS_KEY, next);
      return next;
    });
    setActiveId(snippet.id);

    // 2. 클라우드 동기화
    if (userId && supabase) {
      await supabase
        .from('snippets')
        .upsert(toDbSnippet(snippet, userId));
    }
  }, [userId]);

  const deleteSnippet = useCallback(async (id: string) => {
    setSnippets((prev) => {
      const next = prev.filter((s) => s.id !== id);
      persist(SNIPPETS_KEY, next);
      return next;
    });
    setActiveId((prev) => (prev === id ? null : prev));

    if (userId && supabase) {
      await supabase.from('snippets').delete().eq('id', id).eq('user_id', userId);
    }
  }, [userId]);

  const renameSnippet = useCallback(async (id: string, name: string) => {
    setSnippets((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, name, updatedAt: Date.now() } : s
      );
      persist(SNIPPETS_KEY, next);
      return next;
    });

    if (userId && supabase) {
      await supabase
        .from('snippets')
        .update({ name, updated_at: Date.now() })
        .eq('id', id)
        .eq('user_id', userId);
    }
  }, [userId]);

  const moveSnippet = useCallback(async (id: string, categoryId: string) => {
    setSnippets((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, categoryId, updatedAt: Date.now() } : s
      );
      persist(SNIPPETS_KEY, next);
      return next;
    });

    if (userId && supabase) {
      await supabase
        .from('snippets')
        .update({ category_id: categoryId, updated_at: Date.now() })
        .eq('id', id)
        .eq('user_id', userId);
    }
  }, [userId]);

  // ─── Categories ──────────────────────────────────────────────

  const addCategory = useCallback(async (name: string, color: string) => {
    const newCat: Category = { id: `cat-${Date.now()}`, name, color };
    setCategories((prev) => {
      const next = [...prev, newCat];
      persist(CATEGORIES_KEY, next);
      return next;
    });

    if (userId && supabase) {
      await supabase.from('categories').insert(toDbCategory(newCat, userId));
    }
    return newCat.id;
  }, [userId]);

  const renameCategory = useCallback(async (id: string, name: string) => {
    setCategories((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, name } : c));
      persist(CATEGORIES_KEY, next);
      return next;
    });

    if (userId && supabase) {
      await supabase
        .from('categories')
        .update({ name })
        .eq('id', id)
        .eq('user_id', userId);
    }
  }, [userId]);

  const deleteCategory = useCallback(async (id: string) => {
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

    if (userId && supabase) {
      await supabase
        .from('snippets')
        .update({ category_id: 'general' })
        .eq('category_id', id)
        .eq('user_id', userId);
      await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
    }
  }, [userId]);

  // ─── Export / Import ─────────────────────────────────────────

  const exportLibrary = useCallback(() => {
    const data = JSON.stringify({ categories, snippets }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snipshot-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [categories, snippets]);

  const importLibrary = useCallback(
    (file: File, mode: 'replace' | 'merge') => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string) as {
            categories: Category[];
            snippets: Snippet[];
          };
          if (!parsed.categories || !parsed.snippets) return;

          if (mode === 'replace') {
            setCategories(parsed.categories);
            setSnippets(parsed.snippets);
            persist(CATEGORIES_KEY, parsed.categories);
            persist(SNIPPETS_KEY, parsed.snippets);

            if (userId && supabase) {
              await supabase.from('snippets').delete().eq('user_id', userId);
              await supabase.from('categories').delete().eq('user_id', userId);
              await supabase.from('categories').insert(parsed.categories.map((c) => toDbCategory(c, userId)));
              await supabase.from('snippets').insert(parsed.snippets.map((s) => toDbSnippet(s, userId)));
            }
          } else {
            setCategories((prev) => {
              const ids = new Set(prev.map((c) => c.id));
              const next = [...prev, ...parsed.categories.filter((c) => !ids.has(c.id))];
              persist(CATEGORIES_KEY, next);
              return next;
            });
            setSnippets((prev) => {
              const ids = new Set(prev.map((s) => s.id));
              const newOnes = parsed.snippets.filter((s) => !ids.has(s.id));
              const next = [...newOnes, ...prev];
              persist(SNIPPETS_KEY, next);
              return next;
            });

            if (userId && supabase) {
              const existCatIds = new Set(categories.map((c) => c.id));
              const existSnipIds = new Set(snippets.map((s) => s.id));
              const newCats = parsed.categories.filter((c) => !existCatIds.has(c.id));
              const newSnips = parsed.snippets.filter((s) => !existSnipIds.has(s.id));
              if (newCats.length) await supabase.from('categories').insert(newCats.map((c) => toDbCategory(c, userId)));
              if (newSnips.length) await supabase.from('snippets').insert(newSnips.map((s) => toDbSnippet(s, userId)));
            }
          }
        } catch {
          alert('Invalid file format.');
        }
      };
      reader.readAsText(file);
    },
    [userId, categories, snippets]
  );

  return {
    categories,
    snippets,
    activeId,
    syncing,
    setActiveId,
    saveSnippet,
    deleteSnippet,
    renameSnippet,
    moveSnippet,
    addCategory,
    renameCategory,
    deleteCategory,
    exportLibrary,
    importLibrary,
  };
}
