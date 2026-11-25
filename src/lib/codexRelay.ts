import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { codexRelayConfig, codexRelayTopic, encryptRelayQuestion, readLlmRequest } from '../../shared/codex-relay.mjs';

export type VueAnswerCreateResponse = {
  status: 'completed';
  createdAt: string;
} & ({ id: string; localFileCount?: never } | { localFileCount: number; id?: never });

type Ready = { id: string; status: 'ready' | 'busy'; publicKey?: string; localFiles?: boolean };
type Result = { id: string; answer?: VueAnswerCreateResponse; error?: string };

function deadline<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function contactCodex(
  client: SupabaseClient,
  session: Session,
  question?: string,
): Promise<VueAnswerCreateResponse | undefined> {
  await client.realtime.setAuth(session.access_token);
  const channel = client.channel(codexRelayTopic(session.user.id), codexRelayConfig);
  const id = crypto.randomUUID();

  const ready = new Promise<Ready>((resolve) => {
    channel.on('broadcast', { event: 'codex_ready' }, ({ payload }) => {
      if (payload?.id === id) resolve(payload);
    });
  });
  const result = new Promise<Result>((resolve) => {
    channel.on('broadcast', { event: 'codex_result' }, ({ payload }) => {
      if (payload?.id === id) resolve(payload);
    });
  });

  try {
    const subscribed = await deadline(new Promise<boolean>((resolve) => {
      channel.subscribe((status) => resolve(status === 'SUBSCRIBED'));
    }), 10000, 'Codex 연결에 시간이 초과됐어요. 인터넷 연결을 확인해 주세요.');
    if (!subscribed) throw new Error('Codex에 접속할 수 없어요. MyCode 로그인 상태를 확인해 주세요.');
    const probe = await channel.send({ type: 'broadcast', event: 'codex_probe', payload: { id, question: question !== undefined } });
    if (probe !== 'ok') throw new Error('Codex 연결을 확인하지 못했어요.');
    const peer = await deadline(ready, 6000, '답변을 처리하는 Mac이 응답하지 않아요. Mac의 Codex 연결 프로그램을 확인해 주세요.');
    if (peer.status === 'busy') throw new Error('Mac의 Codex가 이전 질문을 처리 중이에요.');
    if (peer.status !== 'ready' || !peer.publicKey) throw new Error('Mac Codex 연결을 확인하지 못했어요.');
    if (question === undefined) return;
    const local = readLlmRequest(question) !== null;
    if (local && peer.localFiles !== true) throw new Error('LLM 작업을 보내려면 Mac 연결 프로그램을 업데이트해 주세요.');

    const encrypted = await encryptRelayQuestion(question, peer.publicKey, id);
    const sent = await channel.send({ type: 'broadcast', event: 'codex_question', payload: { id, ...encrypted } });
    if (sent !== 'ok') throw new Error('질문을 Mac에 보내지 못했어요.');
    const reply = await deadline(result, 110000, local
      ? 'Mac의 응답을 확인하지 못했어요. llm 폴더에 파일이 생성됐는지 확인해 주세요.'
      : '응답을 확인하지 못했어요. Code Q&A에서 답변이 도착했는지 확인해 주세요.');
    if (!reply.answer || reply.answer.status !== 'completed') {
      throw new Error(reply.error || 'Mac에서 Codex 답변을 만들지 못했어요.');
    }
    return reply.answer;
  } finally {
    await client.removeChannel(channel);
  }
}
