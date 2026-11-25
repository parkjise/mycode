import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath, rename, rmdir, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';

const maxContextBytes = 100 * 1024;

function projectFilePath(value) {
  const path = value.normalize('NFC');
  const parts = path.split('/');
  if (path.length > 160 || parts.length > 12 || parts.some((part) => !/^[\p{L}\p{N}_-][\p{L}\p{M}\p{N}_.-]*$/u.test(part)) ||
      !/\.[\p{L}\p{N}]+$/u.test(parts.at(-1))) throw new Error('Invalid project file path');
  return path;
}

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
      const path = projectFilePath(fence.path);
      const key = path.toLowerCase();
      if (usedPaths.has(key) || files.size >= 32) throw new Error('Invalid or duplicate generated file path');
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

async function projectDirectory(root) {
  if (!(await lstat(root)).isDirectory()) throw new Error('Invalid file output directory');
  return realpath(root);
}

async function readEditFiles(root, paths, instruction) {
  if (paths.length > 12) throw new Error('한 번에 최대 12개 파일을 지정할 수 있어요.');
  let labels;
  try {
    labels = paths.map(projectFilePath);
  } catch {
    throw new Error('파일 줄에는 src/App.vue처럼 llm 폴더 기준의 파일 경로를 적어 주세요.');
  }
  if (new Set(labels.map((path) => path.toLowerCase())).size !== labels.length) throw new Error('같은 파일이 중복 지정됐어요.');
  const directory = await projectDirectory(root);
  const files = new Map();
  let remaining = maxContextBytes - Buffer.byteLength(instruction);
  for (const path of labels) {
    const filename = join(directory, path);
    let bytes;
    try {
      const stat = await lstat(filename);
      if (!stat.isFile() || await realpath(filename) !== filename) throw new Error('Invalid source file');
      if (stat.size <= remaining) bytes = await readFile(filename);
    } catch {
      throw new Error(`llm 폴더에서 수정할 파일을 열 수 없어요. ${path}`);
    }
    if (!bytes || bytes.length > remaining) throw new Error('수정 지시와 지정한 파일은 합쳐서 100KB 이하여야 해요.');
    try {
      const value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      if (value.includes('\0')) throw new Error('Invalid text file');
      files.set(path, value);
    } catch {
      throw new Error(`UTF-8 텍스트 파일을 지정해 주세요. ${path}`);
    }
    remaining -= bytes.length;
  }
  return files;
}

async function replaceFile(path, original, content) {
  const stat = await lstat(path);
  if (!stat.isFile() || await realpath(path) !== path) {
    throw Object.assign(new Error('Project file changed since it was read'), { code: 'ESTALE' });
  }
  const temporary = join(dirname(path), `.mycode-${randomUUID()}`);
  const file = await open(temporary, 'wx', stat.mode & 0o777);
  try {
    try {
      await file.writeFile(content);
      await file.chmod(stat.mode & 0o777);
    } finally {
      await file.close();
    }
    if (await realpath(path) !== path || !(await readFile(path)).equals(Buffer.from(original))) {
      throw Object.assign(new Error('Project file changed since it was read'), { code: 'ESTALE' });
    }
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

export async function saveFiles(root, files, { originals = new Map(), allowMissingOriginals = false } = {}) {
  const directory = await projectDirectory(root);
  const createdDirectories = [];
  const createdFiles = [];
  const updatedFiles = [];
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
      if (originals.has(path)) {
        const original = originals.get(path);
        try {
          await replaceFile(destination, original, content);
          updatedFiles.push({ destination, original, content });
          continue;
        } catch (error) {
          if (error.code !== 'ENOENT' || !allowMissingOriginals) throw error;
        }
      }
      const file = await open(destination, 'wx');
      createdFiles.push(destination);
      try {
        await file.writeFile(content);
      } finally {
        await file.close();
      }
    }
  } catch (error) {
    for (const { destination, original, content } of updatedFiles.reverse()) {
      await replaceFile(destination, content, original).catch(() => {});
    }
    for (const path of createdFiles) await unlink(path).catch(() => {});
    for (const path of createdDirectories.reverse()) await rmdir(path).catch(() => {});
    throw error;
  }
}

export async function saveLlmRequest(question, directory, generate, publishFiles, edit = null) {
  const instruction = edit ? edit.instruction : question;
  if (!instruction.trim()) return { error: '파일로 만들 내용이나 수정할 내용을 적어 주세요.' };
  if (!directory || !isAbsolute(directory)) return { error: 'Mac에 파일 저장 폴더가 설정되어 있지 않아요.' };

  let originals;
  if (edit) {
    try {
      originals = await readEditFiles(directory, edit.paths, instruction);
    } catch (error) {
      return { error: error.code ? 'Mac의 llm 폴더를 열 수 없어요.' : error.message };
    }
  }
  const options = { writeFiles: true };
  if (originals) options.existingFiles = Object.fromEntries(originals);
  const markdown = await generate(instruction, options);
  let files;
  try {
    files = completeFiles(markdown);
    if (originals) {
      if ([...files.keys()].some((path) => !originals.has(path))) return { error: '요청에 지정한 파일만 수정할 수 있어요.' };
      for (const [path, content] of files) if (originals.get(path) === content) files.delete(path);
    }
    if (!files.size) return { error: originals
      ? '지정한 파일에서 저장할 변경 사항을 찾지 못했어요.'
      : '저장할 전체 파일을 만들지 못했어요. 파일 이름과 필요한 소스를 요청에 포함해 주세요.' };
    await saveFiles(directory, files, { originals });
  } catch (error) {
    if (error.code === 'ESTALE') return { error: '처리하는 동안 파일이 변경됐어요. 최신 파일을 기준으로 다시 요청해 주세요.' };
    return { error: error.code === 'EEXIST'
      ? 'Mac에 파일을 저장하지 못했어요. 같은 이름의 파일이나 경로가 이미 있어요.'
      : 'Mac에 파일을 저장하지 못했어요. 파일 이름과 저장 폴더를 확인해 주세요.' };
  }

  const answer = { status: 'completed', createdAt: new Date().toISOString(), localFileCount: files.size };
  if (publishFiles) {
    try {
      answer.publication = { status: 'pushed', ...await publishFiles(files, originals) };
    } catch {
      answer.publication = { status: 'failed' };
    }
  }
  return { answer };
}
