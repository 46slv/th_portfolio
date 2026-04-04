import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  // あなたの取得した独自ドメインを記入
  site: 'https://Talich Helfen.com', 

  // 独自ドメインでトップに置くなら、baseは削除またはコメントアウト
  // base: '/th_portfolio', 

  vite: {
    plugins: [tailwindcss()],
  },
  adapter: cloudflare(),
});
