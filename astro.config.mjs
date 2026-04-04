import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';

// https://[ユーザー名].github.io/[リポジトリ名] の形式にします
export default defineConfig({
  site: 'https://46slv.github.io',

  // リポジトリ名をここに入れます
  base: '/th_portfolio',

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: cloudflare(),
});