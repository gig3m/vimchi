/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Agent worktrees live under .claude/worktrees; never run their copies of the suite.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
  },
  server: {
    port: 5317,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:8080',
      '/auth': 'http://localhost:8080',
    },
  },
});
