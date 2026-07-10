import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('assets/photo-library/private');
const inbox = path.join(root, 'inbox');
const catalogPath = path.join(root, 'catalog.json');
const supportedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tif', '.tiff']);

await Promise.all([
  mkdir(inbox, { recursive: true }),
  mkdir(path.join(root, 'curated'), { recursive: true }),
  mkdir(path.join(root, 'rejected'), { recursive: true }),
]);

let previousCatalog = { photos: [] };
try {
  previousCatalog = JSON.parse(await readFile(catalogPath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const previousByHash = new Map((previousCatalog.photos || []).map((photo) => [photo.sha256, photo]));
const entries = await readdir(inbox, { withFileTypes: true });
const files = entries
  .filter((entry) => entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase()))
  .sort((left, right) => left.name.localeCompare(right.name));

const photos = [];
for (const file of files) {
  const absolutePath = path.join(inbox, file.name);
  const [buffer, details] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const previous = previousByHash.get(sha256);

  photos.push({
    id: previous?.id || randomUUID(),
    file: path.relative(root, absolutePath).replaceAll('\\', '/'),
    bytes: details.size,
    sha256,
    role: previous?.role || 'unreviewed',
    permission: previous?.permission || 'unconfirmed',
    quality: previous?.quality || 'unrated',
    sku: previous?.sku || '',
    configurations: previous?.configurations || [],
    heightInches: previous?.heightInches || null,
    towerCount: previous?.towerCount || null,
    camera: previous?.camera || 'unknown',
    lighting: previous?.lighting || 'unknown',
    containsPeople: previous?.containsPeople || false,
    containsPrivateInformation: previous?.containsPrivateInformation || false,
    notes: previous?.notes || '',
  });
}

const duplicates = [...photos.reduce((groups, photo) => {
  const group = groups.get(photo.sha256) || [];
  group.push(photo.file);
  groups.set(photo.sha256, group);
  return groups;
}, new Map()).entries()]
  .filter(([, matchingFiles]) => matchingFiles.length > 1)
  .map(([sha256, matchingFiles]) => ({ sha256, files: matchingFiles }));

const catalog = {
  version: 1,
  generatedAt: new Date().toISOString(),
  inbox: 'inbox',
  summary: {
    supportedPhotos: photos.length,
    duplicateGroups: duplicates.length,
    needsPermissionReview: photos.filter((photo) => photo.permission === 'unconfirmed').length,
  },
  duplicates,
  photos,
};

await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

console.log(`Photo library ready: ${root}`);
console.log(`Inbox photos: ${photos.length}`);
console.log(`Duplicate groups: ${duplicates.length}`);
console.log(`Catalog: ${catalogPath}`);
