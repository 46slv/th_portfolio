import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://[ユーザー名].github.io/[リポジトリ名] の形式にします
export default defineConfig({
  site: 'https://46slv.github.io',
  base: '/th_portfolio', // リポジトリ名をここに入れます
  vite: {
    plugins: [tailwindcss()],
  },
});