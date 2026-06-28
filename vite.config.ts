import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { cloudflare } from "@cloudflare/vite-plugin";

// The markdown question banks live in /assets (outside src). They are pulled in
// at build time via import.meta.glob('/assets/*.md', { query: '?raw' }).
export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    host: true,
  },
});