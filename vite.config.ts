import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function normalizeBasePath(value?: string): string {
  const path = value?.trim();
  if (!path || path === '/') return '/';
  if (path.includes('://') || path.startsWith('.')) {
    throw new Error('VITE_BASE_PATH must be a root-relative path, such as /Deviations/.');
  }
  return `/${path.replace(/^\/+|\/+$/g, '')}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: normalizeBasePath(env.VITE_BASE_PATH),
    plugins: [react()],
  };
});
