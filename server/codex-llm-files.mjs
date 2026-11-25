import { lstat, mkdir, open, realpath, rmdir, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';

function completeFiles(markdown) {
  const files = new Map();
  const usedPaths = new Set();
  let fence;
  for (const line of markdown.split(/\r?\n/)) {
    if (!fence) {
      const opening = /^ {0,3}(`{3,}|~{3,})[ \t]*(.*)$/.exec(line);
      if (!opening || (opening[1][0] === '`' && opening[2].includes('`'))) continue;
      const [language, path, ...extra] = opening[2].trim().split(/\s+/);
      const isFile = language && path && !extra.length && path !== 'preview' && !path.startsWith('changes:');
      fence = { delimiter: opening[1], path: isFile ? path : undefined, indent: opening[0].indexOf(opening[1]), lines: [] };
      continue;
    }

    const closing = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line)?.[1];
    if (closing?.[0] !== fence.delimiter[0] || closing.length < fence.delimiter.length) {
      if (fence.path) fence.lines.push(line.slice(Math.min(fence.indent, /^ */.exec(line)[0].length)));
      continue;
    }

    if (fence.path) {
      const path = fence.path.normalize('NFC');
      const parts = path.split('/');
      const key = path.toLowerCase();
      if (path.length > 160 || parts.length > 12 || parts.some((part) => !/^[\p{L}\p{N}_-][\p{L}\p{M}\p{N}_.-]*$/u.test(part)) ||
          !/\.[\p{L}\p{N}]+$/u.test(parts.at(-1)) || usedPaths.has(key) || files.size >= 32) {
        throw new Error('Invalid or duplicate generated file path');
      }
      usedPaths.add(key);
      files.set(path, fence.lines.length ? `${fence.lines.join('\n')}\n` : '');
    }
    fence = undefined;
  }
  if (fence?.path) throw new Error('Unclosed complete file block');
  for (const path of usedPaths) {
    for (let parent = dirname(path); parent !== '.'; parent = dirname(parent)) {
      if (usedPaths.has(parent)) throw new Error('Conflicting generated file paths');
    }
  }
  return files;
}

export async function saveFiles(root, files) {
  if (!(await lstat(root)).isDirectory()) throw new Error('Invalid file output directory');
  const directory = await realpath(root);
  const createdDirectories = [];
  const createdFiles = [];
  try {
    for (const [path, content] of files) {
      const parts = path.split('/');
      const name = parts.pop();
      let parent = directory;
      for (const part of parts) {
        parent = join(parent, part);
        try {
          await mkdir(parent);
          createdDirectories.push(parent);
        } catch (error) {
          if (error.code !== 'EEXIST' || !(await lstat(parent)).isDirectory()) throw error;
        }
      }
      const destination = join(parent, name);
      const file = await open(destination, 'wx');
      createdFiles.push(destination);
      try {
        await file.writeFile(content);
      } finally {
        await file.close();
      }
    }
  } catch (error) {
    for (const path of createdFiles) await unlink(path).catch(() => {});
    for (const path of createdDirectories.reverse()) await rmdir(path).catch(() => {});
    throw error;
  }
}

export async function saveLlmRequest(question, directory, generate, publishFiles) {
  if (!question.trim()) return { error: 'llm 다음 줄에 파일로 만들 내용과 요청을 적어 주세요.' };
  if (!directory || !isAbsolute(directory)) return { error: 'Mac에 파일 저장 폴더가 설정되어 있지 않아요.' };

  const markdown = await generate(question, { writeFiles: true });
  let files;
  try {
    files = completeFiles(markdown);
    if (!files.size) return { error: '저장할 전체 파일을 만들지 못했어요. 파일 이름과 필요한 소스를 요청에 포함해 주세요.' };
    await saveFiles(directory, files);
  } catch (error) {
    return { error: error.code === 'EEXIST'
      ? 'Mac에 파일을 저장하지 못했어요. 같은 이름의 파일이나 경로가 이미 있어요.'
      : 'Mac에 파일을 저장하지 못했어요. 파일 이름과 저장 폴더를 확인해 주세요.' };
  }

  const answer = { status: 'completed', createdAt: new Date().toISOString(), localFileCount: files.size };
  if (publishFiles) {
    try {
      answer.publication = { status: 'pushed', ...await publishFiles(files) };
    } catch {
      answer.publication = { status: 'failed' };
    }
  }
  return { answer };
}
