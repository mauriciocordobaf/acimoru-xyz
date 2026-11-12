import { defineConfig } from 'astro/config';
import editor from './editor/integration.mjs';

export default defineConfig({
  site: 'https://acimoru.xyz',
  build: { inlineStylesheets: 'always' },
  devToolbar: { enabled: false },
  // Editor visual privado: solo en `npm run dev`, en /admin. No se publica.
  integrations: [editor()],
});
