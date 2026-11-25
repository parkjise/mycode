import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import { answerWithCodex } from './codex-bridge.mjs';
import { saveLlmRequest } from './codex-llm-files.mjs';
import { createLlmPublisher } from './codex-llm-publish.mjs';
import {
  codexRelayConfig, codexRelayTopic, createRelayKeys, decryptRelayQuestion, readLlmEdit, readLlmRequest, relayId,
} from '../shared/codex-relay.mjs';

const authAddress = 'http://127.0.0.1:8799';

export async function processRelayQuestion(text, { directory, generate, publishAnswer, publishFiles }, publish = false) {
  const question = readLlmRequest(text);
  if (publish && (!publishFiles || question === null)) return { error: 'Mac의 비공개 GitHub 연결 설정을 확인해 주세요.' };
  if (question === null) return { answer: await publishAnswer(await generate(text)) };
  const edit = publish ? readLlmEdit(question) : null;
  return saveLlmRequest(question, directory, generate, publish ? publishFiles : undefined, edit);
}

export async function connectCodexWorker(client, userId, processQuestion, onStatus = () => {}, canPublish = false) {
  const keys = await createRelayKeys();
  const channel = client.channel(codexRelayTopic(userId), codexRelayConfig);
  const waiting = new Map();
  let working = false;

  const broadcast = (event, payload) => channel.send({ type: 'broadcast', event, payload });
  channel.on('broadcast', { event: 'codex_probe' }, ({ payload }) => {
    const id = payload?.id;
    if (!relayId(id)) return;
    const now = Date.now();
    for (const [nonce, expires] of waiting) if (expires <= now) waiting.delete(nonce);
    if (working || waiting.size >= 32) {
      void broadcast('codex_ready', { id, status: 'busy' }).catch(() => {});
      return;
    }
    if (payload.question === true) waiting.set(id, now + 15000);
    void broadcast('codex_ready', { id, status: 'ready', publicKey: keys.publicKey, localFiles: true, canPublish, canEdit: canPublish }).catch(() => {});
  });

  channel.on('broadcast', { event: 'codex_question' }, async ({ payload }) => {
    const id = payload?.id;
    const expires = waiting.get(id);
    if (!expires) return;
    waiting.delete(id);
    if (expires <= Date.now()) return;
    if (working) {
      await broadcast('codex_result', { id, error: 'Mac의 Codex가 이전 질문을 처리 중이에요.' }).catch(() => {});
      return;
    }
    working = true;
    try {
      const text = await decryptRelayQuestion(keys.privateKey, payload);
      if (!text.trim()) throw new Error('Empty question');
      const outcome = await processQuestion(text, payload.publish === true);
      await broadcast('codex_result', { id, ...outcome }).catch(() => {});
    } catch {
      await broadcast('codex_result', { id, error: 'Mac에서 답변 생성 또는 저장에 실패했어요.' }).catch(() => {});
    } finally {
      working = false;
    }
  });

  channel.subscribe(onStatus);
  return channel;
}

function startRelay() {
  process.loadEnvFile();
  const publishFiles = createLlmPublisher(process.env.VUE_CODEX_LLM_PUBLISH_REPO);
  const project = new URL(process.env.VITE_SUPABASE_URL || '');
  const publicKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (project.protocol !== 'https:' || !project.hostname.endsWith('.supabase.co') || !publicKey) {
    throw new Error('Missing MyCode Supabase project URL or public key');
  }
  const client = createClient(project.href, publicKey, { auth: { flowType: 'pkce', persistSession: false } });
  const endpoint = new URL('/functions/v1/vue-answers/codex', project);
  let channel;
  let connected = false;
  let authenticating = false;

  const requestAnswerService = (session, options = {}) => fetch(endpoint, {
    ...options,
    headers: { apikey: publicKey, Authorization: `Bearer ${session.access_token}`, ...options.headers },
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  const publishAnswer = async (answerMarkdown) => {
    const { data: { session } } = await client.auth.getSession();
    if (!session) throw new Error('Mac relay authentication expired');
    const result = await requestAnswerService(session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answerMarkdown }),
    });
    if (result.status !== 201) throw new Error('Could not save Codex answer');
    return result.json();
  };
  const processQuestion = (text, publish) => processRelayQuestion(text, {
    directory: process.env.VUE_CODEX_LLM_DIR, generate: answerWithCodex, publishAnswer, publishFiles,
  }, publish);

  const server = createServer(async (req, res) => {
    function send(status, message, offerLogin = false) {
      res.writeHead(status, {
        'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
        'Referrer-Policy': 'no-referrer',
      });
      res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><title>MyCode Codex 연결</title><h1>MyCode Codex 연결</h1><p>${message}</p>${offerLogin ? '<a href="/sign-in">MyCode Google 계정으로 연결</a>' : ''}</html>`);
    }
    if (req.headers.host !== '127.0.0.1:8799' || req.method !== 'GET') return send(403, '허용되지 않은 요청입니다.');
    const url = new URL(req.url, authAddress);
    if (url.pathname === '/' || url.pathname === '/status') {
      return send(200, connected ? 'Mac Codex 연결됨. 다른 PC의 MyCode에서도 질문할 수 있습니다.' : '연결 상태를 확인하려면 새로고침하거나 다시 로그인해 주세요.', !connected);
    }
    if (connected) return send(200, 'Mac Codex 연결됨.');
    try {
      if (url.pathname === '/sign-in') {
        const { data, error } = await client.auth.signInWithOAuth({ provider: 'google',
          options: { redirectTo: `${authAddress}/callback`, skipBrowserRedirect: true },
        });
        if (error || !data.url) return send(502, 'Google 로그인에 실패했습니다.', true);
        res.writeHead(302, { Location: data.url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
        res.end();
        return;
      }
      if (url.pathname !== '/callback' || !url.searchParams.has('code')) return send(404, 'Mac 연결을 다시 시작해 주세요.', true);
      if (authenticating) return send(409, '다른 로그인 요청을 확인 중입니다.');
      authenticating = true;
      try {
        const { data: { session }, error } = await client.auth.exchangeCodeForSession(url.searchParams.get('code'));
        if (error || !session) return send(401, 'MyCode Google 계정으로 다시 로그인해 주세요.', true);
        if ((await requestAnswerService(session)).status !== 204) {
          await client.auth.signOut({ scope: 'local' });
          return send(403, 'MyCode에서 답변을 사용하는 본인 계정으로 로그인해 주세요.', true);
        }
        await client.realtime.setAuth(session.access_token);
        if (channel) await client.removeChannel(channel);
        client.auth.startAutoRefresh();
        let markOnline;
        const online = new Promise((resolveOnline) => { markOnline = resolveOnline; });
        channel = await connectCodexWorker(client, session.user.id, processQuestion, (status) => {
          connected = status === 'SUBSCRIBED';
          if (connected) {
            markOnline();
            console.info('MyCode Codex relay online');
          }
        }, Boolean(publishFiles));
        await Promise.race([online, delay(8000, undefined, { ref: false })]);
        res.writeHead(303, { Location: '/status', 'Cache-Control': 'no-store' });
        res.end();
      } finally {
        authenticating = false;
      }
    } catch {
      return send(502, '연결에 실패했습니다. 다시 시도해 주세요.', true);
    }
  });
  server.listen(8799, '127.0.0.1', () => console.info(`Authorize MyCode Codex relay at ${authAddress}/`));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startRelay();
