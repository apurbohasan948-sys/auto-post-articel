import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, Plugin } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function integrationProxyPlugin(): Plugin {
  return {
    name: 'integration-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req, res) => {
        if (req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk) => {
            bodyStr += chunk;
          });
          req.on('end', async () => {
            try {
              const { url, method = 'GET', headers = {}, body } = JSON.parse(bodyStr || '{}');
              if (!url) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Missing target url in proxy request' }));
                return;
              }

              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 15000);

              const fetchOptions: RequestInit = {
                method,
                headers: {
                  ...headers,
                },
                signal: controller.signal,
              };

              if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
                fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
              }

              const response = await fetch(url, fetchOptions);
              clearTimeout(timeout);

              const contentType = response.headers.get('content-type') || '';
              let data: any;
              if (contentType.includes('application/json')) {
                data = await response.json();
              } else {
                data = await response.text();
              }

              res.statusCode = response.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  status: response.status,
                  statusText: response.statusText,
                  ok: response.ok,
                  data,
                })
              );
            } catch (err: any) {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  status: 502,
                  ok: false,
                  error: err?.message || 'Proxy request failed',
                  isTimeout: err?.name === 'AbortError',
                })
              );
            }
          });
        } else {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), integrationProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
