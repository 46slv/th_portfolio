import { defineConfig } from 'astro/config';
<<<<<<< HEAD
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://46silverd.com',
  // baseの行は書かない
  vite: {
    plugins: [tailwindcss()],
  },
=======
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
>>>>>>> 9f1dbef (fix: remove base path)
  adapter: cloudflare(),
});
