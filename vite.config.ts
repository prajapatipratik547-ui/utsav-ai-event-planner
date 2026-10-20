import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';

/** Mounts the serverless API on the dev and preview servers, with keys from .env.local. */
function localApi(mode: string): Plugin {
  const mount = async ({ middlewares }: { middlewares: Connect.Server }) => {
    Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
    const { apiDevMiddleware } = await import('./server/devMiddleware.js');
    middlewares.use((req, res, next) => void apiDevMiddleware(req, res, next));
  };
  return { name: 'utsav-local-api', configureServer: mount, configurePreviewServer: mount };
}

/**
 * `vite preview` serves the same security headers as production (vercel.json),
 * so the Content-Security-Policy is exercised locally before every deploy.
 * `upgrade-insecure-requests` is dropped because preview runs on plain http.
 */
function productionHeaders(): Record<string, string> {
  const config = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const global = config.headers.find((h) => h.source === '/(.*)')?.headers ?? [];
  return Object.fromEntries(
    global
      .filter((h) => h.key !== 'Strict-Transport-Security')
      .map((h) => [h.key, h.value.replace(/;\s*upgrade-insecure-requests/, '')]),
  );
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), localApi(mode)],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173, headers: productionHeaders() },
  build: { target: 'es2022', sourcemap: false },
}));
