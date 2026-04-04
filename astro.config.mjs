import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://46silverd.com',
  // baseの行は書かない
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: cloudflare(),
});
