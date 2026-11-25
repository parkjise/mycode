import { Note } from '../types';
import { readLlmRequest } from '../../shared/codex-relay.mjs';
import { supabase } from './supabase';
import { contactCodex, type VueAnswerCreateResponse } from './codexRelay';

export const VUE_ANSWER_NOTE_ID = (import.meta.env.VITE_VUE_ANSWER_NOTE_ID as string | undefined)?.trim() || '';
const configuredUrl = import.meta.env.VITE_VUE_ANSWER_API_URL?.trim();
export const useCodexBridge = import.meta.env.VITE_VUE_ANSWER_MODE === 'codex';
async function answerSession() {
  if (!supabase) throw new Error('로그인 설정이 없어 요청을 보낼 수 없습니다.');
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error('MyCode에 로그인해 주세요.');
  return { client: supabase, session };
}

export async function checkCodexBridge() {
  const { client, session } = await answerSession();
  await contactCodex(client, session);
}

function resolveAnswerUrl() {
  try {
    const url = new URL(configuredUrl || (import.meta.env.DEV ? 'http://localhost:8787' : ''));
    const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(import.meta.env.DEV && localHost && url.protocol === 'http:')) return null;
    if ((!import.meta.env.DEV && localHost) || url.username || url.password || url.search || url.hash) return null;
    const path = url.href.replace(/\/$/, '');
    return url.pathname.replace(/\/$/, '').endsWith('/vue-answers') ? path : `${path}/api/vue-answers`;
  } catch {
    return null;
  }
}

/**
 * Identifies the special `s` note strictly by its unique note ID (never by title).
 */
export function isVueAnswerNote(note: Pick<Note, 'id'> | null | undefined): boolean {
  if (!note || !VUE_ANSWER_NOTE_ID) return false;
  return note.id === VUE_ANSWER_NOTE_ID;
}

/**
 * Sends pasted plain text once to the answer generation server.
 * Never logs or persists the source text.
 */
export async function requestVueAnswer(plainText: string, publish = false): Promise<VueAnswerCreateResponse> {
  const { client, session } = await answerSession();
  if (useCodexBridge) {
    const result = await contactCodex(client, session, plainText, publish);
    if (!result) throw new Error('Codex 답변을 확인하지 못했어요.');
    return result;
  }
  if (readLlmRequest(plainText) !== null) throw new Error('LLM 작업은 Mac Codex 연결이 필요해요.');

  const endpoint = resolveAnswerUrl();
  if (!endpoint) throw new Error('배포용 답변 서버 주소가 설정되지 않았습니다.');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
  const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const projectUrl = import.meta.env.VITE_SUPABASE_URL;
  if (publicKey && projectUrl && new URL(endpoint).origin === new URL(projectUrl).origin) {
    headers.apikey = publicKey;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: plainText }),
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errPayload = await response.json().catch(() => ({}));
    const msg = typeof errPayload?.error === 'string' ? errPayload.error : `HTTP ${response.status}`;
    throw new Error(`답변 생성 요청 실패 (${msg})`);
  }

  return (await response.json()) as VueAnswerCreateResponse;
}

