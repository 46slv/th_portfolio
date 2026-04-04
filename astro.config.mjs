import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  // ここをあなたのドメインに書き換えてください。末尾にスラッシュは不要です。
  site: 'https://46silverd.com', 
  
  // Cloudflare Pages（独自ドメイン）で公開する場合、baseは不要です。
  // base: '/th_portfolio', 

  vite: {
    plugins: [tailwindcss()],
  },
  
  // CloudflareでSSRや高度な機能を使うために必要です
  adapter: cloudflare(),
});
