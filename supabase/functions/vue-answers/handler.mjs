const githubPagesOrigin = 'https://parkjise.github.io';
const maxBytes = 64 * 1024;
const answerColumns = 'id,title,summary,answer_markdown,created_at';

function publicAnswer(row) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    answerMarkdown: row.answer_markdown,
    createdAt: row.created_at,
    status: 'completed',
  };
}

async function readText(request) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let total = 0;
  let body = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    body += decoder.decode(value, { stream: true });
  }
  const { text } = JSON.parse(body + decoder.decode());
  return typeof text === 'string' ? text.trim() : '';
}

function buildMockAnswer(text) {
  const composition = /<script setup|\b(?:ref|defineProps)\s*\(/.test(text);
  const title = composition ? 'Vue Composition API (모의 답변)' : 'Vue 코드 Q&A (모의 답변)';
  return {
    title,
    summary: '가짜 질문으로 배포 연결을 확인하는 모의 답변입니다.',
    answer_markdown: [
      `### ${title}`,
      '',
      composition
        ? 'Composition API에서는 `ref()`로 반응형 상태를 선언하고 스크립트에서 `.value`로 접근합니다.'
        : 'Vue 컴포넌트는 템플릿에서 상태를 표시하고 이벤트 핸들러에서 상태를 변경할 수 있습니다.',
    ].join('\n'),
  };
}

export function createVueAnswerHandler({ supabaseUrl, anonKey, serviceKey, fetchImpl = fetch }) {
  const project = supabaseUrl?.replace(/\/$/, '');
  return async (request) => {
    const origin = request.headers.get('Origin');
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Vary': 'Origin',
    };
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers });
    if (origin && origin !== githubPagesOrigin) return json(403, { error: 'Origin not allowed' });
    if (origin) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type';
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (!['GET', 'POST'].includes(request.method)) return json(405, { error: 'Method not allowed' });
    if (!project || !anonKey || !serviceKey) return json(503, { error: 'Answer service unavailable' });
    const authorization = request.headers.get('Authorization');
    if (!/^Bearer \S+$/i.test(authorization ?? '')) return json(401, { error: 'Unauthorized' });

    const callerHeaders = { apikey: anonKey, Authorization: authorization };
    try {
      const identity = await fetchImpl(`${project}/auth/v1/user`, { headers: callerHeaders });
      if ([401, 403].includes(identity.status)) return json(401, { error: 'Unauthorized' });
      if (!identity.ok) return json(502, { error: 'Authentication service unavailable' });
      const { id: userId } = await identity.json();
      if (!userId) return json(401, { error: 'Unauthorized' });

      const tableUrl = new URL(`${project}/rest/v1/mycode_vue_answers`);
      tableUrl.searchParams.set('select', answerColumns);
      if (request.method === 'GET') {
        tableUrl.searchParams.set('user_id', `eq.${userId}`);
        tableUrl.searchParams.set('order', 'created_at.desc,id.desc');
        tableUrl.searchParams.set('limit', '100');
        const response = await fetchImpl(tableUrl, { headers: callerHeaders });
        if (!response.ok) return json(502, { error: 'Could not load answers' });
        return json(200, { items: (await response.json()).map(publicAnswer) });
      }

      let text;
      try {
        text = await readText(request);
      } catch {
        return json(400, { error: 'Invalid request' });
      }
      if (text === null) return json(413, { error: 'Question exceeds 64 KB' });
      if (!text) return json(400, { error: 'Plain text is required' });
      const response = await fetchImpl(tableUrl, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ user_id: userId, ...buildMockAnswer(text) }),
      });
      if (!response.ok) return json(502, { error: 'Could not create answer' });
      const [answer] = await response.json();
      return json(201, { id: answer.id, status: 'completed', createdAt: answer.created_at });
    } catch {
      return json(502, { error: 'Answer service unavailable' });
    }
  };
}
