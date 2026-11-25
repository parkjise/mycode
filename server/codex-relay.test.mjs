import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connectCodexWorker, processRelayQuestion } from './codex-relay.mjs';
import { saveFiles } from './codex-llm-files.mjs';
import { createRelayKeys, decryptRelayQuestion, encryptRelayQuestion } from '../shared/codex-relay.mjs';

test('relay packets are encrypted and bound to the request ID', async () => {
  const keys = await createRelayKeys();
  const id = crypto.randomUUID();
  const text = '가짜 예제 질문';
  const packet = await encryptRelayQuestion(text, keys.publicKey, id);
  assert.doesNotMatch(JSON.stringify(packet), /가짜 예제 질문/);
  assert.equal(await decryptRelayQuestion(keys.privateKey, { ...packet, id }), text);
  await assert.rejects(decryptRelayQuestion(keys.privateKey, { ...packet, id: crypto.randomUUID() }));
  await assert.rejects(decryptRelayQuestion(keys.privateKey, { ...packet, id, publish: true }));
  const publishingPacket = await encryptRelayQuestion(text, keys.publicKey, id, true);
  assert.equal(await decryptRelayQuestion(keys.privateKey, { ...publishingPacket, id }), text);
  await assert.rejects(decryptRelayQuestion(keys.privateKey, { ...publishingPacket, id, publish: false }));
});

test('continuation reads and publishes only explicitly selected edits', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'mycode-edit-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await saveFiles(root, new Map([['src/App.vue', 'old\n'], ['notes.md', '# Local\n']]));
  const options = {
    directory: root,
    async generate(instruction, context) {
      assert.equal(instruction, '수정해줘');
      assert.deepEqual(context.existingFiles, { 'src/App.vue': 'old\n' });
      return '```vue src/App.vue\nupdated\n```';
    },
    publishAnswer: () => assert.fail('An llm request must not publish to Code Q&A'),
    async publishFiles(files, originals) {
      assert.deepEqual([...files], [['src/App.vue', 'updated\n']]);
      assert.deepEqual([...originals], [['src/App.vue', 'old\n']]);
      return { commitUrl: 'https://github.com/owner/repo/commit/abc' };
    },
  };
  const task = 'llm\n파일: src/App.vue\n수정해줘';
  const result = await processRelayQuestion(task, options, true);
  assert.equal(result.answer.publication.status, 'pushed');
  assert.equal(await readFile(join(root, 'src/App.vue'), 'utf8'), 'updated\n');
  assert.equal(await readFile(join(root, 'notes.md'), 'utf8'), '# Local\n');

  const rejected = { ...options, publishFiles: () => assert.fail('Invalid edits must not be published') };
  const unlisted = await processRelayQuestion(task, { ...rejected, generate: async () => '```md notes.md\nchanged\n```' }, true);
  assert.match(unlisted.error, /지정한 파일만/);
  const concurrent = await processRelayQuestion(task, {
    ...rejected,
    async generate() {
      await writeFile(join(root, 'src/App.vue'), 'edited while running\n');
      return '```vue src/App.vue\nreplacement\n```';
    },
  }, true);
  assert.match(concurrent.error, /처리하는 동안 파일이 변경/);
  assert.equal(await readFile(join(root, 'src/App.vue'), 'utf8'), 'edited while running\n');

  await symlink(root, join(root, 'linked'));
  const neverGenerate = { ...rejected, generate: () => assert.fail('Invalid file paths must not reach Codex') };
  assert.match((await processRelayQuestion('llm\n파일: ../notes.md\n수정', neverGenerate, true)).error, /파일 경로/);
  assert.match((await processRelayQuestion('llm\n파일: linked/notes.md\n수정', neverGenerate, true)).error, /파일을 열 수 없어요/);
});

test('publishing receives only the current request files and leaves them on disk on push failure', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'mycode-publish-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const options = {
    directory: root,
    generate: async (name) => `\`\`\`md ${name}.md\n# Example\n\`\`\``,
    publishAnswer: () => assert.fail('An llm request must not publish to Code Q&A'),
    publishFiles: () => assert.fail('A legacy paste must not publish to GitHub'),
  };
  await processRelayQuestion('llm\nlocal-only', options);
  const pushed = await processRelayQuestion('llm\nnew-file', {
    ...options,
    async publishFiles(files) {
      assert.deepEqual([...files], [['new-file.md', '# Example\n']]);
      assert.equal(await readFile(join(root, 'new-file.md'), 'utf8'), '# Example\n');
      return { commitUrl: 'https://github.com/owner/repo/commit/abc' };
    },
  }, true);
  assert.equal(pushed.answer.publication.status, 'pushed');

  const failed = await processRelayQuestion('llm\nfailed-push', {
    ...options,
    publishFiles: () => { throw new Error('GitHub unavailable'); },
  }, true);
  assert.equal(failed.answer.publication.status, 'failed');
  assert.equal(await readFile(join(root, 'failed-push.md'), 'utf8'), '# Example\n');
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

test('llm requests save files directly and ordinary questions publish their answer', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'mycode-llm-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const markdown = [
    '```vue changes:src/Example.vue', 'partial', '```',
    '```html preview', '<p>preview</p>', '```',
    '````md', '```js ignored.js', 'nested code example', '```', '````',
    '```md test.md', '# Test', '```',
    '```vue src/Example.vue', '<style scoped src="./Example.css"></style>', '```',
    '~~~css src/Example.css', 'p { color: red; }', '~~~',
  ].join('\n');
  const options = {
    directory: root,
    async generate(...args) {
      assert.deepEqual(args, ['예제 만들어줘', { writeFiles: true }]);
      return markdown;
    },
    publishAnswer: () => assert.fail('An llm request must not publish to Code Q&A'),
  };
  assert.deepEqual(await processRelayQuestion('예제\nllm', {
    ...options,
    async generate(...args) {
      assert.deepEqual(args, ['예제\nllm']);
      return markdown;
    },
    async publishAnswer(answer) {
      assert.equal(answer, markdown);
      return { id: 'hosted-answer' };
    },
  }), { answer: { id: 'hosted-answer' } });
  assert.deepEqual(await readdir(root), []);
  const { answer } = await processRelayQuestion('\n\t\r\nllm\r\n예제 만들어줘', options);
  assert.equal(answer.localFileCount, 3);
  assert.equal(answer.status, 'completed');
  assert.deepEqual((await readdir(root)).sort(), ['src', 'test.md']);
  assert.deepEqual((await readdir(join(root, 'src'))).sort(), ['Example.css', 'Example.vue']);
  assert.equal(await readFile(join(root, 'test.md'), 'utf8'), '# Test\n');
  assert.equal(await readFile(join(root, 'src', 'Example.css'), 'utf8'), 'p { color: red; }\n');

  const conflict = await processRelayQuestion('\uFEFFllm\r새 요청', {
    ...options,
    generate: async () => '```js generated/new.js\ncode\n```\n```md test.md\nreplacement\n```',
  });
  assert.match(conflict.error, /같은 이름/);
  assert.deepEqual((await readdir(root)).sort(), ['src', 'test.md']);
  assert.equal(await readFile(join(root, 'test.md'), 'utf8'), '# Test\n');
});

test('unsafe, duplicate, conflicting or incomplete paths produce no files', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'mycode-llm-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = (path) => `\`\`\`js ${path}\ncode\n\`\`\``;
  const run = (markdown, directory = root) => processRelayQuestion('llm\n테스트', {
    directory, generate: async () => markdown, publishAnswer: () => assert.fail('An llm request must not publish errors'),
  });
  assert.match((await run('질문을 더 자세히 적어 주세요.')).error, /전체 파일/);
  for (const markdown of [
    file('../outside.js'), file('/tmp/outside.js'), file('src/.hidden/file.js'), file('src\\example.js'),
    `${file('src/file.js')}\n${file('SRC/File.js')}`, `${file('dir.js')}\n${file('dir.js/nested.js')}`,
    '```js incomplete.js\ncode',
  ]) {
    assert.match((await run(markdown)).error, /저장하지 못했어요/);
    assert.deepEqual(await readdir(root), []);
  }
  const symlinkPath = join(root, 'link');
  await symlink(root, symlinkPath);
  assert.match((await run(file('file.js'), symlinkPath)).error, /저장하지 못했어요/);
  assert.match((await run(file('link/file.js'))).error, /저장하지 못했어요/);
  assert.deepEqual(await readdir(root), ['link']);
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
    return { answer: { id: 'answer', status: 'completed', createdAt: '2026-11-23T00:00:00Z' } };
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
