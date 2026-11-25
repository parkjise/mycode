import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { saveFiles } from './codex-llm-files.mjs';

const exec = promisify(execFile);

export function createLlmPublisher(repository) {
  if (!repository) return undefined;
  if (!/^[a-z0-9][a-z0-9-]*\/[a-z0-9_][a-z0-9_.-]*$/i.test(repository)) {
    throw new Error('VUE_CODEX_LLM_PUBLISH_REPO must be a GitHub owner/repository name');
  }
  const url = `https://github.com/${repository}`;
  const env = Object.fromEntries(['HOME', 'PATH', 'TMPDIR', 'GH_CONFIG_DIR', 'LANG']
    .filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
  env.GIT_TERMINAL_PROMPT = '0';

  return async (files, originals) => {
    const checkout = await mkdtemp(join(tmpdir(), 'mycode-llm-publish-'));
    const git = async (...args) => (await exec('git', [
      '-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential',
      '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgSign=false',
      '-c', 'user.name=MyCode LLM', '-c', 'user.email=mycode-llm@users.noreply.github.com',
      ...args,
    ], { cwd: checkout, env, timeout: 12000, maxBuffer: 128 * 1024 })).stdout.trim();

    try {
      await git('clone', '--quiet', '--depth=1', '--branch', 'main', '--', `${url}.git`, '.');
      await saveFiles(checkout, files, { originals, allowMissingOriginals: true });
      await git('add', '--force', '--', ...files.keys());
      await git('commit', '--quiet', '-m', originals ? 'Update files from MyCode LLM' : 'Add files from MyCode LLM');
      const commit = await git('rev-parse', 'HEAD');
      const { stdout } = await exec('gh', ['api', `repos/${repository}`, '--jq', '{private, has_pages}'], {
        cwd: checkout, env, timeout: 12000, maxBuffer: 128 * 1024,
      });
      const access = JSON.parse(stdout);
      if (access.private !== true || access.has_pages !== false) throw new Error('The GitHub repository must be private and Pages must be disabled');
      await git('push', 'origin', 'HEAD:refs/heads/main');
      return { commitUrl: `${url}/commit/${commit}` };
    } finally {
      await rm(checkout, { recursive: true, force: true });
    }
  };
}
