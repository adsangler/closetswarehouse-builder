import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { timingSafeEqual } from 'node:crypto';

loadLocalEnv();

const rootDir = process.cwd();
const distDir = resolve(rootDir, 'dist');
const port = Number(process.env.PORT || 8080);

const airtableTables = {
  '/api/kits': 'AIRTABLE_KITS_TABLE',
  '/api/parts': 'AIRTABLE_PARTS_TABLE',
  '/api/kit-parts': 'AIRTABLE_KIT_PARTS_TABLE',
};

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

createServer(async (req, res) => {
  const pathname = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname;

  if (!isAuthorized(req)) {
    res.writeHead(401, {
      'Content-Type': 'text/plain; charset=utf-8',
      'WWW-Authenticate': 'Basic realm="Closets Warehouse Renderer"',
    });
    res.end('Authentication required');
    return;
  }

  if (airtableTables[pathname]) {
    await handleAirtableRequest(pathname, res);
    return;
  }

  serveStatic(pathname, res);
}).listen(port, () => {
  console.log(`Closets Warehouse Renderer running on http://localhost:${port}`);
});

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), '.env');

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);

    if (!match || process.env[match[1]]) {
      continue;
    }

    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function isAuthorized(req) {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD;

  if (!expectedUser && !expectedPassword) {
    return true;
  }

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');

  if (scheme !== 'Basic' || !encoded) {
    return false;
  }

  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const separatorIndex = decoded.indexOf(':');

  if (separatorIndex === -1) {
    return false;
  }

  return safeEqual(decoded.slice(0, separatorIndex), expectedUser || '') &&
    safeEqual(decoded.slice(separatorIndex + 1), expectedPassword || '');
}

function safeEqual(actual, expected) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

async function handleAirtableRequest(pathname, res) {
  const tableEnvKey = airtableTables[pathname];
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env[tableEnvKey];

  if (!token || !baseId || !tableName) {
    sendJson(res, 500, { error: `Missing Airtable env config for ${pathname}` });
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

    sendJson(res, 200, { records });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

function serveStatic(pathname, res) {
  const requestPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = normalize(join(distDir, requestPath));

  if (!filePath.startsWith(distDir) || !existsSync(filePath)) {
    serveStatic('/index.html', res);
    return;
  }

  res.writeHead(200, {
    'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
  });
  createReadStream(filePath).pipe(res);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(payload));
}
