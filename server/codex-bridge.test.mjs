import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createCodexBridge } from './codex-bridge.mjs';
import { createVueAnswerHandler } from '../supabase/functions/vue-answers/handler.mjs';

const origin = 'https://parkjise.github.io';
const project = 'https://mock-project.supabase.co';
const endpoint = `${project}/functions/v1/vue-answers/codex`;

test('only the owner can run Codex and only its answer reaches the hosted store', async () => {
  const original = 'synthetic raw question marker';
  const markdown = '## Vue 답변\n\n`ref()`를 사용하세요.';
  const stored = [];
  let runs = 0;
  const handler = createVueAnswerHandler({
    supabaseUrl: project, anonKey: 'public', serviceKey: 'service', codexOwnerId: 'owner',
    fetchImpl(input, opts) {
      const url = new URL(input);
      if (url.pathname === '/auth/v1/user') return Response.json({ id: opts.headers.Authorization.split(' ')[1] });
      assert.equal(opts.method, 'POST');
      assert.equal(opts.body.includes(original), false);
      stored.push(JSON.parse(opts.body));
      return Response.json([{ id: '1', created_at: '2026-11-22T00:00:00Z' }]);
    },
  });
  const bridge = createCodexBridge({ endpoint, publicKey: 'public',
    fetchImpl(input, options) {
      assert.equal(input, endpoint);
      assert.equal(options.body?.includes(original) ?? false, false);
      return handler(new Request(input, options));
    },
    async generate(text) {
      assert.equal(text, original);
      runs++;
      return markdown;
    },
  });
  bridge.listen(0, '127.0.0.1');
  await once(bridge, 'listening');
  try {
    const url = `http://127.0.0.1:${bridge.address().port}/api/codex-answer`;
    const submit = (token, source = origin) => fetch(url, {
      method: 'POST', headers: { Origin: source, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: original }),
    });
    assert.equal((await submit('owner', 'https://different.example')).status, 403);
    assert.equal((await submit('different-user')).status, 403);
    assert.equal(runs, 0);
    const oldEndpoint = await handler(new Request(`${project}/functions/v1/vue-answers`, {
      method: 'POST', headers: { Authorization: 'Bearer owner' }, body: JSON.stringify({ text: original }),
    }));
    assert.equal(oldEndpoint.status, 409);
    const response = await submit('owner');
    assert.equal(response.status, 201);
    assert.equal(runs, 1);
    assert.equal(stored.length, 1);
    assert.equal(stored[0].user_id, 'owner');
    assert.equal(stored[0].answer_markdown, markdown);
  } finally {
    await new Promise((resolve) => bridge.close(resolve));
  }
});
