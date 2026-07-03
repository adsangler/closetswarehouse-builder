import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const airtableTables = {
  '/api/kits': 'AIRTABLE_KITS_TABLE',
  '/api/parts': 'AIRTABLE_PARTS_TABLE',
  '/api/kit-parts': 'AIRTABLE_KIT_PARTS_TABLE',
};

function airtableProxy(env) {
  return {
    name: 'airtable-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0];
        const tableEnvKey = airtableTables[pathname];

        if (!tableEnvKey) {
          next();
          return;
        }

        const token = env.AIRTABLE_TOKEN;
        const baseId = env.AIRTABLE_BASE_ID;
        const tableName = env[tableEnvKey];

        if (!token || !baseId || !tableName) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `Missing Airtable env config for ${pathname}` }));
          return;
        }

        const records = [];
        let offset;

        try {
          do {
            const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`);
            url.searchParams.set('pageSize', '100');

            if (offset) {
              url.searchParams.set('offset', offset);
            }

            const response = await fetch(url, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (!response.ok) {
              throw new Error(`Airtable returned ${response.status}`);
            }

            const payload = await response.json();
            records.push(...payload.records);
            offset = payload.offset;
          } while (offset);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ records }));
        } catch (error) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },
  };
}

function loadLocalEnvFile() {
  const envPath = resolve(process.cwd(), '.env');
  const env = {};

  if (!existsSync(envPath)) {
    return env;
  }

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);

    if (match) {
      env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }

  return env;
}

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, process.cwd(), ''),
    ...loadLocalEnvFile(),
  };

  return {
    plugins: [airtableProxy(env), react()],
    server: {
      host: 'localhost',
      port: 5173,
    },
  };
});
