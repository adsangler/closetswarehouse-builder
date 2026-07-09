import fs from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { buildResolvedParts } from './api/_part-pricing.js';

const airtableTables = {
  '/api/kits': 'AIRTABLE_KITS_TABLE',
  '/api/parts': 'AIRTABLE_PARTS_TABLE',
  '/api/kit-parts': 'AIRTABLE_KIT_PARTS_TABLE',
  '/api/components': 'AIRTABLE_COMPONENTS_TABLE',
  '/api/part-components': 'AIRTABLE_PART_COMPONENTS_TABLE',
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

async function fetchAirtableRecords(env, tableEnvKey) {
  const token = env.AIRTABLE_TOKEN;
  const baseId = env.AIRTABLE_BASE_ID;
  const tableName = env[tableEnvKey];

  if (!token || !baseId || !tableName) {
    throw new Error(`Missing Airtable env config for ${tableEnvKey}`);
  }

  const records = [];
  let offset;

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

  return records;
}

function resolvedPartsProxy(env) {
  return {
    name: 'resolved-parts-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0];

        if (pathname !== '/api/parts-resolved') {
          next();
          return;
        }

        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const [parts, components, partComponents] = await Promise.all([
            fetchAirtableRecords(env, 'AIRTABLE_PARTS_TABLE'),
            fetchAirtableRecords(env, 'AIRTABLE_COMPONENTS_TABLE'),
            fetchAirtableRecords(env, 'AIRTABLE_PART_COMPONENTS_TABLE'),
          ]);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ records: buildResolvedParts({ parts, components, partComponents }) }));
        } catch (error) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },
  };
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function createAirtableQuote(env, quote) {
  const token = env.AIRTABLE_TOKEN;
  const baseId = env.AIRTABLE_BASE_ID;
  const tableName = env.AIRTABLE_QUOTES_TABLE;

  if (!token || !baseId || !tableName) {
    return null;
  }

  let response;

  try {
    response = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          Name: quote.customer?.name || '',
          Email: quote.customer?.email || '',
          Phone: quote.customer?.phone || '',
          Status: 'New',
          Source: 'Closet planner',
          'Wall Width': quote.wallWidth,
          Height: quote.height,
          'Assembled Width': quote.assembledWidth,
          'Required Width': quote.requiredWidth,
          'Estimated Price': quote.estimatedPrice,
          Signature: quote.signature,
          Modules: quote.modules?.map((module) => `${module.code}-${module.width}`).join(', '),
          'Quote JSON': JSON.stringify(quote),
        },
      }),
    });
  } catch {
    return null;
  }

  if (response.status === 403 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Airtable quote capture returned ${response.status}`);
  }

  return response.json();
}

async function sendConfirmationEmail(env, quote) {
  if (!env.EMAIL_WEBHOOK_URL) {
    return { sent: false, reason: 'EMAIL_WEBHOOK_URL is not configured' };
  }

  const planLines = [
    `Reference: ${quote.quoteId || 'pending'}`,
    `Customer: ${quote.customer?.name || ''}`,
    `Email: ${quote.customer?.email || ''}`,
    `Phone: ${quote.customer?.phone || ''}`,
    `Type: ${quote.planType || quote.internalType || 'closet plan'}`,
    `Estimated price: ${quote.estimatedPrice || ''}`,
    `Signature: ${quote.signature || ''}`,
    quote.planUrl ? `Plan URL: ${quote.planUrl}` : '',
    '',
    'Modules:',
    ...(quote.modules || []).map((module) => `${module.wall ? `${module.wall}: ` : ''}${module.index + 1}. ${module.code}-${module.width}`),
  ].filter(Boolean);

  const response = await fetch(env.EMAIL_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: 'office@closetswarehouse.com',
      subject: `Closets Warehouse estimate verification: ${quote.customer?.name || quote.quoteId || 'new request'}`,
      text: planLines.join('\n'),
      quote,
    }),
  });

  if (!response.ok) {
    throw new Error(`Email webhook returned ${response.status}`);
  }

  return { sent: true };
}

function quoteRequestProxy(env) {
  return {
    name: 'quote-request-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0];

        if (pathname !== '/api/quote-requests') {
          next();
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const body = await readRequestBody(req);
          const quote = JSON.parse(body || '{}');
          const submittedAt = new Date().toISOString();
          const quoteId = `quote-${submittedAt.replace(/[:.]/g, '-')}`;
          const capturedQuote = { ...quote, quoteId, submittedAt };

          const airtableRecord = await createAirtableQuote(env, capturedQuote);
          const captureMode = airtableRecord ? 'airtable' : 'local';

          if (!airtableRecord) {
            const outDir = path.resolve('assets/drafts/quote-requests');
            await fs.mkdir(outDir, { recursive: true });
            await fs.writeFile(path.join(outDir, `${quoteId}.json`), JSON.stringify(capturedQuote, null, 2), 'utf8');
          }

          const email = await sendConfirmationEmail(env, capturedQuote);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, quoteId, captureMode, email }));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [quoteRequestProxy(env), resolvedPartsProxy(env), airtableProxy(env), react()],
    server: {
      host: 'localhost',
      port: 5173,
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          internalRenderer: path.resolve(__dirname, 'internal-renderer.html'),
          walkin: path.resolve(__dirname, 'walkin.html'),
        },
      },
    },
  };
});
