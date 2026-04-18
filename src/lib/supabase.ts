import { createClient } from '@supabase/supabase-js';
import { Category, Snippet } from '../types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = url && key ? createClient(url, key) : null;
export const cloudEnabled = Boolean(supabase);

// ─── DB ↔ App 타입 변환 ────────────────────────────────────────

interface DbSnippet {
  id: string;
  user_id: string;
  name: string;
  category_id: string;
  code: string;
  language: string;
  file_name: string;
  theme: string;
  font_size: number;
  padding: number;
  background_style: string;
  card_width: number;
  created_at: number;
  updated_at: number;
}

interface DbCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
}

export function toDbSnippet(s: Snippet, userId: string): DbSnippet {
  return {
    id: s.id,
    user_id: userId,
    name: s.name,
    category_id: s.categoryId,
    code: s.code,
    language: s.language,
    file_name: s.fileName,
    theme: s.theme,
    font_size: s.fontSize,
    padding: s.padding,
    background_style: s.backgroundStyle,
    card_width: s.cardWidth,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
}

export function fromDbSnippet(d: DbSnippet): Snippet {
  return {
    id: d.id,
    name: d.name,
    categoryId: d.category_id,
    code: d.code,
    language: d.language as Snippet['language'],
    fileName: d.file_name,
    theme: d.theme as Snippet['theme'],
    fontSize: d.font_size,
    padding: d.padding,
    backgroundStyle: d.background_style as Snippet['backgroundStyle'],
    cardWidth: d.card_width,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

export function toDbCategory(c: Category, userId: string): DbCategory {
  return { id: c.id, user_id: userId, name: c.name, color: c.color };
}

export function fromDbCategory(d: DbCategory): Category {
  return { id: d.id, name: d.name, color: d.color };
}
