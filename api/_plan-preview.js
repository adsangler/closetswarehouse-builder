import { buildTowerLayout } from '../src/towerLayout.js';

const panel = 0.75;
const depth = 14;
const kick = 5;
const overlay = panel / 2 - 1 / 16;
const width = 800;
const labels = { back: 'Back wall', left: 'Left wall', right: 'Right wall', leftReturn: 'Left return', rightReturn: 'Right return' };
const project = (x, y, z) => [x - z * 0.43, -y + z * 0.22];
const point = (x, y) => `${x.toFixed(2)},${y.toFixed(2)}`;

function polygon(points, fill) {
  return `<polygon points="${points.map(([x, y]) => point(x, y)).join(' ')}" fill="${fill}"/>`;
}

function board(x, y, z, w, h, d, colors = ['#f6f5ee', '#c9c6ba', '#fffdf5']) {
  const a = project(x, y, z + d);
  const b = project(x + w, y, z + d);
  const c = project(x + w, y + h, z + d);
  const e = project(x, y + h, z + d);
  const f = project(x + w, y, z);
  const g = project(x + w, y + h, z);
  const j = project(x, y + h, z);
  return polygon([a, b, c, e], colors[0])
    + polygon([b, f, g, c], colors[1])
    + polygon([e, c, g, j], colors[2]);
}

function drawRun({ towers, height, wall }, x, y, cellWidth, cellHeight) {
  const runWidth = towers.reduce((total, tower) => total + tower.width + panel, panel);
  const scale = Math.min((cellWidth - 48) / (runWidth + depth * 0.43 + 4), (cellHeight - 64) / (height + depth * 0.22 + 4));
  const centerX = (runWidth - depth * 0.43) / 2;
  const centerY = (-height + depth * 0.22) / 2;
  const parts = [];
  const fronts = [];
  let cursor = 0;
  for (const tower of towers) {
    const bayX = cursor + panel;
    const pantry = tower.code === 'PN' || tower.code === 'PN2D';
    const layout = buildTowerLayout({ height: pantry ? 72 : height === 72 ? 84 : height }, { ...tower, bayX });
    parts.push(board(cursor, 0, 0, panel, height, depth));
    if (!pantry) parts.push(board(bayX, 0, depth - 3, tower.width, kick, panel));
    for (const shelf of layout.shelves) {
      parts.push(board(bayX, shelf.y, 0, tower.width, panel, depth));
    }
    for (const rod of layout.rods) {
      parts.push(board(bayX, rod.y - 0.5, depth - 1.75, tower.width, 1, 1, ['#a4a5a0', '#777c76', '#d8dcd5']));
    }
    for (const drawer of layout.drawers) {
      fronts.push(board(bayX - overlay, drawer.centerY - drawer.height / 2, depth, tower.width + overlay * 2, drawer.height, panel));
      fronts.push(board(bayX + tower.width / 2 - 2.75, drawer.centerY - 0.25, depth + 1.2, 5.5, 0.5, 0.5,
        ['#a6aaa3', '#777c76', '#d8dcd5']));
    }
    cursor += tower.width + panel;
  }
  parts.push(board(cursor, 0, 0, panel, height, depth));
  parts.push(...fronts);
  return `<g transform="translate(${x + cellWidth / 2} ${y + (cellHeight - 24) / 2}) scale(${scale}) translate(${-centerX} ${-centerY})" stroke="#938f83" stroke-width=".28" stroke-linejoin="round">${parts.join('')}</g>
    ${wall ? `<text x="${x + cellWidth / 2}" y="${y + cellHeight - 17}" text-anchor="middle">${labels[wall]}</text>` : ''}`;
}

export function renderPlanPreview(groups) {
  const columns = groups.length === 1 ? 1 : 2;
  const cellHeight = groups.length === 1 ? 600 : 300;
  const height = Math.ceil(groups.length / columns) * cellHeight;
  const cellWidth = width / columns;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
    <title>3D preview of closet tower runs</title><rect width="100%" height="100%" fill="#f1eee6"/>
    <g font-family="system-ui,sans-serif" font-size="16" fill="#48483f">
    ${groups.map((group, index) => drawRun(group, index % columns * cellWidth, Math.floor(index / columns) * cellHeight, cellWidth, cellHeight)).join('')}
    </g></svg>`;
}
