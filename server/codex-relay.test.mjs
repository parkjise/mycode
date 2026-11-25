import test from 'node:test';
import assert from 'node:assert/strict';
import { connectCodexWorker } from './codex-relay.mjs';
import { createRelayKeys, decryptRelayQuestion, encryptRelayQuestion } from '../shared/codex-relay.mjs';

test('relay packets are encrypted and bound to the request ID', async () => {
  const keys = await createRelayKeys();
  const id = crypto.randomUUID();
  const text = '가짜 예제 질문';
  const packet = await encryptRelayQuestion(text, keys.publicKey, id);
  assert.doesNotMatch(JSON.stringify(packet), /가짜 예제 질문/);
  assert.equal(await decryptRelayQuestion(keys.privateKey, { ...packet, id }), text);
  await assert.rejects(decryptRelayQuestion(keys.privateKey, { ...packet, id: crypto.randomUUID() }));
});

test('relay accepts a 100 KB question by UTF-8 byte size and rejects larger ones', async () => {
  const keys = await createRelayKeys();
  const id = crypto.randomUUID();
  const text = 'llm\n' + '가'.repeat(34132);
  assert.equal(Buffer.byteLength(text), 100 * 1024);
  const packet = await encryptRelayQuestion(text, keys.publicKey, id);
  assert.equal(await decryptRelayQuestion(keys.privateKey, { ...packet, id }), text);
  await assert.rejects(encryptRelayQuestion(`${text}!`, keys.publicKey, id), /100KB/);
});

test('the Mac worker accepts only probed requests and processes each once', async () => {
  const events = new Map();
  const outputs = [];
  const answers = [];
  const channel = {
    on(_type, { event }, func) { events.set(event, func); },
    async send(message) { outputs.push(message); return 'ok'; },
    subscribe(callback) { callback('SUBSCRIBED'); },
  };
  const client = { channel(topic, options) {
    assert.equal(topic, 'mycode-codex:owner');
    assert.equal(options.config.private, true);
    return channel;
  } };
  const id = crypto.randomUUID();
  const text = '공개 코딩 예제';
  await connectCodexWorker(client, 'owner', async (question) => {
    answers.push(question);
    return { id: 'answer', status: 'completed', createdAt: '2026-11-23T00:00:00Z' };
  });
  await events.get('codex_question')({ payload: { id, question: text } });
  assert.equal(outputs.length, 0);
  await events.get('codex_probe')({ payload: { id, question: true } });
  assert.equal(outputs[0].event, 'codex_ready');
  const encrypted = await encryptRelayQuestion(text, outputs[0].payload.publicKey, id);
  await events.get('codex_question')({ payload: { id, ...encrypted } });
  await events.get('codex_question')({ payload: { id, ...encrypted } });
  assert.deepEqual(answers, [text]);
  assert.equal(outputs.length, 2);
  assert.equal(outputs[1].event, 'codex_result');
  assert.equal(outputs[1].payload.answer.id, 'answer');
  assert.doesNotMatch(JSON.stringify(outputs), /공개 코딩 예제/);
});
