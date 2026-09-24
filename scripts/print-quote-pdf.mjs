import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const [, , source, output] = process.argv;

if (!source || !output) {
  console.error('Usage: node scripts/print-quote-pdf.mjs <url-or-html-file> <output.pdf>');
  process.exit(1);
}

const edgeCandidates = [
  process.env.EDGE_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

async function firstExisting(paths) {
  for (const candidate of paths) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next known install path.
    }
  }
  return '';
}

function sourceToUrl(value) {
  if (/^https?:\/\//i.test(value) || /^file:\/\//i.test(value)) return value;
  const absolute = path.resolve(value).replaceAll('\\', '/');
  return `file:///${absolute}`;
}

const edgePath = await firstExisting(edgeCandidates);
if (!edgePath) {
  console.error('Microsoft Edge was not found. Set EDGE_PATH to the browser executable.');
  process.exit(1);
}

const outputPath = path.resolve(output);
await fs.mkdir(path.dirname(outputPath), { recursive: true });

const args = [
  '--headless=new',
  '--disable-gpu',
  '--no-pdf-header-footer',
  `--print-to-pdf=${outputPath}`,
  sourceToUrl(source),
];

const child = spawn(edgePath, args, { stdio: 'inherit', windowsHide: true });
const code = await new Promise((resolve) => child.on('exit', resolve));
if (code !== 0) process.exit(code || 1);

let stats;
try {
  stats = await fs.stat(outputPath);
} catch {
  console.error(`PDF was not created: ${outputPath}`);
  process.exit(1);
}

if (stats.size <= 0) {
  console.error(`PDF was created but is empty: ${outputPath}`);
  process.exit(1);
}

console.log(`PDF created: ${outputPath} (${stats.size} bytes)`);
