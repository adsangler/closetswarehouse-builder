import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import convert from 'heic-convert';

const inbox = path.resolve('assets/photo-library/private/inbox');
const output = path.resolve('assets/photo-library/private/converted-jpg');
const supportedExtensions = new Set(['.heic', '.heif']);

await mkdir(output, { recursive: true });

const entries = await readdir(inbox, { withFileTypes: true });
const seenHashes = new Set();
let converted = 0;
let duplicates = 0;

for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
  if (!entry.isFile() || !supportedExtensions.has(path.extname(entry.name).toLowerCase())) continue;

  const inputPath = path.join(inbox, entry.name);
  const input = await readFile(inputPath);
  const hash = createHash('sha256').update(input).digest('hex');

  if (seenHashes.has(hash)) {
    duplicates += 1;
    continue;
  }

  seenHashes.add(hash);
  const jpg = await convert({ buffer: input, format: 'JPEG', quality: 0.94 });
  const baseName = path.basename(entry.name, path.extname(entry.name)).replace(/ \(1\)$/, '');
  const outputPath = path.join(output, `${baseName}.jpg`);
  await writeFile(outputPath, jpg);
  converted += 1;
  console.log(`${entry.name} -> ${path.basename(outputPath)}`);
}

console.log(`Converted ${converted} unique HEIC files; skipped ${duplicates} duplicates.`);
