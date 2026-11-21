import { Note } from '../types';
import { supabase } from './supabase';

export const VUE_ANSWER_NOTE_ID = (import.meta.env.VITE_VUE_ANSWER_NOTE_ID as string | undefined)?.trim() || '';
const VUE_ANSWER_API_URL = (import.meta.env.VITE_VUE_ANSWER_API_URL as string | undefined)?.trim() || 'http://localhost:8787';

/**
 * Identifies the special `s` note strictly by its unique note ID (never by title).
 */
export function isVueAnswerNote(note: Pick<Note, 'id'> | null | undefined): boolean {
  if (!note || !VUE_ANSWER_NOTE_ID) return false;
  return note.id === VUE_ANSWER_NOTE_ID;
}

export interface VueAnswerCreateResponse {
  id: string;
  status: 'completed';
  createdAt: string;
}

/**
 * Sends pasted plain text once to the answer generation server.
 * Never logs or persists the source text.
 */
export async function requestVueAnswer(plainText: string): Promise<VueAnswerCreateResponse> {
  if (!supabase) {
    throw new Error('로그인 설정이 없어 요청을 보낼 수 없습니다.');
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw new Error('로그인한 사용자만 답변 생성을 요청할 수 있습니다.');
  }

  const response = await fetch(`${VUE_ANSWER_API_URL.replace(/\/$/, '')}/api/vue-answers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ text: plainText }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errPayload = await response.json().catch(() => ({}));
    const msg = typeof errPayload?.error === 'string' ? errPayload.error : `HTTP ${response.status}`;
    throw new Error(`답변 생성 요청 실패 (${msg})`);
  }

  return (await response.json()) as VueAnswerCreateResponse;
}

