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

function photoDraftsProxy() {
  const draftsDir = path.resolve('assets/drafts/generated-photos');

  return {
    name: 'photo-drafts-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.url || '/', 'http://localhost');

        if (requestUrl.pathname === '/api/photo-drafts') {
          try {
            await fs.mkdir(draftsDir, { recursive: true });
            const entries = await fs.readdir(draftsDir, { withFileTypes: true });
            const photos = entries
              .filter((entry) => entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name))
              .map((entry) => ({
                name: entry.name,
                url: `/api/photo-drafts/file?name=${encodeURIComponent(entry.name)}`,
              }))
              .sort((left, right) => right.name.localeCompare(left.name));

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ photos }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: error.message }));
          }
          return;
        }

        if (requestUrl.pathname === '/api/photo-drafts/file') {
          const requestedName = requestUrl.searchParams.get('name') || '';
          const safeName = path.basename(requestedName);

          if (!safeName || safeName !== requestedName || !/\.(png|jpe?g|webp)$/i.test(safeName)) {
            res.statusCode = 400;
            res.end('Invalid photo name');
            return;
          }

          try {
            const image = await fs.readFile(path.join(draftsDir, safeName));
            const extension = path.extname(safeName).toLowerCase();
            const contentType = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'no-store');
            res.end(image);
          } catch (error) {
            res.statusCode = error.code === 'ENOENT' ? 404 : 500;
            res.end(error.code === 'ENOENT' ? 'Photo not found' : error.message);
          }
          return;
        }

        next();
      });
    },
  };
}

function buildPhotoPrompt({ handle, height, assembledWidth, towerSpecs, shot }) {
  const towers = (towerSpecs || []).map((tower) => `${tower.code} ${tower.width}-inch`).join(' + ');
  const cabinetWidth = Number(assembledWidth) || 0;
  const finishedCavityWidth = Number((cabinetWidth + 2).toFixed(2));
  const finishedCavityHeight = Number(height) + 1;
  const towerRules = (towerSpecs || []).map((tower, index) => {
    const code = String(tower.code || '').toUpperCase();
    const prefix = `Tower ${index + 1}, ${code}, ${tower.width}-inch nominal bay:`;
    const rules = {
      LH: 'fixed top and bottom frame shelves; one adjustable upper shelf about 18 inches below the top; exactly one chrome rod directly below that upper shelf; no middle shelf anywhere in the open long-hang bay; absolutely no drawers.',
      DH: 'fixed top and bottom frame shelves; exactly one middle adjustable shelf dividing the bay; exactly two chrome rods, the upper rod directly below the top shelf and the lower rod directly below the middle shelf; absolutely no drawers.',
      HS: 'exactly one chrome rod at the very top/front with NO shelf or cubby above the rod; exactly four lower horizontal shelf boards total including the bottom fixed shelf; absolutely no drawers and no second rod.',
      S3D: 'no rod; exactly three proud overlay drawers, two small drawers above one large drawer, each with one centered horizontal brushed-nickel straight bar pull; upper shelves evenly divide the space above the drawer deck; one adjustable shelf centered in the lower open space.',
      H3D: 'exactly one upper chrome rod above the drawer deck; exactly three proud overlay drawers, two small above one large, each with one centered horizontal brushed-nickel straight bar pull; one adjustable shelf centered in the lower open space.',
      S2D: 'no rod; exactly two small proud overlay drawers, each with one centered horizontal brushed-nickel straight bar pull; upper shelves evenly divide the space above the drawer deck; one adjustable shelf centered in the lower open space.',
      S7: 'no rods and no drawers; exactly seven equal usable open compartments bounded by exactly eight horizontal boards total including top and bottom.',
      S8: 'no rods and no drawers; exactly eight equal usable open compartments bounded by exactly nine horizontal boards total including top and bottom.',
    };

    return `${prefix} ${rules[code] || 'preserve the supplied render exactly.'}`;
  });
  const installedScene = shot.scene === 'reach-in';
  const walkInScene = shot.scene === 'walk-in';
  const doorRule = shot.bifoldDoorSets === 1
    ? 'Use exactly ONE bi-fold door unit total: exactly two hinged panels connected together and folded accordion-style to one jamb only. Do not put a door on the opposite jamb.'
    : shot.bifoldDoorSets === 2
      ? 'Use exactly TWO bi-fold door units total: one two-panel hinged unit folded to the left jamb and one two-panel hinged unit folded to the right jamb.'
      : '';

  return [
    `Create a photorealistic square Shopify product hero for ${handle}.`,
    `The supplied image is the exact geometry source of truth: ${towers}, ${height}-inch height. Preserve every panel, shared divider, shelf, rod, drawer, handle, hanger, and recessed toe kick exactly.`,
    ...towerRules,
    'Important image-reading rule: faint white shapes, repeated hanger shapes, wall projections, and translucent shapes in the source are CAST SHADOWS OR REFLECTIONS, not shelves, towers, rods, cabinets, or drawers. Never turn a shadow or reflection into physical geometry.',
    installedScene
      ? [
          `Install the exact system in a precisely measured fitted reach-in opening. ${doorRule} Keep every door fully folded open.`,
          `The cabinet outside assembled width is exactly ${cabinetWidth} inches. Although the construction cavity can be ${finishedCavityWidth} inches before trim, the VISIBLE FINISHED OPENING in the photograph must equal the cabinet outside width exactly: ${cabinetWidth} inches. Hide all installation allowance completely behind the front casing. The cabinet's left outside panel must visually touch the finished left return, and its right outside panel must visually touch the finished right return. Show no visible filler width at all.`,
          `The cabinet height is exactly ${height} inches. Although the construction cavity can be ${finishedCavityHeight} inches before trim, the VISIBLE FINISHED OPENING height in the photograph must equal the cabinet height exactly: ${height} inches. Hide all top installation allowance behind the front header/casing. The cabinet top board must visually touch the underside of the header across its full width.`,
          'Move the finished jambs, casing, header, track, and door panels tightly inward until the visible opening traces the cabinet perimeter. The interior face of each jamb must be no wider than the 0.75-inch cabinet side-panel edge. Show zero exposed back wall beside or above the cabinet, zero dark side channels, zero broad filler panels, and zero unused reach-in floor area around the product.',
          'Critical visual test: if any strip of interior wall is visible between an outside cabinet panel and a door jamb, or between the cabinet top and header, the opening is still too large and must be tightened further.',
        ].join(' ')
      : walkInScene
        ? 'Show the exact system as a walk-in closet product hero with a minimal warm wall and floor environment.'
        : 'Show the exact system alone as a clean centered product hero with a minimal warm wall and floor environment and no doors.',
    'Use a 1:1 composition. Center the complete product and let it occupy 80-88% of the frame height. Keep the full top, sides, and toe kicks visible.',
    'White satin melamine, soft warm daylight, realistic chrome and brushed-nickel hardware, straight verticals, subtle shadows. Replace the source render lattice-style hanger placeholders with realistically proportional matte-black adult clothes hangers on the visible front rod plane.',
    'No invented modules, extra shelves, missing shelves, duplicate divider, altered widths, inset drawers, round knobs, oversized hangers, deep-set rods, props, furniture, artwork, text, logo, or watermark.',
  ].join('\n');
}

async function getNextDraftFilename(draftsDir, requestedFilename) {
  const base = String(requestedFilename || 'photo.png').replace(/\.png$/i, '').replace(/-draft-v\d+$/i, '');
  const rejectedDir = path.resolve('assets/drafts/rejected/auto-generation');
  const [activeEntries, rejectedEntries] = await Promise.all([
    fs.readdir(draftsDir, { withFileTypes: true }),
    fs.readdir(rejectedDir, { withFileTypes: true }).catch((error) => (error.code === 'ENOENT' ? [] : Promise.reject(error))),
  ]);
  const entries = [...activeEntries, ...rejectedEntries];
  const pattern = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-draft-v(\\d+)\\.png$`, 'i');
  const versions = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name.match(pattern))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  const nextVersion = versions.length ? Math.max(...versions) + 1 : 1;
  return `${base}-draft-v${nextVersion}.png`;
}

function photoGenerationProxy(env) {
  const draftsDir = path.resolve('assets/drafts/generated-photos');
  const requestsDir = path.resolve('assets/drafts/photo-generation-requests');

  return {
    name: 'photo-generation-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0];

        if (pathname !== '/api/generate-photos') {
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
          const payload = JSON.parse((await readRequestBody(req)) || '{}');
          const sourceMatch = String(payload.geometryDataUrl || '').match(/^data:image\/png;base64,(.+)$/);
          const shots = Array.isArray(payload.shots) ? payload.shots : [];
          const handle = String(payload.handle || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

          if (!handle || !sourceMatch || shots.length === 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing handle, geometry capture, or photo set.' }));
            return;
          }

          await Promise.all([fs.mkdir(draftsDir, { recursive: true }), fs.mkdir(requestsDir, { recursive: true })]);
          const sourceBuffer = Buffer.from(sourceMatch[1], 'base64');
          const requestId = `${handle}-${Date.now()}`;
          const sourcePath = path.join(requestsDir, `${requestId}-geometry.png`);
          await fs.writeFile(sourcePath, sourceBuffer);
          await fs.writeFile(
            path.join(requestsDir, `${requestId}.json`),
            JSON.stringify({ ...payload, geometryDataUrl: undefined, requestId, createdAt: new Date().toISOString() }, null, 2),
            'utf8',
          );

          const directOpenAiKey = env.OPENAI_API_KEY;
          const gatewayCredential = env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN;
          const imageCredential = directOpenAiKey || gatewayCredential;

          if (!imageCredential) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: 'Photo generation is not configured. Add OPENAI_API_KEY, AI_GATEWAY_API_KEY, or a fresh VERCEL_OIDC_TOKEN, then restart the local app.',
              requestSaved: true,
              requestId,
            }));
            return;
          }

          const generated = [];
          for (const shot of shots) {
            const prompt = buildPhotoPrompt({ ...payload, handle, shot });
            let response;
            let result;
            let imageBase64;

            if (directOpenAiKey) {
              const form = new FormData();
              form.append('model', 'gpt-image-2');
              form.append('image', new Blob([sourceBuffer], { type: 'image/png' }), `${handle}-geometry.png`);
              form.append('prompt', prompt);
              form.append('size', '2048x2048');
              form.append('quality', 'high');
              form.append('output_format', 'png');

              response = await fetch('https://api.openai.com/v1/images/edits', {
                method: 'POST',
                headers: { Authorization: `Bearer ${directOpenAiKey}` },
                body: form,
              });
              result = await response.json();
              imageBase64 = result.data?.[0]?.b64_json;
            } else {
              response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${gatewayCredential}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'google/gemini-3-pro-image',
                  modalities: ['text', 'image'],
                  messages: [
                    {
                      role: 'user',
                      content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: payload.geometryDataUrl } },
                      ],
                    },
                  ],
                }),
              });
              result = await response.json();
              const imageDataUrl = result.choices?.[0]?.message?.images?.[0]?.image_url?.url || '';
              imageBase64 = imageDataUrl.match(/^data:image\/(?:png|jpe?g|webp);base64,(.+)$/)?.[1];
            }

            if (!response.ok) {
              throw new Error(result.error?.message || `Image generation returned ${response.status}`);
            }

            if (!imageBase64) throw new Error('The image service returned no image data.');

            const filename = await getNextDraftFilename(draftsDir, shot.filename || `${handle}-${shot.id}.png`);
            await fs.writeFile(path.join(draftsDir, filename), Buffer.from(imageBase64, 'base64'));
            generated.push({ filename, shot: shot.id });
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, requestId, generated }));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },
  };
}

function removeProductionInternalAssets(enabled) {
  return {
    name: 'remove-production-internal-assets',
    apply: 'build',
    async closeBundle() {
      if (!enabled) return;

      await Promise.all([
        fs.rm(path.resolve(__dirname, 'dist/internal-renderer.html'), { force: true }),
        fs.rm(path.resolve(__dirname, 'dist/internal-renderer-style-guide.md'), { force: true }),
        fs.rm(path.resolve(__dirname, 'dist/shopify-photo-workflow.md'), { force: true }),
      ]);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const includeInternalRenderer = mode !== 'production' || env.BUILD_INTERNAL_RENDERER === 'true';
  const publicProductionBuild = mode === 'production' && !includeInternalRenderer;
  const input = {
    main: path.resolve(__dirname, 'index.html'),
    walkin: path.resolve(__dirname, 'walkin.html'),
  };

  if (includeInternalRenderer) {
    input.internalRenderer = path.resolve(__dirname, 'internal-renderer.html');
  }

  return {
    plugins: [
      quoteRequestProxy(env),
      photoDraftsProxy(),
      photoGenerationProxy(env),
      resolvedPartsProxy(env),
      airtableProxy(env),
      removeProductionInternalAssets(publicProductionBuild),
      react(),
    ],
    server: {
      host: 'localhost',
      port: 5173,
    },
    build: {
      rollupOptions: {
        input,
      },
    },
  };
});
