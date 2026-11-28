// Pass the *pre-agreed* file list, not a list generated from the working diff.
// Includes staged, unstaged, deleted, both sides of renames and nonignored new files.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function outsideScope(paths, allowed) {
  const set = new Set(allowed);
  return [...new Set(paths)].filter(path => !set.has(path)).sort();
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [base, ...allowed] = process.argv.slice(2);
  if (!base || !/^(HEAD|[0-9a-f]{40})$/.test(base) || !allowed.length) {
    console.error('Usage (from repo root): node scripts/check-edit-scope.mjs HEAD|<full-base-sha> path/to/file [...]');
    process.exit(2);
  }
  const binary = process.env.GIT_EXECUTABLE || 'git';
  const git = args => execFileSync(binary, args, { encoding:'utf8' }).trimEnd();
  if (git(['rev-parse','--show-prefix'])) throw Error('Run from repository root');
  const names = args => git(args).split('\0').filter(Boolean);
  const changed = [...names(['diff','--no-renames','--name-only','-z',base,'--']),
    ...names(['ls-files','--others','--exclude-standard','-z','--'])];
  const outside = outsideScope(changed, allowed);
  if (outside.length) {
    console.error('Outside the agreed edit scope:\n' + outside.join('\n'));
    process.exitCode = 1;
  } else console.log('Scope OK:',new Set(changed).size,'changed paths');
}
