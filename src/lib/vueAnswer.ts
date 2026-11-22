import { Note } from '../types';
import { supabase } from './supabase';

export const VUE_ANSWER_NOTE_ID = (import.meta.env.VITE_VUE_ANSWER_NOTE_ID as string | undefined)?.trim() || '';
const configuredUrl = import.meta.env.VITE_VUE_ANSWER_API_URL?.trim();
export const useCodexBridge = import.meta.env.VITE_VUE_ANSWER_MODE === 'codex';
const codexBridgeUrl = 'http://127.0.0.1:8798/api/codex-answer';

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
  const endpoint = useCodexBridge ? codexBridgeUrl : resolveAnswerUrl();
  if (!endpoint) {
    throw new Error('배포용 답변 서버 주소가 설정되지 않았습니다.');
  }
  if (!supabase) {
    throw new Error('로그인 설정이 없어 요청을 보낼 수 없습니다.');
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw new Error('로그인한 사용자만 답변 생성을 요청할 수 있습니다.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
  const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const projectUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!useCodexBridge && publicKey && projectUrl && new URL(endpoint).origin === new URL(projectUrl).origin) {
    headers.apikey = publicKey;
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: plainText }),
      redirect: 'error',
      signal: AbortSignal.timeout(useCodexBridge ? 115000 : 15000),
    });
  } catch (error) {
    if (!useCodexBridge) throw error;
    throw new Error('Mac의 Codex 연결 프로그램이 실행 중인지, 브라우저에서 로컬 네트워크 접근을 허용했는지 확인해 주세요.');
  }

  if (!response.ok) {
    const errPayload = await response.json().catch(() => ({}));
    const msg = typeof errPayload?.error === 'string' ? errPayload.error : `HTTP ${response.status}`;
    throw new Error(`답변 생성 요청 실패 (${msg})`);
  }

  return (await response.json()) as VueAnswerCreateResponse;
}

