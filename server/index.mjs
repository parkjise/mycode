import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Load .env if present (without printing or exposing values)
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const val = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

loadEnvFile();

const PORT = Number(process.env.VUE_ANSWER_PORT || 8787);
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const ALLOW_MOCK_AUTH = process.env.ALLOW_MOCK_AUTH === 'true';

/**
 * In-memory mock answer store (temporary until company-approved AI & storage are confirmed).
 * Stores ONLY generated answer metadata and content — NEVER stores the pasted source text.
 * @type {Array<{id: string, userId: string, title: string, summary: string, answerMarkdown: string, status: 'completed', createdAt: string}>}
 */
const answerStore = [];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const allowed =
    !origin ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin === 'https://parkjise.github.io';

  if (allowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function verifyUserFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  // Test-only mock token support when ALLOW_MOCK_AUTH=true
  if (ALLOW_MOCK_AUTH && token.startsWith('mock-user:')) {
    const userId = token.slice('mock-user:'.length).trim();
    return userId ? { id: userId } : null;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase auth configuration missing on server');
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    return null;
  }

  const user = await response.json();
  return user?.id ? { id: user.id } : null;
}

function readJsonBody(req, maxBytes = 512 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Generates a mock Vue answer without retaining or echoing the raw source text.
 */
function generateMockVueAnswer(text) {
  const hasScriptSetup = text.includes('<script setup') || text.includes('defineProps') || text.includes('ref(');
  const hasTemplate = text.includes('<template>');
  const title = hasScriptSetup
    ? 'Vue 3 Composition API 코드 리뷰 (모의 응답)'
    : 'Vue 컴포넌트 구조 및 개선 가이드 (모의 응답)';

  const summary = hasTemplate
    ? '템플릿 및 스크립트 구성에 대한 모의 분석 결과입니다.'
    : '전달된 Vue 코드와 질문에 대한 모의 답변입니다.';

  const answerMarkdown = [
    `### ${title}`,
    '',
    '> 현재 회사 승인 AI 서비스 및 저장소 연결 전 단계로 **모의 응답**이 반환되었습니다.',
    '',
    '#### 핵심 점검 포인트',
    '- **반응형 상태 관리**: `ref` / `reactive` 사용 시 구조 분해 할당으로 반응성이 깨지지 않도록 `toRefs` 또는 직접 참조를 유지하세요.',
    '- **Props / Emits 타입 정의**: TypeScript 환경에서는 `defineProps<Props>()`와 `defineEmits<Emits>()`로 계약을 명확히 정의하는 것이 좋습니다.',
    '- **사이드 이펙트 정리**: `watch` / `onMounted` 내부의 타이머나 이벤트 리스너는 `onUnmounted`에서 정리하세요.',
  ].join('\n');

  return { title, summary, answerMarkdown };
}

export function createAnswerServer() {
  return http.createServer(async (req, res) => {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;

    // Health check (no auth required, no sensitive info)
    if (req.method === 'GET' && pathname === '/health') {
      sendJson(res, 200, { ok: true, mode: 'mock' });
      return;
    }

    // All /api/vue-answers routes require authenticated user
    if (pathname === '/api/vue-answers' || pathname.startsWith('/api/vue-answers/')) {
      let user = null;
      try {
        user = await verifyUserFromRequest(req);
      } catch {
        sendJson(res, 500, { error: 'Auth verification failed' });
        return;
      }

      if (!user) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/vue-answers') {
        let body;
        try {
          body = await readJsonBody(req);
        } catch (err) {
          sendJson(res, 400, { error: err instanceof Error ? err.message : 'Bad Request' });
          return;
        }

        const text = typeof body?.text === 'string' ? body.text.trim() : '';
        if (!text) {
          sendJson(res, 400, { error: 'Plain text is required' });
          return;
        }

        // Generate mock answer; never log or persist `text`
        const generated = generateMockVueAnswer(text);
        const record = {
          id: crypto.randomUUID(),
          userId: user.id,
          title: generated.title,
          summary: generated.summary,
          answerMarkdown: generated.answerMarkdown,
          status: 'completed',
          createdAt: new Date().toISOString(),
        };
        answerStore.unshift(record);

        // Log metadata only (never log raw text)
        console.info(`[vue-answers] created id=${record.id} user=${user.id}`);

        sendJson(res, 201, {
          id: record.id,
          status: record.status,
          createdAt: record.createdAt,
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/vue-answers') {
        const items = answerStore
          .filter((item) => item.userId === user.id)
          .map(({ id, title, summary, answerMarkdown, status, createdAt }) => ({
            id,
            title,
            summary,
            answerMarkdown,
            status,
            createdAt,
          }));
        sendJson(res, 200, { items });
        return;
      }

      if (req.method === 'GET' && pathname.startsWith('/api/vue-answers/')) {
        const id = pathname.slice('/api/vue-answers/'.length);
        const item = answerStore.find((entry) => entry.id === id && entry.userId === user.id);
        if (!item) {
          sendJson(res, 404, { error: 'Not found' });
          return;
        }
        sendJson(res, 200, {
          id: item.id,
          title: item.title,
          summary: item.summary,
          answerMarkdown: item.answerMarkdown,
          status: item.status,
          createdAt: item.createdAt,
        });
        return;
      }
    }

    sendJson(res, 404, { error: 'Not found' });
  });
}

// Start server when run directly
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const server = createAnswerServer();
  server.listen(PORT, () => {
    console.info(`[vue-answers] mock server listening on http://localhost:${PORT}`);
  });
}

