import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const config = readFileSync(new URL('../astro.config.mjs', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export default', 'globalThis.config =');

for (const [env, expected] of [[{}, '/'], [{ ASTRO_BASE_PATH: '/th_portfolio/' }, '/th_portfolio/']]) {
  test(`actual Astro config retains static output at ${expected}`, () => {
    const context = vm.createContext({ process: { env }, defineConfig: (value) => value, tailwindcss: () => ({}) });
    vm.runInContext(config, context);
    assert.equal(context.config.base, expected);
    assert.equal(context.config.output, 'static');
    assert.equal(context.config.vite.plugins.length, 1);
  });
}

test('existing Pages build step supplies the deployment base', () => {
  const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  const build = workflow.match(/      - name: Install, build, and upload with Astro\r?\n([\s\S]*?)(?=\n  deploy:)/)?.[1];
  assert.ok(build);
  assert.match(build, /uses: withastro\/action@v3/);
  assert.match(build, /env:\s+ASTRO_BASE_PATH: \/th_portfolio\//);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /needs: build/);
});
