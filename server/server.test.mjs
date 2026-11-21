import test from 'node:test';
import assert from 'node:assert/strict';

process.env.ALLOW_MOCK_AUTH = 'true';
const { createAnswerServer } = await import('./index.mjs');

test('vue-answers server auth, user isolation, and no-source-text guarantee', async () => {
  const server = createAnswerServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // 1. Unauthenticated requests must be rejected
    const unauthPost = await fetch(`${baseUrl}/api/vue-answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '<template><div>hi</div></template>' }),
    });
    assert.equal(unauthPost.status, 401);

    const unauthGet = await fetch(`${baseUrl}/api/vue-answers`);
    assert.equal(unauthGet.status, 401);

    // 2. User A posts fake Vue code + question
    const fakeVueInput = '<script setup>\nconst count = ref(0)\n</script>\n질문: ref 반응성 유지 방법?';
    const postRes = await fetch(`${baseUrl}/api/vue-answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock-user:user-a',
      },
      body: JSON.stringify({ text: fakeVueInput }),
    });
    assert.equal(postRes.status, 201);
    const created = await postRes.json();
    assert.ok(created.id);
    assert.equal(created.status, 'completed');
    assert.ok(created.createdAt);

    // 3. User A fetches their answers — must not contain raw source text
    const listARes = await fetch(`${baseUrl}/api/vue-answers`, {
      headers: { Authorization: 'Bearer mock-user:user-a' },
    });
    assert.equal(listARes.status, 200);
    const listA = await listARes.json();
    assert.equal(listA.items.length, 1);
    assert.equal(listA.items[0].id, created.id);
    assert.equal(listA.items[0].status, 'completed');
    assert.ok(listA.items[0].answerMarkdown.length > 0);
    assert.equal('text' in listA.items[0], false);
    assert.equal('sourceText' in listA.items[0], false);
    assert.equal(JSON.stringify(listA).includes('질문: ref 반응성 유지 방법?'), false);

    // 4. User B cannot see User A's answers
    const listBRes = await fetch(`${baseUrl}/api/vue-answers`, {
      headers: { Authorization: 'Bearer mock-user:user-b' },
    });
    assert.equal(listBRes.status, 200);
    const listB = await listBRes.json();
    assert.equal(listB.items.length, 0);

    const detailBRes = await fetch(`${baseUrl}/api/vue-answers/${created.id}`, {
      headers: { Authorization: 'Bearer mock-user:user-b' },
    });
    assert.equal(detailBRes.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

