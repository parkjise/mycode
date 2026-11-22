import test from 'node:test';
import assert from 'node:assert/strict';
import { createVueAnswerHandler } from '../supabase/functions/vue-answers/handler.mjs';

const project = 'https://project.example.invalid';
const origin = 'https://parkjise.github.io';
const endpoint = `${project}/functions/v1/vue-answers`;
const sourceMarker = 'private-source-marker-test';

function request(method, token, body, requestOrigin = origin) {
  const headers = { Origin: requestOrigin };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request(endpoint, { method, headers, body: body && JSON.stringify(body) });
}

test('Edge handler authenticates callers and keeps original text out of the answer store', async () => {
  const records = [];
  const fetchImpl = async (input, options) => {
    const url = new URL(input);
    assert.equal(url.origin, project);
    const userToken = options.headers.Authorization.slice('Bearer '.length);
    if (url.pathname === '/auth/v1/user') {
      assert.equal(options.headers.apikey, 'public-key');
      return ['alice', 'bob'].includes(userToken)
        ? Response.json({ id: userToken })
        : Response.json({}, { status: 401 });
    }
    assert.equal(url.pathname, '/rest/v1/mycode_vue_answers');
    if (options.method === 'POST') {
      assert.equal(options.headers.apikey, 'server-key');
      const body = JSON.parse(options.body);
      assert.equal(body.user_id, 'alice');
      assert.equal(Object.hasOwn(body, 'text'), false);
      assert.equal(options.body.includes(sourceMarker), false);
      const record = { ...body, id: 'answer-1', created_at: '2026-11-22T00:00:00Z' };
      records.push(record);
      return Response.json([record], { status: 201 });
    }
    assert.equal(options.headers.apikey, 'public-key');
    assert.equal(url.searchParams.get('user_id'), `eq.${userToken}`);
    return Response.json(records.filter((record) => record.user_id === userToken));
  };
  const handler = createVueAnswerHandler({
    supabaseUrl: project,
    anonKey: 'public-key',
    serviceKey: 'server-key',
    fetchImpl,
  });
  const preflight = await handler(request('OPTIONS'));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal((await handler(request('GET', 'alice', undefined, 'https://other.example'))).status, 403);
  assert.equal((await handler(request('GET'))).status, 401);
  assert.equal((await handler(request('GET', 'invalid-user'))).status, 401);
  assert.equal((await handler(request('POST', 'alice', { text: ' ' }))).status, 400);
  assert.equal((await handler(request('POST', 'alice', { text: 'a'.repeat(65537) }))).status, 413);
  assert.equal((await handler(request('POST', 'alice', {
    user_id: 'bob', text: `const count = ref(0); ${sourceMarker}`,
  }))).status, 201);
  assert.equal(records.length, 1);
  const ownResponse = await handler(request('GET', 'alice'));
  assert.equal(ownResponse.headers.get('Cache-Control'), 'no-store');
  const ownList = await ownResponse.json();
  assert.equal(ownList.items[0].id, 'answer-1');
  assert.match(ownList.items[0].answerMarkdown, /모의 답변/);
  assert.equal(JSON.stringify(ownList).includes(sourceMarker), false);
  assert.deepEqual(await (await handler(request('GET', 'bob'))).json(), { items: [] });
});

test('deletion is scoped by answer ID and authenticated owner', async () => {
  const id = 'eac9b9f0-72d8-4f8a-a530-3090ca3de97f';
  const stored = new Map([[id, 'alice']]);
  const handler = createVueAnswerHandler({
    supabaseUrl: project, anonKey: 'public-key', serviceKey: 'server-key',
    fetchImpl: async (input, options) => {
      const url = new URL(input);
      const user = options.headers.Authorization.split(' ')[1];
      if (url.pathname === '/auth/v1/user') return Response.json({ id: user });
      assert.equal(options.method, 'DELETE');
      assert.equal(options.headers.apikey, 'public-key');
      assert.equal(url.searchParams.get('id'), `eq.${id}`);
      assert.equal(url.searchParams.get('user_id'), `eq.${user}`);
      if (stored.get(id) === user) stored.delete(id);
      return new Response(null, { status: 204 });
    },
  });
  const remove = (token, target = id) => handler(new Request(`${endpoint}/${target}`, {
    method: 'DELETE', headers: { Origin: origin, ...(token && { Authorization: `Bearer ${token}` }) },
  }));
  assert.equal((await remove()).status, 401);
  assert.equal((await remove('alice', 'codex')).status, 404);
  assert.equal((await remove('bob')).status, 204);
  assert.equal(stored.get(id), 'alice');
  assert.equal((await remove('alice')).status, 204);
  assert.equal(stored.has(id), false);
  assert.equal((await remove('alice')).status, 204);
});
