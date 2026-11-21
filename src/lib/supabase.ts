import { createClient } from '@supabase/supabase-js';
import { Category, Note, Snippet } from '../types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = url && key ? createClient(url, key) : null;
export const cloudEnabled = Boolean(supabase);

// OAuth는 서버에 요청하지 않고 이동 URL을 만드므로, 이동 전에 설정을 확인한다.
export async function checkGoogleAuth(): Promise<void> {
  if (!url || !key) throw new Error('로그인 설정이 없습니다. 관리자에게 문의해 주세요.');

  let response: Response;
  try {
    response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error('로그인 서버에 연결할 수 없습니다. 네트워크 연결 또는 Supabase 프로젝트 상태와 주소를 확인해 주세요.');
  }

  if (!response.ok) {
    throw new Error(`로그인 서버 설정을 확인할 수 없습니다 (HTTP ${response.status}). 관리자에게 문의해 주세요.`);
  }
  const settings = await response.json();
  if (!settings.external?.google) {
    throw new Error('Google 로그인이 활성화되어 있지 않습니다. 관리자에게 문의해 주세요.');
  }
}

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
  parent_id?: string;
  order: number;
  type?: string;
}

interface DbNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category_id: string;
  emoji: string;
  created_at: number;
  updated_at: number;
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

export function toDbCategory(c: Category, userId: string, type = 'code'): DbCategory {
  return { id: c.id, user_id: userId, name: c.name, color: c.color, parent_id: c.parentId, order: c.order ?? 0, type };
}

export function fromDbCategory(d: DbCategory, idx = 0): Category {
  return { id: d.id, name: d.name, color: d.color, parentId: d.parent_id ?? undefined, order: d.order ?? idx };
}

export function toDbNote(n: Note, userId: string): DbNote {
  return { id: n.id, user_id: userId, title: n.title, content: n.content, category_id: n.categoryId, emoji: n.emoji, created_at: n.createdAt, updated_at: n.updatedAt };
}

export function fromDbNote(d: DbNote): Note {
  return { id: d.id, title: d.title, content: d.content, categoryId: d.category_id, emoji: d.emoji ?? '📝', createdAt: d.created_at, updatedAt: d.updated_at };
}
