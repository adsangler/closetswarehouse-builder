import { adjustableShelfCount, shelfTowerFixedShelves } from './shelfCounts.js';

const panelThickness = 0.75;
const toeKickHeight = 5;

function buildAdjustableShelves(drawing, count, bottom = toeKickHeight + panelThickness, top = drawing.height - panelThickness) {
  const gap = (top - bottom) / (count + 1);

  return Array.from({ length: count }, (_, index) => ({
    y: bottom + gap * (index + 1),
    fixed: false,
  }));
}

function buildDrawers(code) {
  if (code === 'S2D') {
    return [
      { label: 'Small drawer', centerY: 43.35, height: 5 },
      { label: 'Small drawer', centerY: 38.15, height: 5 },
    ];
  }

  return [
    { label: 'Small drawer', centerY: 43.35, height: 5 },
    { label: 'Small drawer', centerY: 38.15, height: 5 },
    { label: 'Large drawer', centerY: 30.55, height: 10 },
  ];
}

function getDrawerBounds(drawers) {
  return drawers.reduce(
    (bounds, drawer) => ({
      top: Math.max(bounds.top, drawer.centerY + drawer.height / 2),
      bottom: Math.min(bounds.bottom, drawer.centerY - drawer.height / 2),
    }),
    { top: -Infinity, bottom: Infinity },
  );
}

export function buildTowerLayout(drawing, tower) {
  const topShelf = drawing.height - panelThickness;
  const bottomShelf = toeKickHeight;
  const standardHeightTopShelf = 84 - panelThickness;
  const s2dDrawerTop = getDrawerBounds(buildDrawers('S2D')).top;
  const drawerDeck = tower.code === 'S2D' ? s2dDrawerTop : 46;
  const longHangShelfY = 84 - 18;
  const rodDropBelowShelf = 4.5;
  const longHangRodY = longHangShelfY - rodDropBelowShelf;
  const hsLowerShelfTopY = drawing.height >= 96 ? 52 : 43;
  const hasTallHeight = drawing.height >= 96;
  const adjustableCount = drawing.height === 72 && (tower.code === 'PN' || tower.code === 'PN2D')
    ? 2
    : adjustableShelfCount(tower.code, drawing.height);

  const shelves = [
    { y: bottomShelf, fixed: true },
    ...buildAdjustableShelves(drawing, adjustableCount),
    { y: topShelf, fixed: true },
  ];
  const rods = [];
  const drawers = [];

  if (tower.code === 'PN2D') {
    const pantryDeck = 16.125;
    return {
      shelves: [{ y: bottomShelf, fixed: true }, { y: pantryDeck, fixed: false },
        { y: (pantryDeck + panelThickness + topShelf) / 2, fixed: false }, { y: topShelf, fixed: true }],
      rods, drawers: [{ label: 'Slim drawer', centerY: 8.375, height: 5 },
        { label: 'Slim drawer', centerY: 13.5, height: 5 }], drawerDeck: pantryDeck,
    };
  }

  if (tower.code === 'FR') {
    return {
      shelves: [
        { y: bottomShelf, fixed: false },
        { y: (bottomShelf + topShelf) / 2, fixed: true },
        { y: topShelf, fixed: true },
      ],
      rods, drawers, drawerDeck,
    };
  }

  if (tower.code === 'LH') {
    return {
      shelves: [
        { y: bottomShelf, fixed: false },
        { y: longHangShelfY, fixed: true },
        ...(hasTallHeight ? [{ y: standardHeightTopShelf, fixed: false }] : []),
        { y: topShelf, fixed: true },
      ],
      rods: [{ label: 'Long hang rod', y: longHangRodY, bayX: tower.bayX, width: tower.width }],
      drawers,
      drawerDeck,
    };
  }

  if (tower.code === 'HS') {
    return {
      shelves: [
        { y: bottomShelf, fixed: false },
        ...buildAdjustableShelves(drawing, adjustableCount, bottomShelf, hsLowerShelfTopY)
          .map((shelf, index) => ({ ...shelf, fixed: index === adjustableCount - 1 })),
        { y: topShelf, fixed: true },
      ],
      rods: [{ label: 'Hang rod', y: drawing.height - 8.5, bayX: tower.bayX, width: tower.width }],
      drawers,
      drawerDeck,
    };
  }

  if (tower.code === 'H3D') {
    const lowerShelfYs = hasTallHeight
      ? buildAdjustableShelves(drawing, adjustableCount - 1, bottomShelf, getDrawerBounds(buildDrawers(tower.code)).bottom)
      : [{ y: 14.35, fixed: false }];
    return {
      shelves: [
        { y: bottomShelf, fixed: false },
        ...lowerShelfYs,
        { y: drawerDeck, fixed: true },
        { y: topShelf, fixed: true },
      ],
      rods: [{ label: 'Hang rod', y: drawing.height - 7.5, bayX: tower.bayX, width: tower.width }],
      drawers: buildDrawers(tower.code),
      drawerDeck,
    };
  }

  if (tower.code === 'DH') {
    const middleShelfY = bottomShelf + (standardHeightTopShelf - bottomShelf) / 2;
    const upperRodShelfY = hasTallHeight ? standardHeightTopShelf : topShelf;

    return {
      shelves: [
        { y: bottomShelf, fixed: false },
        { y: middleShelfY, fixed: true },
        ...(hasTallHeight ? [{ y: standardHeightTopShelf, fixed: false }] : []),
        { y: topShelf, fixed: true },
      ],
      rods: [
        { label: 'Upper rod', y: upperRodShelfY - rodDropBelowShelf, bayX: tower.bayX, width: tower.width },
        { label: 'Lower rod', y: middleShelfY - rodDropBelowShelf, bayX: tower.bayX, width: tower.width },
      ],
      drawers,
      drawerDeck,
    };
  }

  if (tower.code === 'S3D' || tower.code === 'S2D') {
    const drawerTowerDrawers = buildDrawers(tower.code);
    const drawerBounds = getDrawerBounds(drawerTowerDrawers);
    const lowerShelfY = bottomShelf + (drawerBounds.bottom - bottomShelf) / 2;
    const upperShelfCount = adjustableCount - 2;

    return {
      shelves: [
        { y: bottomShelf, fixed: false },
        { y: lowerShelfY, fixed: false },
        { y: drawerDeck, fixed: true },
        ...buildAdjustableShelves(drawing, upperShelfCount, drawerDeck, topShelf),
        { y: topShelf, fixed: true },
      ],
      rods,
      drawers: drawerTowerDrawers,
      drawerDeck,
    };
  }

  return {
    shelves: ['S7', 'S8', 'S9'].includes(tower.code) ? shelfTowerFixedShelves(shelves) : shelves,
    rods,
    drawers,
    drawerDeck,
  };
}
