import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Edges, OrbitControls, RoundedBox } from '@react-three/drei';
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three';

const storefrontBaseUrl = 'https://www.closetswarehouse.com';
const consultationUrl = `${storefrontBaseUrl}/pages/free-closets-design-consultation`;
const contactUrl = `${storefrontBaseUrl}/pages/contact`;
const phoneDisplay = '(954) 247-8032';
const phoneHref = 'tel:+19542478032';

function getProductUrl(handle) {
  const shopifyHandle = String(handle || '').trim().toLowerCase();
  return shopifyHandle ? `${storefrontBaseUrl}/products/${shopifyHandle}` : '';
}

function ConsultationCta({ compact = false }) {
  return (
    <a
      href={consultationUrl}
      target="_top"
      className={`rounded bg-stone-950 px-3 py-2 text-sm font-bold text-white hover:bg-stone-800 ${compact ? 'text-xs sm:text-sm' : ''}`}
    >
      Need help? Schedule a free design consultation
    </a>
  );
}

function buildQuoteContactUrl(quoteId, intent = 'contact') {
  const url = new URL(contactUrl);
  const reference = String(quoteId || '').trim();

  if (reference) {
    url.searchParams.set('quote', reference);
    url.searchParams.set('plan_reference', reference);
    url.searchParams.set('contact[body]', `Plan reference: ${reference}`);
  }

  url.searchParams.set('contact_method', intent);
  return url.toString();
}

function SavedPlanActions({ quoteId }) {
  return (
    <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
      <p className="text-sm font-bold text-emerald-800">
        Saved. Reference {quoteId}. Your plan link can now be found when you login to your closetswarehouse.com account. Call or email us to finalize your order.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <a href={phoneHref} target="_top" className="rounded bg-stone-950 px-3 py-2 text-center text-sm font-bold text-white hover:bg-stone-800">
          Call {phoneDisplay}
        </a>
        <a href={buildQuoteContactUrl(quoteId, 'contact')} target="_top" className="rounded bg-brand-orange px-3 py-2 text-center text-sm font-bold text-white hover:bg-orange-700">
          Contact
        </a>
      </div>
    </div>
  );
}

const fallbackKit = {
  handle: 'H3D-S8-51-96-14-W',
  title: 'K12-K14 Hang & Drawers + 8-Shelf',
  kitId: 'K12-K14',
  height: 96,
  assembledWidth: 50.25,
  requiredWidth: 52.25,
  price: 0,
  productUrl: getProductUrl('h3d-s8-51-96-14-w'),
  towerSpecs: [
    { code: 'H3D', width: 24, label: 'K12 H3D' },
    { code: 'S8', width: 24, label: 'K14 S8' },
  ],
};

const depth = 14;
const panelThickness = 0.75;
const toeKickHeight = 5;
const drawerSideOverlay = panelThickness / 2 - 1 / 16;
const drawerPullLength = 5;
const drawerPullHeight = 0.5;
const drawerPullProjection = 1.4;
const frontDrillLineZ = depth / 2 - 1.1;
const shelfOnlyAdjustableShelfCounts = {
  S7: 6,
  S8: 7,
  S9: 7,
};
const panelMaterial = {
  color: '#fffdf7',
  roughness: 0.68,
  metalness: 0,
};
const edgeMaterial = {
  color: '#f4f1e9',
  roughness: 0.78,
  metalness: 0,
};
const photoToeKickMaterial = {
  color: '#dedad0',
  roughness: 0.68,
  metalness: 0,
};
const photoPanelMaterial = {
  color: '#fbfaf4',
  roughness: 0.42,
  metalness: 0,
  clearcoat: 0.18,
  clearcoatRoughness: 0.7,
};
const photoDrawerMaterial = {
  color: '#fffdf7',
  roughness: 0.38,
  metalness: 0,
  clearcoat: 0.22,
  clearcoatRoughness: 0.62,
};

const towerNames = {
  LH: 'Long Hang',
  DH: 'Double Hang',
  HS: 'Hang & Shelves',
  S3D: 'Shelves & 3 Drawer',
  H3D: 'Hang & 3 Drawer',
  S2D: 'Shelves & 2 Drawer',
  S7: '7-Shelf',
  S8: '8-Shelf',
  S9: '8-Shelf',
};

const plannerConfigs = [
  { code: 'LH', title: 'Long Hang', note: 'Dresses, coats, long hanging' },
  { code: 'DH', title: 'Double Hang', note: 'Two rods for shirts and pants' },
  { code: 'HS', title: 'Hang + Shelves', note: 'Hanging with lower shelves' },
  { code: 'S3D', title: 'Shelves + 3 Drawers', note: 'Drawers with shelf storage' },
  { code: 'H3D', title: 'Hang + 3 Drawers', note: 'Short hang over drawers' },
  { code: 'S2D', title: 'Shelves + 2 Drawers', note: 'Two drawers with shelves' },
  { code: 'SHELF', title: 'Shelf Tower', note: 'Even shelf levels' },
];

const reachInDoorTypes = [
  { value: 'regular', label: 'No door / regular' },
  { value: 'bifold', label: 'Bi-fold' },
  { value: 'sliding', label: 'Sliding' },
];

const towerCodePattern = /^(LH|DH|HS|S3D|3DS|H3D|3DH|S2D|2DS|S7|S8|S9)$/;
const widthTokenPattern = /^(18|24|30)$/;
const singleTowerWidthTokenMap = {
  20: 18,
  26: 24,
  32: 30,
};

function normalizeHandle(value) {
  return String(value || '').toUpperCase();
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? `$${number.toFixed(2)}` : '';
}

function normalizePrice(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatInches(value, precision = 2) {
  const number = Number(value) || 0;
  const decimals = number % 1 === 0 ? 0 : precision;
  return `${number.toFixed(decimals)}"`;
}

function getShopifyHandle(fields, sku) {
  return String(fields.shopify_handle || sku || '')
    .trim()
    .toLowerCase();
}

function getShelfCodeForHeight(height) {
  return Number(height) >= 96 ? 'S8' : 'S7';
}

function normalizeTowerCode(code) {
  const normalizedCode = String(code || '').toUpperCase();
  const aliases = {
    '3DS': 'S3D',
    '3DH': 'H3D',
    '2DS': 'S2D',
    S9: 'S8',
  };

  return aliases[normalizedCode] || normalizedCode;
}

function getPlannerCode(configCode, height) {
  return configCode === 'SHELF' ? getShelfCodeForHeight(height) : configCode;
}

function getWidthOptions(configCode) {
  return [18, 24, 30];
}

function createPlannerModule(configCode, height, width = null) {
  const options = getWidthOptions(configCode);
  const nextWidth = width && options.includes(Number(width)) ? Number(width) : 24;
  const code = getPlannerCode(configCode, height);

  return {
    id: `${configCode}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    configCode,
    code,
    width: nextWidth,
    label: `${towerNames[code] || code} ${nextWidth}"`,
  };
}

function getModuleToken(module) {
  return `${module.code}${module.width}`;
}

function buildMatchSignature(height, towerSpecs) {
  const counts = towerSpecs.reduce((map, tower) => {
    const code = normalizeTowerCode(tower.code);
    const token = `${code}${tower.width}`;
    map.set(token, (map.get(token) || 0) + 1);
    return map;
  }, new Map());

  const modules = [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([token, count]) => `${token}x${count}`)
    .join('+');

  return `${height}|${depth}|${modules}`;
}

function getAssembledWidth(towerSpecs) {
  return towerSpecs.reduce((total, tower) => total + tower.width, 0) + (towerSpecs.length + 1) * panelThickness;
}

function getRequiredWidth(assembledWidth) {
  return Number((assembledWidth + 2).toFixed(2));
}

function getModuleSegments(modules, start = 0) {
  let cursor = start + panelThickness;

  return modules.map((module) => {
    const length = Number(module.width) || 0;
    const segment = {
      module,
      start: cursor,
      length,
      center: cursor + length / 2,
    };

    cursor += length + panelThickness;
    return segment;
  });
}

function getSharedDividerCenters(modules, start = 0) {
  return getModuleSegments(modules, start)
    .slice(0, -1)
    .map((segment) => segment.start + segment.length + panelThickness / 2);
}

function formatTowerTitle(towerSpecs) {
  const systemType = towerSpecs.length === 1 ? 'Single Tower' : towerSpecs.length === 2 ? 'Double Tower' : `${towerSpecs.length}-Tower`;

  return `${towerSpecs
    .map((tower) => `${towerNames[tower.code] || tower.code}${tower.width === 24 ? '' : ` (${tower.width}")`}`)
    .join(' + ')} ${systemType}`;
}

function getNominalWidthFromSkuToken(token) {
  if (widthTokenPattern.test(token)) {
    return Number(token);
  }

  return singleTowerWidthTokenMap[token] || null;
}

function parseTowerSku(sku) {
  const tokens = normalizeHandle(sku).split('-');
  const dimensionStart = tokens.findIndex((token, index) => index > 0 && Number(token) >= 45);
  const configTokens = tokens.slice(0, dimensionStart > -1 ? dimensionStart : tokens.length);
  const towerSpecs = [];

  for (let index = 0; index < configTokens.length; index += 1) {
    const token = configTokens[index];

    if (!towerCodePattern.test(token)) {
      continue;
    }

    const nextToken = configTokens[index + 1];
    const parsedWidth = getNominalWidthFromSkuToken(nextToken);
    const width = parsedWidth || 24;

    if (parsedWidth) {
      index += 1;
    }

    towerSpecs.push({
      code: normalizeTowerCode(token),
      sourceCode: token,
      width,
      label: `${token} ${width}"`,
    });
  }

  return towerSpecs.length >= 1 ? towerSpecs : null;
}

function kitRecordToDrawing(record) {
  const fields = record.fields;
  const sku = fields.shopify_sku || fields['Kit Name'];
  const towerSpecs = parseTowerSku(sku);

  if (!towerSpecs) {
    return null;
  }

  const height = Number(fields.Height) || (normalizeHandle(sku).includes('-96-') ? 96 : 84);
  const assembledWidth = Number(fields.Width) || getAssembledWidth(towerSpecs);
  const shopifyHandle = getShopifyHandle(fields, sku);

  return {
    handle: sku,
    title: formatTowerTitle(towerSpecs),
    kitId: fields.KitID || record.id,
    height,
    assembledWidth,
    requiredWidth: Number(fields['Width Requirement']) || getRequiredWidth(assembledWidth),
    price: normalizePrice(fields.retail_price),
    productUrl: getProductUrl(shopifyHandle),
    matchSignature: buildMatchSignature(height, towerSpecs),
    status: String(fields.Status || 'active').toLowerCase(),
    towerSpecs,
  };
}

function kitHandleToDrawing(handle) {
  const sku = normalizeHandle(handle);
  const towerSpecs = parseTowerSku(sku);

  if (!towerSpecs) {
    return null;
  }

  const height = sku.includes('-96-') ? 96 : 84;
  const assembledWidth = getAssembledWidth(towerSpecs);

  return {
    handle: sku,
    title: formatTowerTitle(towerSpecs),
    kitId: sku,
    height,
    assembledWidth,
    requiredWidth: getRequiredWidth(assembledWidth),
    price: 0,
    productUrl: getProductUrl(sku),
    matchSignature: buildMatchSignature(height, towerSpecs),
    status: 'active',
    towerSpecs,
  };
}

function getRequestedKitHandle() {
  if (typeof window === 'undefined') {
    return '';
  }

  return normalizeHandle(new URLSearchParams(window.location.search).get('kit'));
}

function shouldExposeCaptureData() {
  if (typeof window === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location.search).get('capture') === '1';
}

function shouldShowEstimatePage() {
  if (typeof window === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location.search).get('estimate') === '1';
}

function getRequestedMode() {
  if (typeof window === 'undefined') {
    return 'planner';
  }

  return new URLSearchParams(window.location.search).get('mode') === 'renderer' ? 'renderer' : 'planner';
}

function getRequestedReachInPlan() {
  if (typeof window === 'undefined') {
    return null;
  }

  const encodedPlan = new URLSearchParams(window.location.search).get('plan');

  if (!encodedPlan) {
    return null;
  }

  try {
    return JSON.parse(atob(encodedPlan));
  } catch {
    return null;
  }
}

function buildReachInPlanUrl(planDetails, modules) {
  if (typeof window === 'undefined') {
    return '';
  }

  const url = new URL(window.location.href);
  url.searchParams.delete('kit');
  url.searchParams.delete('estimate');
  url.searchParams.set('plan', btoa(JSON.stringify({ planDetails, modules })));
  return url.toString();
}

function buildReachInEstimateUrl(planDetails, modules) {
  const url = new URL(buildReachInPlanUrl(planDetails, modules));
  url.searchParams.set('estimate', '1');
  return url.toString();
}

function navigateInsideFrame(path) {
  if (typeof window === 'undefined') return;
  window.self.location.assign(new URL(path, window.self.location.href).toString());
}

function createDrawing(baseDrawing) {
  const towers = [];
  let cursor = panelThickness;

  baseDrawing.towerSpecs.forEach((tower, index) => {
    towers.push({
      ...tower,
      id: `${tower.code}-${index}`,
      bayX: cursor,
    });
    cursor += tower.width + panelThickness;
  });

  return {
    ...baseDrawing,
    panelThickness,
    toeKickHeight,
    towers,
    panelXs: [0, ...towers.slice(1).map((tower) => tower.bayX - panelThickness), baseDrawing.assembledWidth - panelThickness],
    sceneCenterX: baseDrawing.assembledWidth / 2,
  };
}

function createPlannerDrawing(height, modules) {
  const towerSpecs = modules.map((module) => ({
    code: module.code,
    width: module.width,
    label: module.label,
  }));
  const assembledWidth = getAssembledWidth(towerSpecs);

  return {
    handle: towerSpecs.length ? `CUSTOM-${height}-${buildMatchSignature(height, towerSpecs).split('|').at(-1).replaceAll('+', '-')}` : `CUSTOM-${height}`,
    title: towerSpecs.length ? formatTowerTitle(towerSpecs) : `${height}" Closet Plan`,
    kitId: 'custom-plan',
    height,
    assembledWidth,
    requiredWidth: getRequiredWidth(assembledWidth),
    towerSpecs,
  };
}

function calculateCustomEstimate(modules, productCatalog, height) {
  const singleProductsBySignature = new Map(
    productCatalog
      .filter((product) => product.towerSpecs.length === 1 && product.price > 0)
      .map((product) => [product.matchSignature, product]),
  );
  const baseTotal = modules.reduce((sum, module) => {
    const singleSignature = buildMatchSignature(height, [{ code: module.code, width: module.width }]);
    const singleProduct = singleProductsBySignature.get(singleSignature);
    const fallbackByCode = {
      LH: 225,
      DH: 245,
      HS: 260,
      S3D: 545,
      H3D: 560,
      S2D: 450,
      S7: 275,
      S8: 315,
    };

    return sum + (singleProduct?.price || fallbackByCode[module.code] || 275);
  }, 0);
  const sharedPanelCredit = Math.max(0, modules.length - 1) * 32;

  return Number(Math.max(0, baseTotal - sharedPanelCredit).toFixed(2));
}

function shouldPreferProductCandidate(candidate, existing) {
  if (!existing) {
    return true;
  }

  const candidateActive = candidate.status === 'active';
  const existingActive = existing.status === 'active';

  if (candidateActive !== existingActive) {
    return candidateActive;
  }

  const candidateHasPrice = candidate.price > 0;
  const existingHasPrice = existing.price > 0;

  if (candidateHasPrice !== existingHasPrice) {
    return candidateHasPrice;
  }

  const candidateIsConnected = candidate.towerSpecs.length > 1;
  const existingIsConnected = existing.towerSpecs.length > 1;

  if (candidateIsConnected !== existingIsConnected) {
    return candidateIsConnected;
  }

  return false;
}

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

function buildTowerLayout(drawing, tower) {
  const topShelf = drawing.height - panelThickness;
  const bottomShelf = toeKickHeight;
  const s2dDrawerTop = getDrawerBounds(buildDrawers('S2D')).top;
  const drawerDeck = tower.code === 'S2D' ? s2dDrawerTop : 46;
  const longHangShelfY = drawing.height - 18;
  const rodDropBelowShelf = 4.5;
  const longHangRodY = longHangShelfY - rodDropBelowShelf;
  const hsLowerShelfTopY = drawing.height >= 96 ? 52 : 43;
  const hasTallHeight = drawing.height >= 96;
  const shelfCountByCode = {
    S3D: hasTallHeight ? 5 : 4,
    H3D: hasTallHeight ? 2 : 1,
    S2D: hasTallHeight ? 5 : 4,
    ...shelfOnlyAdjustableShelfCounts,
  };

  const shelves = [
    { y: bottomShelf, fixed: true },
    ...buildAdjustableShelves(drawing, shelfCountByCode[tower.code] || 3),
    { y: topShelf, fixed: true },
  ];
  const rods = [];
  const drawers = [];

  if (tower.code === 'LH') {
    return {
      shelves: [
        { y: bottomShelf, fixed: true },
        { y: longHangShelfY, fixed: false },
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
        { y: bottomShelf, fixed: true },
        ...buildAdjustableShelves(drawing, 3, bottomShelf, hsLowerShelfTopY),
        { y: topShelf, fixed: true },
      ],
      rods: [{ label: 'Hang rod', y: drawing.height - 8.5, bayX: tower.bayX, width: tower.width }],
      drawers,
      drawerDeck,
    };
  }

  if (tower.code === 'H3D') {
    return {
      shelves: [
        { y: bottomShelf, fixed: true },
        { y: 14.35, fixed: false },
        { y: drawerDeck, fixed: false },
        { y: topShelf, fixed: true },
      ],
      rods: [{ label: 'Hang rod', y: drawing.height - 7.5, bayX: tower.bayX, width: tower.width }],
      drawers: buildDrawers(tower.code),
      drawerDeck,
    };
  }

  if (tower.code === 'DH') {
    const middleShelfY = bottomShelf + (topShelf - bottomShelf) / 2;

    return {
      shelves: [
        { y: bottomShelf, fixed: true },
        { y: middleShelfY, fixed: false },
        { y: topShelf, fixed: true },
      ],
      rods: [
        { label: 'Upper rod', y: topShelf - rodDropBelowShelf, bayX: tower.bayX, width: tower.width },
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
    const upperShelfCount = hasTallHeight ? 3 : 2;

    return {
      shelves: [
        { y: bottomShelf, fixed: true },
        { y: lowerShelfY, fixed: false },
        { y: drawerDeck, fixed: tower.code === 'S2D' },
        ...buildAdjustableShelves(drawing, upperShelfCount, drawerDeck, topShelf),
        { y: topShelf, fixed: true },
      ],
      rods,
      drawers: drawerTowerDrawers,
      drawerDeck,
    };
  }

  return {
    shelves,
    rods,
    drawers,
    drawerDeck,
  };
}

function PartMaterial({ material, physical = false }) {
  return physical ? <meshPhysicalMaterial {...material} /> : <meshStandardMaterial {...material} />;
}

function BoxPart({ position, scale, material = panelMaterial, edge = true, bevel = 0, physical = false }) {
  if (bevel > 0) {
    return (
      <RoundedBox position={position} args={scale} radius={bevel} smoothness={3} castShadow receiveShadow>
        <PartMaterial material={material} physical={physical} />
        {edge && <Edges color="#deded6" threshold={18} />}
      </RoundedBox>
    );
  }

  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={scale} />
      <PartMaterial material={material} physical={physical} />
      {edge && <Edges color="#deded6" threshold={18} />}
    </mesh>
  );
}

function VerticalPanel({ drawing, atX, photoMode = false }) {
  return (
    <BoxPart
      position={[atX + panelThickness / 2 - drawing.sceneCenterX, drawing.height / 2, 0]}
      scale={[panelThickness, drawing.height, depth]}
      material={photoMode ? photoPanelMaterial : panelMaterial}
      bevel={photoMode ? 0.025 : 0}
      physical={photoMode}
      edge={!photoMode}
    />
  );
}

function Shelf3D({ drawing, tower, y, photoMode = false }) {
  return (
    <BoxPart
      position={[tower.bayX + tower.width / 2 - drawing.sceneCenterX, y + panelThickness / 2, 0]}
      scale={[tower.width, panelThickness, depth]}
      material={photoMode ? photoPanelMaterial : panelMaterial}
      bevel={photoMode ? 0.025 : 0}
      physical={photoMode}
      edge={!photoMode}
    />
  );
}

function ToeKick({ drawing, photoMode = false }) {
  const frontInset = 2.1;
  const toeKickPanelZ = depth / 2 - frontInset - panelThickness / 2;

  return (
    <>
      {drawing.towers.map((tower) => {
        const towerCenterX = tower.bayX + tower.width / 2 - drawing.sceneCenterX;

        return (
          <group key={`${tower.id}-toe`}>
            <BoxPart
              position={[towerCenterX, toeKickHeight / 2, toeKickPanelZ]}
              scale={[tower.width, toeKickHeight, panelThickness]}
              material={photoMode ? photoToeKickMaterial : edgeMaterial}
              bevel={photoMode ? 0.018 : 0}
              edge={!photoMode}
            />
          </group>
        );
      })}
    </>
  );
}

function Rod3D({ drawing, rod }) {
  const rodLength = rod.width - 2.4;
  const rodX = rod.bayX + rod.width / 2 - drawing.sceneCenterX;

  return (
    <group position={[rodX, rod.y, frontDrillLineZ]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.34, rodLength, 32]} />
        <meshStandardMaterial color="#b8b8b8" roughness={0.25} metalness={0.9} />
      </mesh>
      {[-rodLength / 2, rodLength / 2].map((bracketX) => (
        <group key={bracketX} position={[bracketX, 0, 0]}>
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[0.58, 24, 16]} />
            <meshStandardMaterial color="#a6a6a6" roughness={0.35} metalness={0.85} />
          </mesh>
          <mesh position={[0, 0, -0.55]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.22, 24]} />
            <meshStandardMaterial color="#9f9f9f" roughness={0.35} metalness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Hanger({ xPosition, y, z, scale = 1 }) {
  const wood = { color: '#b07a3d', roughness: 0.58, metalness: 0 };
  const metal = { color: '#b7b7b7', roughness: 0.24, metalness: 0.9 };

  return (
    <group position={[xPosition, y, z]} scale={scale}>
      <mesh position={[0, -0.2, 0]} rotation={[0, 0, 0.82]} castShadow>
        <boxGeometry args={[0.28, 4.2, 0.34]} />
        <meshStandardMaterial {...wood} />
      </mesh>
      <mesh position={[0, -0.2, 0]} rotation={[0, 0, -0.82]} castShadow>
        <boxGeometry args={[0.28, 4.2, 0.34]} />
        <meshStandardMaterial {...wood} />
      </mesh>
      <mesh position={[0, -1.95, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <boxGeometry args={[0.22, 4.2, 0.3]} />
        <meshStandardMaterial {...wood} />
      </mesh>
      <mesh position={[0, 1.25, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.48, 0.055, 10, 24, Math.PI * 1.25]} />
        <meshStandardMaterial {...metal} />
      </mesh>
    </group>
  );
}

function Hangers({ drawing, rod }) {
  const count = Math.max(4, Math.floor(rod.width / 4));
  const bayStart = rod.bayX - drawing.sceneCenterX + 4;
  const spacing = Math.min(3.2, (rod.width - 8) / Math.max(1, count - 1));
  const hangerPlaneZ = frontDrillLineZ - 0.2;

  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <Hanger
          key={`${rod.label}-${rod.bayX}-${index}`}
          xPosition={bayStart + index * spacing}
          y={rod.y - 1.5}
          z={hangerPlaneZ - index * 0.03}
          scale={0.9}
        />
      ))}
    </>
  );
}

function DrawerStack({ drawing, tower, drawers, photoMode = false }) {
  const frontZ = depth / 2 + 0.28;
  const drawerX = tower.bayX + tower.width / 2 - drawing.sceneCenterX;
  const drawerFaceWidth = tower.width + drawerSideOverlay * 2;
  const pullMaterial = { color: '#c7c5bf', roughness: 0.32, metalness: 0.82 };

  return (
    <>
      {drawers.map((drawer, index) => (
        <group key={`${tower.id}-${drawer.label}-${drawer.centerY}`}>
          <BoxPart
            position={[drawerX, drawer.centerY, frontZ]}
            scale={[drawerFaceWidth, drawer.height, 0.42]}
            material={photoMode ? photoDrawerMaterial : { color: '#f8f7f1', roughness: 0.74, metalness: 0 }}
            bevel={photoMode ? 0.045 : 0}
            physical={photoMode}
            edge={!photoMode}
          />
          <group position={[drawerX, drawer.centerY, frontZ + 0.58]}>
            <BoxPart
              position={[0, 0, drawerPullProjection / 2]}
              scale={[drawerPullLength, drawerPullHeight, 0.5]}
              material={pullMaterial}
              edge={false}
            />
            {[-1, 1].map((side) => (
              <BoxPart
                key={`${drawer.centerY}-pull-post-${side}`}
                position={[side * (drawerPullLength / 2 - 0.35), 0, 0.15]}
                scale={[0.42, drawerPullHeight, 0.7]}
                material={pullMaterial}
                edge={false}
              />
            ))}
          </group>
          {index < drawers.length - 1 && (
            <BoxPart
              position={[drawerX, drawer.centerY - drawer.height / 2 - 0.1, frontZ + 0.25]}
              scale={[drawerFaceWidth - 0.05, 0.04, 0.08]}
              material={{ color: '#cfcfc7', roughness: 0.82, metalness: 0 }}
              edge={false}
            />
          )}
        </group>
      ))}
    </>
  );
}

function ShelfPinRows({ drawing, tower }) {
  const pinYs = Array.from({ length: 40 }, (_, index) => 9 + index * 2.1).filter((pinY) => pinY < drawing.height - 6);
  const rowXs = [tower.bayX + 0.75 - drawing.sceneCenterX, tower.bayX + tower.width - 0.75 - drawing.sceneCenterX];

  return (
    <>
      {rowXs.map((pinX) =>
        pinYs.map((pinY) => (
          <mesh key={`${tower.id}-${pinX}-${pinY}`} position={[pinX, pinY, depth / 2 + 0.035]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.055, 0.055, 0.03, 10]} />
            <meshStandardMaterial color="#bfbfb8" roughness={0.5} metalness={0.45} />
          </mesh>
        )),
      )}
    </>
  );
}

function SunPatch({ position, scale, opacity = 0.22, rotation = [0, 0, 0] }) {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={scale} />
      <meshBasicMaterial color="#fff7df" transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

function WallWidthGuide({ drawing, wallWidth }) {
  const width = Number(wallWidth);

  if (!Number.isFinite(width) || width <= 0) {
    return null;
  }

  const guideHeight = drawing.height + 4;
  const halfWidth = width / 2;
  const segmentCount = 9;
  const segmentHeight = guideHeight / (segmentCount * 1.55);
  const guideColor = '#2563eb';
  const GuidePart = ({ position, scale, opacity }) => (
    <mesh position={position}>
      <boxGeometry args={scale} />
      <meshBasicMaterial color={guideColor} transparent opacity={opacity} depthWrite={false} depthTest={false} />
    </mesh>
  );

  return (
    <group position={[0, 0, -5.35]}>
      {[-halfWidth, halfWidth].flatMap((x) =>
        Array.from({ length: segmentCount }, (_, index) => (
          <GuidePart
            key={`wall-width-guide-${x}-${index}`}
            position={[x, 4 + index * (guideHeight / segmentCount), 0]}
            scale={[0.48, segmentHeight, 0.06]}
            opacity={0.72}
          />
        )),
      )}
      <GuidePart
        position={[0, drawing.height + 2, 0]}
        scale={[width, 0.28, 0.06]}
        opacity={0.42}
      />
      <GuidePart
        position={[0, 6, 0]}
        scale={[width, 0.22, 0.06]}
        opacity={0.34}
      />
    </group>
  );
}

function Room({ drawing, photoMode = false, wallWidth = null, reachInRoom = null }) {
  const wallColor = photoMode ? '#eee8df' : '#f1f0ea';
  const floorColor = photoMode ? '#d9bd82' : '#d9c19a';
  const baseboardColor = photoMode ? '#f7f4ee' : '#f8f7f2';
  const guideWidth = Number(wallWidth) || 0;
  const reachInWidth = Number(reachInRoom?.wallWidth) || 0;
  const reachInDepth = Math.max(depth, Number(reachInRoom?.roomDepth) || depth);
  const roomWidth = Math.max(photoMode ? 190 : 120, guideWidth + 24, reachInWidth + 24);
  const roomBackZ = -depth / 2 - 0.35;
  const roomFrontZ = -depth / 2 + reachInDepth;
  const roomCenterZ = (roomBackZ + roomFrontZ) / 2;
  const wallHeight = drawing.height + 8;
  const wallThickness = 0.42;
  const openingStart = Math.min(reachInWidth, Math.max(0, Number(reachInRoom?.openingLeft) || 0));
  const openingEnd = Math.min(reachInWidth, openingStart + Math.max(0, Number(reachInRoom?.openingWidth) || 0));
  const leftReturnWidth = openingStart;
  const rightReturnWidth = Math.max(0, reachInWidth - openingEnd);
  const leftEdgeX = -reachInWidth / 2;
  const rightEdgeX = reachInWidth / 2;
  const wallShellMaterial = { color: wallColor, roughness: 0.98, metalness: 0, transparent: true, opacity: photoMode ? 0.82 : 0.68 };
  const frontReturnMaterial = { color: photoMode ? '#e5ded4' : '#e8e5de', roughness: 0.96, metalness: 0, transparent: true, opacity: photoMode ? 0.8 : 0.7 };
  const hasReachInShell = Boolean(reachInRoom && reachInWidth > 0);
  const shellBackWallWidth = hasReachInShell ? reachInWidth : roomWidth;
  const shellFloorWidth = hasReachInShell ? reachInWidth + wallThickness : Math.max(photoMode ? 196 : 128, roomWidth);
  const shellFloorDepth = hasReachInShell ? reachInDepth + wallThickness : 82;

  return (
    <>
      <mesh position={[0, wallHeight / 2, roomBackZ]} receiveShadow>
        <boxGeometry args={[shellBackWallWidth, wallHeight, 0.4]} />
        <meshStandardMaterial color={wallColor} roughness={0.98} />
      </mesh>
      {hasReachInShell && (
        <>
          <BoxPart position={[leftEdgeX, wallHeight / 2, roomCenterZ]} scale={[wallThickness, wallHeight, reachInDepth]} material={wallShellMaterial} edge={false} />
          <BoxPart position={[rightEdgeX, wallHeight / 2, roomCenterZ]} scale={[wallThickness, wallHeight, reachInDepth]} material={wallShellMaterial} edge={false} />
          {leftReturnWidth > 0 && (
            <BoxPart
              position={[leftEdgeX + leftReturnWidth / 2, wallHeight / 2, roomFrontZ]}
              scale={[leftReturnWidth, wallHeight, wallThickness]}
              material={frontReturnMaterial}
              edge={false}
            />
          )}
          {rightReturnWidth > 0 && (
            <BoxPart
              position={[leftEdgeX + openingEnd + rightReturnWidth / 2, wallHeight / 2, roomFrontZ]}
              scale={[rightReturnWidth, wallHeight, wallThickness]}
              material={frontReturnMaterial}
              edge={false}
            />
          )}
          {reachInRoom?.doorType === 'sliding' && (
            <>
              <BoxPart
                position={[leftEdgeX + openingStart + (openingEnd - openingStart) / 4, wallHeight / 2, roomFrontZ - 0.25]}
                scale={[(openingEnd - openingStart) / 2, wallHeight * 0.92, 0.18]}
                material={{ color: '#d8d4cc', roughness: 0.92, metalness: 0, transparent: true, opacity: 0.45 }}
                edge={false}
              />
              <BoxPart
                position={[leftEdgeX + openingStart + ((openingEnd - openingStart) * 3) / 4, wallHeight / 2, roomFrontZ - 0.55]}
                scale={[(openingEnd - openingStart) / 2, wallHeight * 0.92, 0.18]}
                material={{ color: '#ece8df', roughness: 0.92, metalness: 0, transparent: true, opacity: 0.45 }}
                edge={false}
              />
            </>
          )}
        </>
      )}
      <mesh position={[0, -0.18, hasReachInShell ? roomCenterZ : 5]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[shellFloorWidth, shellFloorDepth]} />
        <meshStandardMaterial color={floorColor} roughness={0.58} />
      </mesh>
      {!hasReachInShell && Array.from({ length: 14 }, (_, index) => (
        <mesh key={`floor-${index}`} position={[-91 + index * 14, -0.16, 14]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.04, 76]} />
          <meshStandardMaterial color={photoMode ? '#b9965f' : '#b99b6c'} roughness={0.8} />
        </mesh>
      ))}
      {photoMode &&
        Array.from({ length: 4 }, (_, index) => (
          <mesh key={`floor-cross-${index}`} position={[0, -0.155, -5 + index * 12]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
            <planeGeometry args={[0.035, 128]} />
            <meshStandardMaterial color="#bd9d69" roughness={0.82} />
          </mesh>
        ))}
      <BoxPart position={[0, 2.2, -6.65]} scale={[shellBackWallWidth, 3.2, 0.45]} material={{ color: baseboardColor, roughness: 0.86, metalness: 0 }} edge={false} />
      <BoxPart position={[0, 4.1, -6.42]} scale={[shellBackWallWidth, 0.28, 0.45]} material={{ color: '#e4e1d8', roughness: 0.86, metalness: 0 }} edge={false} />
      {photoMode && (
        <>
          <SunPatch position={[-44, 38, -6.12]} scale={[18, 30]} opacity={0.15} />
          <SunPatch position={[-42, 13, -6.1]} scale={[22, 10]} opacity={0.11} />
          <SunPatch position={[-34, 0.04, 12]} scale={[26, 16]} opacity={0.1} rotation={[-Math.PI / 2, 0, -0.15]} />
        </>
      )}
      {!hasReachInShell && <WallWidthGuide drawing={drawing} wallWidth={wallWidth} />}
    </>
  );
}

function ClosetSystem({ drawing, photoMode = false }) {
  return (
    <group position={[0, 0, 0]}>
      {drawing.panelXs.map((atX, index) => (
        <VerticalPanel key={`panel-${index}-${atX}`} drawing={drawing} atX={atX} photoMode={photoMode} />
      ))}

      {drawing.towers.map((tower) => {
        const layout = buildTowerLayout(drawing, tower);

        return (
          <group key={tower.id}>
            {layout.shelves.map((shelf, index) => (
              <Shelf3D key={`${tower.id}-shelf-${shelf.y}-${index}`} drawing={drawing} tower={tower} y={shelf.y} photoMode={photoMode} />
            ))}
            {layout.drawers.length > 0 && <DrawerStack drawing={drawing} tower={tower} drawers={layout.drawers} photoMode={photoMode} />}
            {layout.rods.map((rod) => (
              <Rod3D key={`${tower.id}-${rod.label}`} drawing={drawing} rod={rod} />
            ))}
            {layout.rods.map((rod) => (
              <Hangers key={`${tower.id}-hangers-${rod.label}`} drawing={drawing} rod={rod} />
            ))}
            <ShelfPinRows drawing={drawing} tower={tower} />
          </group>
        );
      })}

      <ToeKick drawing={drawing} photoMode={photoMode} />
    </group>
  );
}

function RenderScene({ drawing, photoMode = false, wallWidth = null, reachInRoom = null }) {
  return (
    <>
      <color attach="background" args={[photoMode ? '#f4efe7' : '#fbfaf6']} />
      {photoMode && <hemisphereLight args={['#fff8ea', '#d3c2a1', 0.56]} />}
      <ambientLight intensity={photoMode ? 0.92 : 0.82} />
      <directionalLight
        position={photoMode ? [-48, 88, 70] : [-34, 78, 42]}
        intensity={photoMode ? 2.45 : 2.65}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={112}
        shadow-camera-bottom={-12}
      />
      <directionalLight position={[72, 64, 72]} intensity={photoMode ? 1.15 : 0.95} />
      <directionalLight position={[0, 54, -44]} intensity={photoMode ? 0.52 : 0.58} />
      {photoMode && <spotLight position={[34, 72, 98]} angle={0.42} penumbra={0.74} intensity={0.42} castShadow />}
      <Room drawing={drawing} photoMode={photoMode} wallWidth={wallWidth} reachInRoom={reachInRoom} />
      <ClosetSystem drawing={drawing} photoMode={photoMode} />
      <ContactShadows position={[0, 0.02, 4]} opacity={photoMode ? 0.28 : 0.24} scale={88} blur={photoMode ? 5.2 : 2.8} far={14} />
      <OrbitControls makeDefault enableDamping target={[0, drawing.height / 2, 0]} minDistance={120} maxDistance={320} />
    </>
  );
}

function seoSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getPhotoExportPlan(drawing, installationType) {
  const handle = seoSlug(drawing.handle);
  const towerCount = drawing.towers?.length || drawing.towerSpecs?.length || 1;
  const walkInOnly = Number(drawing.height) >= 96;

  if (walkInOnly || installationType === 'walk-in') {
    return [
      {
        id: 'walk-in-hero',
        label: 'Walk-in hero',
        scene: 'walk-in',
        bifoldDoorSets: 0,
        filename: `${handle}-walk-in-hero.png`,
      },
    ];
  }

  const bifoldDoorSets = towerCount === 1 ? 1 : 2;

  return [
    {
      id: 'product-hero',
      label: 'Clean product hero',
      scene: 'product',
      bifoldDoorSets: 0,
      filename: `${handle}-product-hero.png`,
    },
    {
      id: 'reach-in-installed',
      label: `Reach-in installed · ${bifoldDoorSets} bi-fold ${bifoldDoorSets === 1 ? 'set' : 'sets'}`,
      scene: 'reach-in',
      bifoldDoorSets,
      filename: `${handle}-reach-in-installed-${bifoldDoorSets}-bifold.png`,
    },
  ];
}

function PhotoSetRules({ drawing, installationType, onChange }) {
  const shots = getPhotoExportPlan(drawing, installationType);
  const towerCount = drawing.towers?.length || drawing.towerSpecs?.length || 1;
  const bifoldDoorSets = towerCount === 1 ? 1 : 2;
  const walkInOnly = Number(drawing.height) >= 96;

  return (
    <div className="flex items-center gap-2 rounded border border-stone-200 bg-stone-50 px-2 py-1">
      <label className="text-xs font-bold text-stone-600" htmlFor="photo-installation-type">
        Scene rules
      </label>
      <select
        id="photo-installation-type"
        value={walkInOnly ? 'walk-in' : installationType}
        onChange={(event) => onChange(event.target.value)}
        disabled={walkInOnly}
        className="rounded border border-stone-300 bg-white px-2 py-1 text-xs font-semibold text-stone-800 disabled:cursor-not-allowed disabled:bg-stone-200"
      >
        <option value="reach-in">Reach-in · 2 images</option>
        <option value="walk-in">Walk-in · 1 image</option>
      </select>
      <span className="whitespace-nowrap text-[11px] font-semibold text-stone-500">
        {!walkInOnly && installationType === 'reach-in' ? `Product only + installed · ${bifoldDoorSets} bi-fold ${bifoldDoorSets === 1 ? 'set' : 'sets'}` : 'One walk-in hero'}
      </span>
    </div>
  );
}

function ExportButton({ drawing, installationType }) {
  const [status, setStatus] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const shots = getPhotoExportPlan(drawing, installationType);

  const exportRender = () => {
    const canvas = document.querySelector('canvas');

    if (!canvas) {
      setStatus('No canvas found');
      return;
    }

    try {
      const dataUrl = canvas.toDataURL('image/png');
      setDownloadUrl(dataUrl);
      window.__closetExport = {
        handle: drawing.handle,
        dataUrl,
        installationType,
        shots,
      };

      if (shouldExposeCaptureData()) {
        setStatus('PNG ready');
        return;
      }

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = shots[0].filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setStatus('PNG exported');
    } catch (error) {
      setStatus('Export failed');
      console.error(error);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={exportRender}
        className="rounded border border-brand-orange px-3 py-1 text-sm font-semibold text-brand-orange transition hover:bg-brand-orange hover:text-white"
      >
        Export {shots.length}-photo set
      </button>
      {status && <span className="text-xs font-medium text-stone-500">{status}</span>}
      {downloadUrl && (
        <a className="text-xs font-semibold text-brand-orange underline" href={downloadUrl} download={shots[0].filename}>
          Download ready
        </a>
      )}
    </div>
  );
}

function TechnicalDrawing({ drawing }) {
  const margin = 20;
  const scale = 6;
  const width = drawing.assembledWidth * scale;
  const height = drawing.height * scale;
  const totalWidth = width + margin * 2 + 180;
  const totalHeight = height + margin * 2 + 54;
  const left = margin + 34;
  const top = margin + 10;
  const toX = (value) => left + value * scale;
  const toY = (value) => top + (drawing.height - value) * scale;
  const inch = (value) => value * scale;
  const layouts = drawing.towers.map((tower) => ({ tower, layout: buildTowerLayout(drawing, tower) }));

  const Panel = ({ atX, label }) => (
    <g>
      <rect
        x={toX(atX)}
        y={toY(drawing.height)}
        width={inch(panelThickness)}
        height={inch(drawing.height)}
        className="fill-brand-panel stroke-stone-900"
      />
      <text x={toX(atX) + 2} y={toY(43)} className="drawing-label -rotate-90">
        {label}
      </text>
    </g>
  );

  const Shelf = ({ tower, y, fixed = false }) => (
    <rect
      x={toX(tower.bayX)}
      y={toY(y + panelThickness)}
      width={inch(tower.width)}
      height={inch(panelThickness)}
      className={fixed ? 'fill-stone-300 stroke-stone-900' : 'fill-white stroke-stone-600'}
    />
  );

  const Rod = ({ rod }) => (
    <g>
      <line
        x1={toX(rod.bayX + 2)}
        y1={toY(rod.y)}
        x2={toX(rod.bayX + rod.width - 2)}
        y2={toY(rod.y)}
        className="stroke-stone-500"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx={toX(rod.bayX + 1.2)} cy={toY(rod.y)} r="3" className="fill-stone-500" />
      <circle cx={toX(rod.bayX + rod.width - 1.2)} cy={toY(rod.y)} r="3" className="fill-stone-500" />
    </g>
  );

  const Drawer = ({ drawer, tower }) => {
    return (
      <g>
        <rect
          x={toX(tower.bayX - drawerSideOverlay)}
          y={toY(drawer.centerY + drawer.height / 2)}
          width={inch(tower.width + drawerSideOverlay * 2)}
          height={inch(drawer.height)}
          className="fill-brand-panel stroke-stone-700"
        />
        <rect
          x={toX(tower.bayX + tower.width / 2 - drawerPullLength / 2)}
          y={toY(drawer.centerY) - 2}
          width={inch(drawerPullLength)}
          height="4"
          rx="1"
          className="fill-stone-300 stroke-stone-500"
        />
      </g>
    );
  };

  const Dimension = ({ y, label }) => (
    <g>
      <line x1={toX(drawing.assembledWidth) + 8} y1={toY(y)} x2={toX(drawing.assembledWidth) + 20} y2={toY(y)} className="stroke-orange-700" />
      <text x={toX(drawing.assembledWidth) + 26} y={toY(y) + 4} className="drawing-dim">
        {label}
      </text>
    </g>
  );

  return (
    <svg viewBox={`0 0 ${totalWidth} ${totalHeight}`} className="h-full w-full bg-white">
      <text x={left} y="24" className="drawing-title">
        {drawing.title}
      </text>
      <text x={left} y="42" className="drawing-subtitle">
        {drawing.handle}
      </text>

      <rect
        x={toX(0)}
        y={toY(toeKickHeight)}
        width={inch(drawing.assembledWidth)}
        height={inch(toeKickHeight)}
        className="fill-stone-200 stroke-stone-500"
      />

      {drawing.panelXs.map((atX, index) => (
        <Panel key={`drawing-panel-${index}-${atX}`} atX={atX} label={index === 0 ? 'VL' : index === drawing.panelXs.length - 1 ? 'VR' : 'VD shared'} />
      ))}

      {layouts.map(({ tower, layout }) => (
        <g key={tower.id}>
          {layout.shelves.map((shelf, index) => (
            <Shelf key={`${tower.id}-shelf-${shelf.y}-${index}`} tower={tower} y={shelf.y} fixed={shelf.fixed} />
          ))}
          {layout.drawers.map((drawer) => (
            <Drawer key={`${tower.id}-drawer-${drawer.centerY}`} drawer={drawer} tower={tower} />
          ))}
          {layout.rods.map((rod) => (
            <Rod key={`${tower.id}-rod-${rod.label}`} rod={rod} />
          ))}
          <text x={toX(tower.bayX + Math.max(2, tower.width / 4))} y={toY(20)} className="drawing-bay">
            {towerNames[tower.code] || tower.code}
          </text>
        </g>
      ))}

      <line x1={toX(0)} y1={toY(0)} x2={toX(drawing.assembledWidth)} y2={toY(0)} className="stroke-stone-950" strokeWidth="2" />
      <line x1={toX(0)} y1={toY(drawing.height)} x2={toX(drawing.assembledWidth)} y2={toY(drawing.height)} className="stroke-stone-950" strokeWidth="2" />

      <line x1={toX(0)} y1={toY(-3)} x2={toX(drawing.assembledWidth)} y2={toY(-3)} className="stroke-orange-700" />
      <line x1={toX(0)} y1={toY(-4)} x2={toX(0)} y2={toY(-2)} className="stroke-orange-700" />
      <line x1={toX(drawing.assembledWidth)} y1={toY(-4)} x2={toX(drawing.assembledWidth)} y2={toY(-2)} className="stroke-orange-700" />
      <text x={toX(16)} y={toY(-5)} className="drawing-dim">
        {drawing.assembledWidth} in assembled width
      </text>

      <line x1={toX(-4)} y1={toY(0)} x2={toX(-4)} y2={toY(drawing.height)} className="stroke-orange-700" />
      <line x1={toX(-5)} y1={toY(0)} x2={toX(-3)} y2={toY(0)} className="stroke-orange-700" />
      <line x1={toX(-5)} y1={toY(drawing.height)} x2={toX(-3)} y2={toY(drawing.height)} className="stroke-orange-700" />
      <text x={toX(-12)} y={toY(42)} className="drawing-dim -rotate-90">
        {drawing.height} in drawing height
      </text>

      <Dimension y={drawing.height - panelThickness} label="top shelf" />
      <Dimension y={toeKickHeight} label="bottom shelf" />
    </svg>
  );
}

function KitSelector({ drawings, selectedHandle, onChange }) {
  const sortedDrawings = [...drawings].sort((left, right) =>
    String(left.handle || '').localeCompare(String(right.handle || ''), undefined, {
      numeric: true,
      sensitivity: 'base',
    }),
  );

  return (
    <select
      value={selectedHandle}
      onChange={(event) => onChange(event.target.value)}
      className="max-w-[330px] rounded border border-stone-300 bg-white px-2 py-1 text-sm font-semibold text-stone-700"
    >
      {sortedDrawings.map((option) => (
        <option key={option.handle} value={option.handle}>
          {option.handle}
        </option>
      ))}
    </select>
  );
}

function ViewModeToggle({ viewMode, onChange }) {
  return (
    <div className="flex rounded border border-stone-300 bg-white p-0.5 text-sm font-semibold">
      {['photo', 'drawing'].map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`rounded px-3 py-1 capitalize transition ${
            viewMode === mode ? 'bg-brand-orange text-white' : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}

function AppModeToggle({ appMode, onChange }) {
  return (
    <div className="flex rounded border border-stone-300 bg-white p-0.5 text-sm font-semibold">
      {[
        ['planner', 'Planner'],
        ['renderer', 'Renderer'],
      ].map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`rounded px-3 py-1 transition ${appMode === mode ? 'bg-brand-orange text-white' : 'text-stone-600 hover:bg-stone-100'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function HeightSelector({ height, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {[84, 96].map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded border px-2 py-1.5 text-xs font-bold transition ${
            height === option ? 'border-brand-orange bg-brand-orange text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-brand-orange'
          }`}
        >
          {option}"
        </button>
      ))}
    </div>
  );
}

function ModulePalette({ height, onAdd }) {
  const [dragCode, setDragCode] = useState('');

  return (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
      {plannerConfigs.map((config) => {
        const code = getPlannerCode(config.code, height);
        const widths = getWidthOptions(config.code).join(' / ');
        const tooltip = `${config.title}: ${config.note}. Available widths: ${widths}".`;

        return (
          <button
            key={config.code}
            type="button"
            draggable
            title={tooltip}
            onDragStart={(event) => {
              setDragCode(config.code);
              event.dataTransfer.setData('text/plain', config.code);
              event.dataTransfer.effectAllowed = 'copy';
            }}
            onDragEnd={() => setDragCode('')}
            onClick={() => onAdd(config.code)}
            className={`rounded border bg-white px-1.5 py-1 text-left transition hover:border-brand-orange hover:shadow-sm ${
              dragCode === config.code ? 'border-brand-orange' : 'border-stone-200'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <ConfigMiniIcon code={config.code} />
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-stone-900">{config.title}</span>
                <span className="mt-0.5 block truncate text-[11px] font-semibold text-brand-orange">{code} / {widths}"</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
function ConfigMiniIcon({ code }) {
  const shelfRows = code === 'SHELF' ? [0, 1, 2, 3, 4, 5] : code === 'HS' ? [3, 4, 5] : code === 'S3D' ? [0, 1, 2] : code === 'S2D' ? [0, 1, 2, 3] : code === 'H3D' ? [0] : [];
  const drawerRows = code === 'S2D' ? [4, 5] : ['S3D', 'H3D'].includes(code) ? [3, 4, 5] : [];
  const rodRows = code === 'DH' ? [1, 3] : code === 'LH' ? [1] : code === 'HS' ? [0] : code === 'H3D' ? [1] : [];

  return (
    <span className="relative grid h-8 w-6 shrink-0 grid-rows-[repeat(6,1fr)] overflow-hidden rounded border border-stone-300 bg-white px-1 py-1 shadow-inner" aria-hidden="true">
      <span className="absolute inset-y-1 left-1 w-px bg-stone-300" />
      <span className="absolute inset-y-1 right-1 w-px bg-stone-300" />
      {Array.from({ length: 6 }, (_, index) => {
        const showShelf = shelfRows.includes(index);
        const showDrawer = drawerRows.includes(index);
        const showRod = rodRows.includes(index);

        return (
          <span key={index} className="relative block">
            {showShelf && <span className="absolute inset-x-0 top-1/2 h-px bg-stone-500" />}
            {showDrawer && (
              <span className="absolute inset-x-0 top-0.5 h-1.5 rounded-sm bg-stone-300 ring-1 ring-stone-500">
                <span className="absolute left-1/2 top-1/2 h-0.5 w-2 -translate-x-1/2 -translate-y-1/2 rounded bg-stone-600" />
              </span>
            )}
            {showRod && (
              <>
                <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-brand-orange" />
                <span className="absolute left-1.5 top-[calc(50%+2px)] h-2 w-px bg-brand-orange" />
                <span className="absolute right-1.5 top-[calc(50%+2px)] h-2 w-px bg-brand-orange" />
              </>
            )}
          </span>
        );
      })}
    </span>
  );
}

function PlannerWall({ modules, height, wallWidth, onDropModule, onRemove, onMove, onReorder, onWidthChange }) {
  const assembledWidth = modules.length ? getAssembledWidth(modules) : 0;
  const requiredWidth = modules.length ? getRequiredWidth(assembledWidth) : 0;
  const remainingWidth = Number((Number(wallWidth) - requiredWidth).toFixed(2));
  const fits = modules.length > 0 && remainingWidth >= 0;
  const handleDrop = (event, targetIndex = modules.length) => {
    event.preventDefault();
    const moduleId = event.dataTransfer.getData('application/closet-module-id');
    const configCode = event.dataTransfer.getData('text/plain');

    if (moduleId) {
      onReorder(moduleId, targetIndex);
      return;
    }

    if (configCode) {
      onDropModule(configCode, targetIndex);
    }
  };

  return (
    <section
      className="rounded border border-stone-200 bg-white p-3"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(event) => handleDrop(event)}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-stone-950">Wall Plan</h2>
          <p className="text-xs font-semibold text-stone-500">Order controls the preview. Product matching ignores order.</p>
        </div>
        <span className={`rounded px-2 py-1 text-xs font-bold ${fits ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {modules.length ? (fits ? 'Fits wall' : 'Needs more width') : 'Drop modules here'}
        </span>
      </div>

      <div className="min-h-[150px] rounded border border-dashed border-stone-300 bg-stone-50 p-2">
        {modules.length === 0 ? (
          <div className="grid h-[130px] place-items-center text-center text-sm font-semibold text-stone-400">
            Drag one of the 7 configurations here
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="relative mb-2 flex items-center pt-5">
              <div className="absolute left-0 top-0 text-xs font-bold uppercase tracking-wide text-stone-500">Move</div>
              {modules.map((module, index) => {
                const visualWidth = Math.max(86, module.width * 4.2);

                return (
                  <div
                    key={`move-${module.id}`}
                    className="grid shrink-0 grid-cols-2 items-center px-1"
                    style={{ width: `${visualWidth + (index === 0 ? 16 : 8)}px` }}
                  >
                    <button
                      type="button"
                      onClick={() => onMove(index, -1)}
                      disabled={index === 0}
                      className="grid h-7 w-7 place-items-center justify-self-start rounded border border-stone-300 bg-white text-sm font-bold text-stone-700 disabled:opacity-25"
                      title="Move tower left"
                    >
                      👈
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(index, 1)}
                      disabled={index === modules.length - 1}
                      className="grid h-7 w-7 place-items-center justify-self-end rounded border border-stone-300 bg-white text-sm font-bold text-stone-700 disabled:opacity-25"
                      title="Move tower right"
                    >
                      👉
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex min-h-[130px] items-stretch">
              {modules.map((module, index) => {
                const widthOptions = getWidthOptions(module.configCode);
                const visualWidth = Math.max(86, module.width * 4.2);

                return (
                  <div
                    key={module.id}
                    className="group flex shrink-0 items-stretch"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('application/closet-module-id', module.id);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(event) => {
                      event.stopPropagation();
                      handleDrop(event, index);
                    }}
                  >
                    {index === 0 && <div className="w-2 rounded-l bg-stone-300" title="Left side panel" />}
                    <div
                      className="flex flex-col justify-between border-y border-stone-300 bg-white p-2"
                      style={{ width: `${visualWidth}px` }}
                      title={`${module.label}`}
                    >
                      <div>
                        <div className="truncate text-sm font-bold text-stone-900">{towerNames[module.code] || module.code}</div>
                        <div className="text-xs font-semibold text-stone-500">{module.code} · {height}"H</div>
                      </div>
                      <select
                        value={module.width}
                        onChange={(event) => onWidthChange(module.id, Number(event.target.value))}
                        className="mt-3 rounded border border-stone-300 bg-white px-1 py-1 text-xs font-bold text-stone-700"
                      >
                        {widthOptions.map((width) => (
                          <option key={width} value={width}>
                            {width}" bay
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => onRemove(module.id)}
                        className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
                      >
                        Remove tower
                      </button>
                    </div>
                    <div className="w-2 bg-stone-300" title={index === modules.length - 1 ? 'Right side panel' : 'Shared divider panel'} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1.5 text-xs">
        <div className="rounded bg-stone-50 px-2 py-1.5">
          <div className="font-semibold text-stone-500">Assembled</div>
          <div className="text-sm font-bold text-stone-950">{modules.length ? `${assembledWidth.toFixed(2)}"` : '-'}</div>
        </div>
        <div className="rounded bg-stone-50 px-2 py-1.5">
          <div className="font-semibold text-stone-500">Wall needed</div>
          <div className="text-sm font-bold text-stone-950">{modules.length ? `${requiredWidth.toFixed(2)}"` : '-'}</div>
        </div>
        <div className="rounded bg-stone-50 px-2 py-1.5">
          <div className="font-semibold text-stone-500">Remaining</div>
          <div className={`text-sm font-bold ${fits ? 'text-emerald-700' : 'text-red-700'}`}>{modules.length ? `${remainingWidth.toFixed(2)}"` : '-'}</div>
        </div>
        <div className="rounded bg-stone-50 px-2 py-1.5">
          <div className="font-semibold text-stone-500">Towers</div>
          <div className="text-sm font-bold text-stone-950">{modules.length || '-'}</div>
        </div>
      </div>
    </section>
  );
}

function ReachInPlanView({ modules, wallWidth, roomDepth, openingWidth, openingLeft, openingRight, doorType, height, drawerWarnings = [] }) {
  const backWidth = Math.max(1, Number(wallWidth) || 0);
  const reachDepth = Math.max(depth, Number(roomDepth) || depth);
  const doorWidth = Math.max(0, Number(openingWidth) || 0);
  const leftReturn = Math.max(0, Number(openingLeft) || 0);
  const rightReturn = Math.max(0, Number(openingRight) || 0);
  const remainingDepth = Math.max(0, reachDepth - depth);
  const assembledWidth = modules.length ? getAssembledWidth(modules) : 0;
  const requiredWidth = modules.length ? getRequiredWidth(assembledWidth) : 0;
  const openingTotal = leftReturn + doorWidth + rightReturn;
  const openingMatchesWall = Math.abs(openingTotal - backWidth) < 0.01;
  const openingStart = Math.min(backWidth, leftReturn);
  const openingEnd = Math.min(backWidth, leftReturn + doorWidth);
  const openingClear = doorWidth >= 24;
  const fitsWidth = modules.length > 0 && backWidth >= requiredWidth && openingMatchesWall && openingClear;
  const padding = 30;
  const viewWidth = 640;
  const viewHeight = 340;
  const wallPx = 7;
  const scale = Math.min((viewWidth - padding * 2) / backWidth, (viewHeight - padding * 2) / reachDepth);
  const toX = (value) => padding + value * scale;
  const toY = (value) => padding + value * scale;
  const runStart = Math.max(0, (backWidth - assembledWidth) / 2);
  const segments = getModuleSegments(modules, runStart);
  const sharedDividerCenters = getSharedDividerCenters(modules, runStart);
  const wallCenter = backWidth / 2;
  const slidingDividerAligned = doorType !== 'sliding' || sharedDividerCenters.some((dividerCenter) => Math.abs(dividerCenter - wallCenter) <= 0.5);
  const drawerAccessClear = drawerWarnings.length === 0;
  const planIsClear = fitsWidth && slidingDividerAligned && drawerAccessClear;

  return (
    <section className="rounded border border-stone-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-stone-950">Reach-in Plan</h2>
          <p className="text-xs font-semibold text-stone-500">Back wall closet with side walls, front returns, opening, and 14" unit depth.</p>
        </div>
        {modules.length > 0 && (
          <span className={`rounded px-2 py-1 text-xs font-bold ${planIsClear ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
            {planIsClear ? 'Fits back wall' : 'Needs fixes'}
          </span>
        )}
      </div>
      {drawerWarnings.length > 0 && (
        <div className="mb-2 grid gap-1.5">
          {drawerWarnings.map((warning) => (
            <div key={warning} className="rounded bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
              {warning}
            </div>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="h-[300px] w-full rounded bg-stone-50 sm:h-[340px] xl:h-[min(72vh,680px)]">
        <rect x={toX(0)} y={toY(0)} width={backWidth * scale} height={reachDepth * scale} className="fill-white stroke-stone-200" strokeWidth="1.5" />
        <rect x={toX(0)} y={toY(0) - wallPx / 2} width={backWidth * scale} height={wallPx} rx="1" className="fill-stone-600" />
        <rect x={toX(0) - wallPx / 2} y={toY(0)} width={wallPx} height={reachDepth * scale} rx="1" className="fill-stone-500" />
        <rect x={toX(backWidth) - wallPx / 2} y={toY(0)} width={wallPx} height={reachDepth * scale} rx="1" className="fill-stone-500" />
        {openingStart > 0 && <rect x={toX(0)} y={toY(reachDepth) - wallPx / 2} width={openingStart * scale} height={wallPx} rx="1" className="fill-stone-500" />}
        {backWidth - openingEnd > 0 && <rect x={toX(openingEnd)} y={toY(reachDepth) - wallPx / 2} width={(backWidth - openingEnd) * scale} height={wallPx} rx="1" className="fill-stone-500" />}
        <line x1={toX(openingStart)} y1={toY(reachDepth)} x2={toX(openingEnd)} y2={toY(reachDepth)} className="stroke-stone-400" strokeWidth="2" strokeDasharray="5 4" />
        <rect x={toX(runStart)} y={toY(0)} width={assembledWidth * scale} height={depth * scale} className="fill-brand-orange/70 stroke-orange-800" />
        {doorType === 'sliding' && (
          <g>
            <rect x={toX(openingStart)} y={toY(reachDepth) - 7} width={(doorWidth / 2) * scale} height="5" className="fill-stone-300/80 stroke-stone-600" />
            <rect x={toX(openingStart + doorWidth / 2)} y={toY(reachDepth) - 12} width={(doorWidth / 2) * scale} height="5" className="fill-stone-200/90 stroke-stone-600" />
            <line x1={toX(wallCenter)} y1={toY(0)} x2={toX(wallCenter)} y2={toY(reachDepth)} className={slidingDividerAligned ? 'stroke-emerald-600' : 'stroke-red-600'} strokeWidth="2" strokeDasharray="4 3" />
            <text x={toX(wallCenter)} y={toY(depth) + 14} textAnchor="middle" className={slidingDividerAligned ? 'fill-emerald-700 text-[10px] font-bold' : 'fill-red-700 text-[10px] font-bold'}>
              sliding centerline
            </text>
          </g>
        )}

        {segments.map(({ module, start, length, center }, index) => (
          <g key={`reach-plan-${module.id}`}>
            <rect
              x={toX(start)}
              y={toY(1.4)}
              width={length * scale}
              height={(depth - 2.8) * scale}
              className={index % 2 ? 'fill-orange-200/75 stroke-orange-800' : 'fill-orange-100/75 stroke-orange-800'}
            />
            <text x={toX(center)} y={toY(depth / 2) + 3} textAnchor="middle" className="fill-stone-900 text-[10px] font-bold">
              {module.code} {module.width}"
            </text>
          </g>
        ))}

        {remainingDepth > 0 && (
          <g>
            <rect x={toX(0)} y={toY(depth)} width={backWidth * scale} height={remainingDepth * scale} className="fill-stone-200/45 stroke-stone-400" strokeDasharray="4 3" />
            <text x={toX(backWidth / 2)} y={toY(depth + remainingDepth / 2) + 4} textAnchor="middle" className="fill-stone-700 text-[11px] font-bold">
              {formatInches(remainingDepth)} clear depth beyond 14" unit
            </text>
          </g>
        )}

        <text x={toX(backWidth / 2)} y={toY(0) - 10} textAnchor="middle" className="fill-stone-700 text-[11px] font-bold">
          Back wall {formatInches(backWidth)}
        </text>
        <text x={toX(backWidth) + 10} y={toY(depth / 2)} className="fill-orange-800 text-[10px] font-bold">
          14" unit
        </text>
        <text x={toX(backWidth) + 10} y={toY(reachDepth / 2)} className="fill-stone-600 text-[10px] font-bold">
          Depth {formatInches(reachDepth)}
        </text>
        <text x={toX(leftReturn + doorWidth / 2)} y={toY(reachDepth) + 18} textAnchor="middle" className="fill-emerald-700 text-[10px] font-bold">
          Opening {formatInches(doorWidth)}
        </text>
        {leftReturn > 0 && (
          <text x={toX(leftReturn / 2)} y={toY(reachDepth) + 18} textAnchor="middle" className="fill-stone-500 text-[10px] font-bold">
            L {formatInches(leftReturn)}
          </text>
        )}
        {rightReturn > 0 && (
          <text x={toX(openingEnd + rightReturn / 2)} y={toY(reachDepth) + 18} textAnchor="middle" className="fill-stone-500 text-[10px] font-bold">
            R {formatInches(rightReturn)}
          </text>
        )}
      </svg>
    </section>
  );
}

function GeneratePhotosButton({ drawing, installationType, onGenerated }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const shots = getPhotoExportPlan(drawing, installationType);

  const generatePhotos = async () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      setStatus('Geometry canvas is not ready.');
      return;
    }

    setBusy(true);
    setStatus(`Generating ${shots.length} ${shots.length === 1 ? 'photo' : 'photos'}...`);

    try {
      const response = await fetch('/api/generate-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: drawing.handle,
          height: drawing.height,
          assembledWidth: drawing.assembledWidth,
          towerSpecs: (drawing.towers || drawing.towerSpecs || []).map((tower) => ({ code: tower.code, width: tower.width })),
          installationType,
          shots,
          geometryDataUrl: canvas.toDataURL('image/png'),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Photo generation failed.');

      setStatus(`${payload.generated.length} ${payload.generated.length === 1 ? 'photo' : 'photos'} generated.`);
      onGenerated?.();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={generatePhotos}
        disabled={busy}
        className="rounded bg-brand-orange px-3 py-1.5 text-sm font-black text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? 'Generating...' : `Generate ${shots.length} ${shots.length === 1 ? 'photo' : 'photos'}`}
      </button>
      {status && <span className="max-w-72 text-xs font-semibold text-stone-600">{status}</span>}
    </div>
  );
}

function GeneratedPhotoGallery({ drawing, onSelectHandle, refreshToken }) {
  const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState('Loading generated drafts...');
  const [sceneFilter, setSceneFilter] = useState('all');
  const handleSlug = seoSlug(drawing.handle);

  useEffect(() => {
    let ignore = false;

    fetch('/api/photo-drafts')
      .then((response) => response.json())
      .then((payload) => {
        if (ignore) return;
        const allPhotos = Array.isArray(payload.photos) ? payload.photos : [];
        setPhotos(allPhotos);
        setStatus(allPhotos.length ? '' : 'No generated drafts have been saved yet.');
      })
      .catch((error) => {
        if (!ignore) setStatus(error.message);
      });

    return () => {
      ignore = true;
    };
  }, [refreshToken]);

  const matchingPhotos = photos.filter((photo) => photo.name.startsWith(`${handleSlug}-`));
  const displayedPhotos = matchingPhotos.filter((photo) => {
    if (sceneFilter === 'product') return photo.name.includes('-product-hero-');
    if (sceneFilter === 'reach-in') return photo.name.includes('-reach-in-installed-');
    if (sceneFilter === 'walk-in') return photo.name.includes('-walk-in-hero-');
    return true;
  });
  const availableHandles = [...new Set(photos.map((photo) => photo.name.split(/-(?:product-hero|reach-in-installed|walk-in-hero)-/)[0]).filter(Boolean))].sort();

  return (
    <section className="h-full overflow-y-auto bg-stone-100 p-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">AI realistic drafts</p>
            <h2 className="mt-1 text-xl font-black text-stone-950">Generated Photos</h2>
            <p className="mt-1 text-sm text-stone-600">
              Saved under <code>assets/drafts/generated-photos</code>. These are drafts only and are never added to exports without approval.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              ['all', 'All'],
              ['product', 'Product only'],
              ['reach-in', 'Installed reach-in'],
              ['walk-in', 'Walk-in'],
            ].map(([filter, label]) => (
              <button
                key={filter}
                type="button"
                onClick={() => setSceneFilter(filter)}
                className={`rounded-full px-3 py-1 text-xs font-bold shadow-sm ${sceneFilter === filter ? 'bg-brand-orange text-white' : 'bg-white text-stone-600 hover:bg-stone-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {status ? (
          <div className="rounded border border-dashed border-stone-300 bg-white p-8 text-center text-sm font-semibold text-stone-500">{status}</div>
        ) : matchingPhotos.length === 0 ? (
          <div className="rounded border border-dashed border-amber-300 bg-amber-50 p-8 text-center">
            <p className="text-base font-black text-stone-900">No generated photos for {drawing.handle}</p>
            <p className="mt-2 text-sm font-semibold text-stone-600">The gallery never substitutes photos from another SKU.</p>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-stone-500">Choose a SKU with generated drafts</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {availableHandles.map((handle) => (
                <button
                  key={handle}
                  type="button"
                  onClick={() => onSelectHandle?.(handle.toUpperCase())}
                  className="rounded border border-brand-orange bg-white px-3 py-1.5 text-xs font-bold uppercase text-brand-orange hover:bg-brand-orange hover:text-white"
                >
                  {handle}
                </button>
              ))}
            </div>
          </div>
        ) : displayedPhotos.length === 0 ? (
          <div className="rounded border border-dashed border-stone-300 bg-white p-8 text-center text-sm font-semibold text-stone-500">
            No {sceneFilter.replace('-', ' ')} draft has been generated for {drawing.handle}.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {displayedPhotos.map((photo) => (
              <article key={photo.name} className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                <div className="aspect-square bg-stone-50">
                  <img src={photo.url} alt={photo.name.replace(/-/g, ' ')} className="h-full w-full object-contain" />
                </div>
                <div className="border-t border-stone-200 p-3">
                  <p className="break-all text-xs font-bold text-stone-800">{photo.name}</p>
                  <p className="mt-1 text-[11px] font-semibold text-amber-700">Draft · awaiting approval</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function buildMaterialSummary(modules) {
  const counts = new Map();
  const add = (label, quantity = 1) => counts.set(label, (counts.get(label) || 0) + quantity);

  if (modules.length === 0) {
    return [];
  }

  add('Vertical panels', modules.length + 1);
  add('Toe kicks', modules.length);

  modules.forEach((module) => {
    const tall = module.code === 'S8' || module.code === 'S9';
    const shelfCounts = {
      LH: 3,
      DH: 3,
      HS: 5,
      S3D: tall ? 7 : 6,
      H3D: 4,
      S2D: tall ? 7 : 6,
      S7: 8,
      S8: 9,
    };
    const rodCounts = {
      LH: 1,
      DH: 2,
      HS: 1,
      H3D: 1,
    };
    const drawerCounts = {
      S3D: '2 small + 1 large drawer kit',
      H3D: '2 small + 1 large drawer kit',
      S2D: '2 small drawer kits',
    };

    add(`${module.width}" shelf boards`, shelfCounts[module.code] || 0);
    add(`${module.width}" rods`, rodCounts[module.code] || 0);

    if (drawerCounts[module.code]) {
      add(drawerCounts[module.code]);
    }
  });

  return [...counts.entries()].filter(([, quantity]) => quantity > 0).map(([label, quantity]) => ({ label, quantity }));
}

function buildDetailedReachInParts(modules, height) {
  const parts = new Map();
  const add = (sku, name, quantity = 1, details = '', category = 'Parts') => {
    if (!quantity) return;
    const key = `${category}|${sku}|${name}|${details}`;
    const current = parts.get(key);
    parts.set(key, {
      category,
      sku,
      name,
      details,
      quantity: (current?.quantity || 0) + quantity,
    });
  };

  if (!modules.length) {
    return [];
  }

  add(`VL-24-${height}-W`, `Left vertical panel 24" x ${height}"`, 1, 'Outer left side panel.', 'Panels');
  add(`VR-24-${height}-W`, `Right vertical panel 24" x ${height}"`, 1, 'Outer right side panel.', 'Panels');
  add(`VD-24-${height}-W`, `Shared divider panel 24" x ${height}"`, Math.max(0, modules.length - 1), 'One shared divider at each tower joint; no doubled side panels.', 'Panels');

  const drawing = createDrawing(createPlannerDrawing(height, modules));
  let adjustableShelfCount = 0;
  let rodCount = 0;
  let smallDrawerCount = 0;
  let largeDrawerCount = 0;

  drawing.towers.forEach((tower) => {
    const layout = buildTowerLayout(drawing, tower);
    const fixedShelves = layout.shelves.filter((shelf) => shelf.fixed).length;
    const adjustableShelves = layout.shelves.length - fixedShelves;
    const rods = layout.rods.length;
    const smallDrawers = layout.drawers.filter((drawer) => drawer.height === 5).length;
    const largeDrawers = layout.drawers.filter((drawer) => drawer.height === 10).length;

    adjustableShelfCount += adjustableShelves;
    rodCount += rods;
    smallDrawerCount += smallDrawers;
    largeDrawerCount += largeDrawers;

    add(`FS-${tower.width}-14-W`, `Fixed shelf ${tower.width}" x 14"`, fixedShelves, `${towerNames[tower.code] || tower.code} ${tower.width}" bay structural shelves.`, 'Shelves');
    add(`SH-${tower.width}-14-W`, `Adjustable shelf ${tower.width}" x 14"`, adjustableShelves, `${towerNames[tower.code] || tower.code} ${tower.width}" bay movable shelves.`, 'Shelves');
    add(`TKK-${tower.width}-5-W`, `Toe-kick kit ${tower.width}" x 5"`, 1, 'Toe-kick kit for this tower bay.', 'Kits');
    add(`RK-${tower.width}-S`, `Rod kit ${tower.width}"`, rods, 'Hanging rod kit for this bay width.', 'Kits');
  });

  add('DRK-24-5-13-W', 'Small drawer kit 24" x 5" x 13"', smallDrawerCount, 'Complete drawer kit with panels, rails, screws, and centered bar pull.', 'Kits');
  add('DRK-24-10-13-W', 'Large drawer kit 24" x 10" x 13"', largeDrawerCount, 'Complete drawer kit with panels, rails, screws, and centered bar pull.', 'Kits');
  add('RDB-S-1', 'Rod bracket set, pair', rodCount, `${rodCount * 2} individual brackets total; one pair per rod.`, 'Hardware');
  const wallBracketCount = modules.length * 2;
  add('WLB-S-1', 'Wall L-bracket', wallBracketCount, 'Two wall safety brackets per tower section.', 'Hardware');
  add('PIN-20-S', 'Shelf pin pack, 20 pins', Math.ceil((adjustableShelfCount * 4) / 20), `${adjustableShelfCount * 4} shelf pins required for ${adjustableShelfCount} adjustable shelves.`, 'Hardware');
  add('CAMKIT-10-W', 'Rafix/cam lock and screw kit, 10 pieces', modules.length, `${modules.length * 8} Rafix/bolt connector positions required; one 10-piece kit packed per tower.`, 'Hardware');
  add('WOOD-SCREW', 'Wood screws for wall L-brackets', wallBracketCount, 'One wood screw per wall L-bracket to connect the bracket to the fixed shelf.', 'Hardware');
  add('WALL-SCREW', 'Wall/stud screws for wall L-brackets', wallBracketCount, 'One wall screw per wall L-bracket to connect the bracket to a stud or suitable wall anchor.', 'Hardware');

  return [...parts.values()].filter((part) => part.quantity > 0);
}

function aggregatePartsBySku(parts) {
  const aggregated = new Map();

  parts.forEach((part) => {
    const key = `${part.category}|${part.sku}`;
    const current = aggregated.get(key) || {
      category: part.category,
      sku: part.sku,
      name: part.name,
      quantity: 0,
      detailSet: new Set(),
      nameSet: new Set(),
    };

    current.quantity += part.quantity;
    if (part.name) current.nameSet.add(part.name);
    if (part.details) current.detailSet.add(part.details);
    aggregated.set(key, current);
  });

  return [...aggregated.values()].map((part) => ({
    category: part.category,
    sku: part.sku,
    name: [...part.nameSet][0] || part.name,
    quantity: part.quantity,
    details: [...part.detailSet].join(', '),
  }));
}

function PartsList({ parts }) {
  const groups = ['Panels', 'Shelves', 'Kits', 'Hardware'];
  const aggregatedParts = aggregatePartsBySku(parts);

  return (
    <section className="min-w-0 rounded border border-stone-200 bg-white p-4">
      <h2 className="text-lg font-bold text-stone-950">Exact Part List</h2>
      <div className="mt-3 grid gap-4">
        {groups.map((group) => {
          const items = aggregatedParts.filter((part) => part.category === group);

          if (!items.length) return null;

          return (
            <div key={group} className="min-w-0">
              <h3 className="text-sm font-bold uppercase text-brand-orange">{group}</h3>
              <div className="mt-2 w-full max-w-full overflow-x-auto rounded border border-stone-200">
                <table className="min-w-[620px] w-full text-left text-sm sm:min-w-[760px]">
                  <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                    <tr>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((part) => (
                      <tr key={`${part.category}-${part.sku}-${part.name}`} className="border-t border-stone-100">
                        <td className="px-3 py-2 font-bold text-stone-950">{part.quantity}</td>
                        <td className="px-3 py-2 font-bold text-stone-700">{part.sku}</td>
                        <td className="px-3 py-2 font-semibold text-stone-800">{part.name}</td>
                        <td className="px-3 py-2 text-stone-600">{part.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function isDrawerTower(module) {
  return ['S3D', 'H3D', 'S2D'].includes(module.code);
}

function SummaryMetricGrid({ items, layout = 'horizontal' }) {
  const metricClass = layout === 'rail' ? 'grid grid-cols-2 gap-2 text-xs' : 'grid grid-cols-4 gap-1.5 text-xs';

  return (
    <div className={metricClass}>
      {items.map(({ label, value, tone = 'text-stone-950' }) => (
        <div key={label} className="rounded bg-stone-50 px-2 py-1.5">
          <div className="font-semibold text-stone-500">{label}</div>
          <div className={`text-sm font-bold ${tone}`}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function ReachInSpaceSummary({ planDetails, onEdit, children }) {
  const doorLabel = reachInDoorTypes.find((type) => type.value === planDetails.doorType)?.label || 'No door / regular';
  const items = [
    { label: 'Back wall', value: formatInches(planDetails.wallWidth || 0) },
    { label: 'Closet depth', value: formatInches(planDetails.roomDepthInput || planDetails.roomDepth || 0) },
    { label: 'Ceiling', value: formatInches(planDetails.ceilingHeight || 0), tone: planDetails.ceilingClear ? 'text-emerald-700' : 'text-red-700' },
    { label: 'Opening', value: formatInches(planDetails.openingWidth || 0), tone: planDetails.openingClear ? 'text-stone-950' : 'text-red-700' },
    { label: 'Return walls', value: `${formatInches(planDetails.openingLeft || 0)} / ${formatInches(planDetails.openingRight || 0)}` },
    { label: 'Open total', value: formatInches(planDetails.openingTotal || 0), tone: planDetails.openingMatchesWall ? 'text-emerald-700' : 'text-red-700' },
    { label: 'Door type', value: doorLabel },
    {
      label: 'Drawer access',
      value: planDetails.drawerAccessClear ? 'OK' : 'Blocked',
      tone: planDetails.drawerAccessClear ? 'text-emerald-700' : 'text-red-700',
    },
    {
      label: 'Sliding divider',
      value: planDetails.doorType === 'sliding' ? (planDetails.slidingDividerAligned ? 'Centered' : 'Off center') : 'N/A',
      tone: planDetails.slidingDividerAligned ? 'text-emerald-700' : 'text-red-700',
    },
  ];

  return (
    <section className="rounded border border-stone-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-stone-950">Closet space summary</h2>
        <button type="button" onClick={onEdit} className="rounded border border-stone-300 px-2 py-1 text-xs font-bold text-stone-700 hover:border-brand-orange">
          Edit
        </button>
      </div>
      <div className="mt-3">
        <SummaryMetricGrid items={items} />
      </div>
      {planDetails.drawerWarnings?.length > 0 && (
        <div className="mt-3 grid gap-2">
          {planDetails.drawerWarnings.map((warning) => (
            <div key={warning} className="rounded bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
              {warning}
            </div>
          ))}
        </div>
      )}
      {children}
    </section>
  );
}

function ReachInClosetDetailsSummary({ planDetails, moduleCount, embedded = false }) {
  const details = [
    ['System height', formatInches(planDetails.height || 0)],
    ['Closet unit depth', formatInches(depth)],
    ['Assembled', moduleCount ? `${planDetails.assembledWidth.toFixed(2)}"` : '-'],
    ['Wall needed', moduleCount ? `${planDetails.requiredWidth.toFixed(2)}"` : '-'],
    ['Remaining', moduleCount ? `${planDetails.remainingWidth.toFixed(2)}"` : '-'],
    ['Towers', moduleCount || '-'],
    ['Clear depth', formatInches(planDetails.clearDepth || 0)],
    ['Fit', planDetails.fits ? 'Fits' : 'Needs adjustment'],
  ];

  const content = (
    <>
      <h3 className="text-sm font-bold text-stone-950">Closet details</h3>
      <dl className="mt-3 grid grid-cols-4 gap-2 text-xs">
        {details.map(([label, value]) => (
          <div key={label} className="rounded bg-stone-50 px-2 py-1.5">
            <dt className="font-semibold text-stone-500">{label}</dt>
            <dd className="mt-0.5 font-bold text-stone-950">{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );

  if (embedded) {
    return <div className="mt-3 border-t border-stone-200 pt-3">{content}</div>;
  }

  return (
    <section className="rounded border border-stone-200 bg-white p-3">
      {content}
    </section>
  );
}

function ModuleControlStrip({ modules, height, onRemove, onMove, onWidthChange }) {
  const cardGridColumns = modules.map((module) => `minmax(8.5rem, ${module.width}fr)`).join(' ');
  const denseCards = modules.length >= 5;

  if (modules.length === 0) {
    return (
      <section className="border-b border-stone-200 bg-white p-3">
        <div className="rounded border border-dashed border-stone-300 bg-stone-50 p-4 text-center text-sm font-semibold text-stone-400">
          Build your closets by clicking or dragging any of the above configurations.
        </div>
      </section>
    );
  }

  return (
    <section className="border-b border-stone-200 bg-white p-3">
      <h2 className="mb-2 text-sm font-bold text-stone-950">Tower selected</h2>
      <div className="w-full overflow-x-auto pb-1">
        <div className="grid min-w-max items-start gap-2 xl:min-w-0" style={{ gridTemplateColumns: cardGridColumns }}>
        {modules.map((module, index) => {
          const widthOptions = getWidthOptions(module.configCode);

          return (
            <article key={module.id} className="min-w-0 rounded border border-stone-200 bg-stone-50 p-2 xl:[grid-column:auto]">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1">
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-stone-950" title={towerNames[module.code] || module.code}>
                    {towerNames[module.code] || module.code}
                  </div>
                  <div className="text-[11px] font-semibold text-stone-500">{module.code} / {height}"H</div>
                </div>
                <button type="button" onClick={() => onRemove(module.id)} className="grid h-6 w-6 place-items-center rounded text-sm font-bold leading-none text-red-700 hover:bg-red-100" title="Remove tower">
                  x
                </button>
              </div>
              <div className={`mt-2 grid items-center gap-1 ${denseCards ? 'grid-cols-2' : 'grid-cols-[1fr_auto_auto]'}`}>
                <select
                  value={module.width}
                  onChange={(event) => onWidthChange(module.id, Number(event.target.value))}
                  className={`min-w-0 rounded border border-stone-300 bg-white px-1.5 py-1 text-xs font-bold text-stone-700 ${denseCards ? 'col-span-2' : ''}`}
                >
                  {widthOptions.map((width) => (
                    <option key={width} value={width}>
                      {width}" bay
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onMove(index, -1)}
                  disabled={index === 0}
                  className={`${denseCards ? 'w-full' : 'w-7'} grid h-7 place-items-center rounded border border-stone-300 bg-white text-sm disabled:opacity-25`}
                  title="Move tower left"
                >
                  👈
                </button>
                <button
                  type="button"
                  onClick={() => onMove(index, 1)}
                  disabled={index === modules.length - 1}
                  className={`${denseCards ? 'w-full' : 'w-7'} grid h-7 place-items-center rounded border border-stone-300 bg-white text-sm disabled:opacity-25`}
                  title="Move tower right"
                >
                  👉
                </button>
              </div>
            </article>
          );
        })}
        </div>
      </div>
    </section>
  );
}

function getReachInValidationMessages(planDetails) {
  if (!planDetails) return [];

  const messages = [];

  if (planDetails.requiredWidth > 0 && planDetails.wallWidth < planDetails.requiredWidth) {
    messages.push(`This closet configuration is too wide. It needs ${formatInches(planDetails.requiredWidth)} of wall space, but the closet wall is ${formatInches(planDetails.wallWidth)}.`);
  }

  if (!planDetails.openingMatchesWall) {
    messages.push('The opening and return wall dimensions need to add up to the full closet width.');
  }

  if (!planDetails.openingClear) {
    messages.push('The closet opening must be at least 24" wide.');
  }

  if (!planDetails.slidingDividerAligned) {
    messages.push('For sliding doors, a shared divider must be centered so each side can be reached when one door is closed.');
  }

  if (!planDetails.ceilingClear) {
    messages.push('The selected tower height must be lower than the ceiling height.');
  }

  return [...messages, ...(planDetails.drawerWarnings || [])];
}

function MatchPanel({ evaluation, modules, planDetails, onContinue, isCatalogReady }) {
  const hasModules = modules.length > 0;
  const validationMessages = getReachInValidationMessages(planDetails);
  const canVerifyEstimate = Boolean(planDetails?.fits);

  if (!hasModules) {
    return (
      <section className="rounded border border-stone-200 bg-white p-3">
        <h2 className="text-base font-bold text-stone-950">Product Match</h2>
        <p className="mt-2 text-sm text-stone-500">Add modules to check whether the layout already exists as a product.</p>
      </section>
    );
  }

  if (evaluation.match) {
    return (
      <section className="rounded border border-emerald-200 bg-emerald-50 p-3">
        <div className="text-xs font-bold uppercase tracking-wide text-emerald-700">Existing product found</div>
        <h2 className="mt-1 text-base font-bold text-stone-950">{evaluation.match.title}</h2>
        <p className="mt-2 text-sm text-stone-700">
          This layout matches a standard product. Tower order is modular, so the page can be used even if the preview order is different.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {evaluation.displayPrice > 0 && (
            <span className="text-lg font-bold text-emerald-800">
              {money(evaluation.displayPrice)} <span className="text-xs font-bold uppercase tracking-wide text-emerald-700">kit price</span>
            </span>
          )}
          {evaluation.match.productUrl && canVerifyEstimate && (
            <a
              href={evaluation.match.productUrl}
              className="rounded bg-brand-orange px-3 py-2 text-sm font-bold text-white transition hover:bg-orange-700"
            >
              Buy This System
            </a>
          )}
          <button type="button" onClick={onContinue} disabled={!canVerifyEstimate} className="rounded bg-stone-950 px-3 py-2 text-sm font-bold text-white disabled:bg-stone-300">
            Verify estimate
          </button>
        </div>
        {validationMessages.length > 0 && (
          <div className="mt-3 grid gap-2">
            {validationMessages.map((warning) => (
              <div key={warning} className="rounded bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                {warning}
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
      <section className="rounded border border-stone-200 bg-white p-3">
        <h2 className="text-base font-bold text-stone-950">Ready For Review</h2>
        <p className="mt-2 text-sm text-stone-700">Review the material and order details before submitting for verification.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-lg font-bold text-stone-950">{money(evaluation.estimatedPrice)} estimated</span>
        <button type="button" onClick={onContinue} disabled={!canVerifyEstimate} className="rounded bg-stone-950 px-3 py-2 text-sm font-bold text-white disabled:bg-stone-300">
          Verify estimate
        </button>
      </div>
      {validationMessages.length > 0 && (
        <div className="mt-3 grid gap-2">
          {validationMessages.map((warning) => (
            <div key={warning} className="rounded bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
              {warning}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function OrderReviewPanel({ evaluation, modules, planDetails, onBack }) {
  const [customer, setCustomer] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [submitStatus, setSubmitStatus] = useState({ state: 'idle', message: '' });
  const materials = useMemo(() => buildMaterialSummary(modules), [modules]);

  const submitForVerification = async (event) => {
    event.preventDefault();
    setSubmitStatus({ state: 'loading', message: 'Submitting for verification...' });

    try {
      const response = await fetch('/api/quote-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...planDetails,
          customer,
          materials,
          planType: 'reach-in',
          planUrl: buildReachInPlanUrl(planDetails, modules),
          modules: modules.map((module, index) => ({
            index,
            code: module.code,
            width: module.width,
            label: module.label,
          })),
          estimatedPrice: evaluation.displayPrice || evaluation.estimatedPrice,
          signature: evaluation.signature,
          internalType: 'reach-in estimate verification',
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to submit verification request');
      }

      setSubmitStatus({
        state: 'success',
        message: '',
        quoteId: payload.quoteId,
      });
    } catch (error) {
      setSubmitStatus({
        state: 'error',
        message: error.message,
      });
    }
  };

  return (
    <section className="bg-white p-5">
      <div className="mx-auto max-w-4xl">
        <button type="button" onClick={onBack} className="mb-4 rounded border border-stone-300 px-3 py-1.5 text-sm font-bold text-stone-700">
          Back to planner
        </button>
        <h2 className="text-xl font-bold text-stone-950">Order Verification Details</h2>
        <p className="mt-2 text-sm text-stone-600">
          To verify and confirm your order, please provide your information. We will send you a follow-up link to purchase once we verify the order.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <section className="rounded border border-stone-200 p-3">
            <h3 className="text-sm font-bold text-stone-950">Order Details</h3>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <dt className="font-semibold text-stone-500">Height</dt>
              <dd className="font-bold text-stone-950">{planDetails.height}"</dd>
              <dt className="font-semibold text-stone-500">Wall width</dt>
              <dd className="font-bold text-stone-950">{planDetails.wallWidth}"</dd>
              <dt className="font-semibold text-stone-500">Closet depth</dt>
              <dd className="font-bold text-stone-950">{formatInches(planDetails.roomDepth || depth)}</dd>
              <dt className="font-semibold text-stone-500">Clear depth</dt>
              <dd className="font-bold text-stone-950">{formatInches(planDetails.clearDepth || 0)}</dd>
              <dt className="font-semibold text-stone-500">Opening</dt>
              <dd className="font-bold text-stone-950">{formatInches(planDetails.openingWidth || 0)}</dd>
              <dt className="font-semibold text-stone-500">Return walls</dt>
              <dd className="font-bold text-stone-950">{formatInches(planDetails.openingLeft || 0)} / {formatInches(planDetails.openingRight || 0)}</dd>
              <dt className="font-semibold text-stone-500">Door type</dt>
              <dd className="font-bold text-stone-950">{reachInDoorTypes.find((type) => type.value === planDetails.doorType)?.label || 'No door / regular'}</dd>
              <dt className="font-semibold text-stone-500">Sliding divider</dt>
              <dd className={`font-bold ${planDetails.slidingDividerAligned ? 'text-stone-950' : 'text-red-700'}`}>
                {planDetails.doorType === 'sliding' ? (planDetails.slidingDividerAligned ? 'Centered' : 'Off center') : 'N/A'}
              </dd>
              <dt className="font-semibold text-stone-500">Assembled</dt>
              <dd className="font-bold text-stone-950">{planDetails.assembledWidth.toFixed(2)}"</dd>
              <dt className="font-semibold text-stone-500">Needed wall</dt>
              <dd className="font-bold text-stone-950">{planDetails.requiredWidth.toFixed(2)}"</dd>
              <dt className="font-semibold text-stone-500">Estimated price</dt>
              <dd className="font-bold text-stone-950">{money(evaluation.displayPrice || evaluation.estimatedPrice)}</dd>
            </dl>
          </section>

          <section className="rounded border border-stone-200 p-3">
            <h3 className="text-sm font-bold text-stone-950">Towers</h3>
            <ul className="mt-2 space-y-1 text-sm font-semibold text-stone-700">
              {modules.map((module, index) => (
                <li key={module.id}>{index + 1}. {towerNames[module.code] || module.code} / {module.width}" bay</li>
              ))}
            </ul>
          </section>

          <section className="rounded border border-stone-200 p-3 md:col-span-2">
            <h3 className="text-sm font-bold text-stone-950">Material Summary</h3>
            <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {materials.map((item) => (
                <div key={item.label} className="flex justify-between rounded bg-stone-50 px-2 py-1">
                  <span className="font-semibold text-stone-600">{item.label}</span>
                  <span className="font-bold text-stone-950">{item.quantity}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <form className="mt-4 rounded border border-stone-200 p-3" onSubmit={submitForVerification}>
          <h3 className="text-sm font-bold text-stone-950">Contact Information</h3>
          {submitStatus.state === 'success' ? (
            <div className="mt-3">
              <SavedPlanActions quoteId={submitStatus.quoteId} />
            </div>
          ) : (
            <>
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                <input type="text" value={customer.firstName} onChange={(event) => setCustomer((current) => ({ ...current, firstName: event.target.value }))} placeholder="First name" className="rounded border border-stone-300 px-2 py-1.5 text-sm font-semibold" required />
                <input type="text" value={customer.lastName} onChange={(event) => setCustomer((current) => ({ ...current, lastName: event.target.value }))} placeholder="Last name" className="rounded border border-stone-300 px-2 py-1.5 text-sm font-semibold" required />
                <input type="email" value={customer.email} onChange={(event) => setCustomer((current) => ({ ...current, email: event.target.value }))} placeholder="Email" className="rounded border border-stone-300 px-2 py-1.5 text-sm font-semibold" required />
                <input type="tel" value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone" className="rounded border border-stone-300 px-2 py-1.5 text-sm font-semibold" required />
              </div>
              <button type="submit" disabled={submitStatus.state === 'loading'} className="mt-3 rounded bg-stone-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                Verify estimate
              </button>
            </>
          )}
          {submitStatus.state === 'error' && submitStatus.message && (
            <p className={`mt-2 rounded px-2 py-1.5 text-xs font-bold ${submitStatus.state === 'error' ? 'bg-red-100 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {submitStatus.message}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}

function ReachInEstimatePage({ evaluation, modules, planDetails, drawing }) {
  const [previewMode, setPreviewMode] = useState('plan');
  const [customer, setCustomer] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [submitStatus, setSubmitStatus] = useState({ state: 'idle', message: '' });
  const parts = useMemo(() => buildDetailedReachInParts(modules, planDetails.height), [modules, planDetails.height]);
  const planUrl = useMemo(() => buildReachInPlanUrl(planDetails, modules), [planDetails, modules]);
  const validationMessages = getReachInValidationMessages(planDetails);
  const canSavePlan = Boolean(planDetails?.fits);
  const submitForVerification = async (event) => {
    event.preventDefault();
    if (!canSavePlan) {
      setSubmitStatus({ state: 'error', message: 'Please fix the closet configuration before saving this estimate.' });
      return;
    }

    setSubmitStatus({ state: 'loading', message: 'Saving plan to your account...' });

    try {
      const response = await fetch('/api/quote-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...planDetails,
          customer,
          materials: parts.map(({ category, sku, name, quantity }) => ({ category, sku, name, quantity })),
          planType: 'reach-in',
          planUrl,
          modules: modules.map((module, index) => ({
            index,
            code: module.code,
            width: module.width,
            label: module.label,
          })),
          estimatedPrice: evaluation.displayPrice || evaluation.estimatedPrice,
          signature: evaluation.signature,
          internalType: 'reach-in estimate verification',
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to save estimate');
      }

      setSubmitStatus({
        state: 'success',
        message: '',
        quoteId: payload.quoteId,
      });
    } catch (error) {
      setSubmitStatus({
        state: 'error',
        message: error.message,
      });
    }
  };

  return (
    <main className="h-screen overflow-y-auto bg-brand-ui p-2 text-brand-black sm:p-4">
      <div className="mx-auto grid max-w-6xl gap-4">
        <header className="rounded border border-stone-200 bg-white p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-brand-orange">Closets Warehouse</p>
              <h1 className="text-xl font-bold text-stone-950 sm:text-2xl">Reach-in Estimate Detail</h1>
              <p className="mt-1 text-sm font-semibold text-stone-600">Saved plan, visual review, and exact build parts for verification.</p>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-xs font-bold uppercase text-stone-500">Estimated price</div>
              <div className="text-2xl font-bold text-stone-950">{money(evaluation.displayPrice || evaluation.estimatedPrice) || '$0.00'}</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={planUrl} className="rounded bg-brand-orange px-3 py-2 text-sm font-bold text-white hover:bg-orange-700">Open editable plan</a>
            <a href="/" className="rounded border border-stone-300 px-3 py-2 text-sm font-bold text-stone-700 hover:bg-stone-50">Start new plan</a>
            <ConsultationCta />
          </div>
        </header>

        <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid min-w-0 gap-4">
            <section className="min-w-0 rounded border border-stone-200 bg-white p-2 sm:p-3">
              <div className="mb-3 flex justify-end">
                <div className="flex rounded border border-stone-300 bg-white p-0.5 text-xs font-bold">
                  {[
                    ['plan', 'Plan'],
                    ['3d', '3D'],
                  ].map(([mode, label]) => (
                    <button key={mode} type="button" onClick={() => setPreviewMode(mode)} className={`rounded px-3 py-1.5 ${previewMode === mode ? 'bg-brand-orange text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {previewMode === 'plan' ? (
                <ReachInPlanView
                  modules={modules}
                  wallWidth={planDetails.wallWidth}
                  roomDepth={planDetails.roomDepth}
                  openingWidth={planDetails.openingWidth}
                  openingLeft={planDetails.openingLeft}
                  openingRight={planDetails.openingRight}
                  doorType={planDetails.doorType}
                  height={planDetails.height}
                  drawerWarnings={planDetails.drawerWarnings}
                />
              ) : (
                <div className="relative h-[520px] overflow-hidden rounded bg-white">
                  <OrbitHintBadge />
                  <Canvas className="h-full w-full" camera={{ position: [0, 50, 105], fov: 34 }} dpr={[1, 2]} shadows>
                    <RenderScene drawing={drawing} photoMode={false} wallWidth={planDetails.wallWidth} reachInRoom={planDetails} />
                  </Canvas>
                </div>
              )}
            </section>
            <PartsList parts={parts} />
          </div>

          <aside className="grid min-w-0 gap-3 self-start">
            <form className="rounded border border-stone-200 bg-white p-4" onSubmit={submitForVerification}>
              <h2 className="text-base font-bold text-stone-950">Save Plan</h2>
              {submitStatus.state === 'success' ? (
                <div className="mt-3">
                  <SavedPlanActions quoteId={submitStatus.quoteId} />
                </div>
              ) : (
                <>
                  <p className="mt-1 text-sm font-semibold text-stone-600">Enter your info to save this plan to your customer account and subscribe for follow-up.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input type="text" value={customer.firstName} onChange={(event) => setCustomer((current) => ({ ...current, firstName: event.target.value }))} placeholder="First name" className="rounded border border-stone-300 px-2 py-1.5 text-sm font-semibold" required />
                    <input type="text" value={customer.lastName} onChange={(event) => setCustomer((current) => ({ ...current, lastName: event.target.value }))} placeholder="Last name" className="rounded border border-stone-300 px-2 py-1.5 text-sm font-semibold" required />
                    <input type="email" value={customer.email} onChange={(event) => setCustomer((current) => ({ ...current, email: event.target.value }))} placeholder="Email" className="rounded border border-stone-300 px-2 py-1.5 text-sm font-semibold" required />
                    <input type="tel" value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone" className="rounded border border-stone-300 px-2 py-1.5 text-sm font-semibold" />
                  </div>
                  {validationMessages.length > 0 && (
                    <div className="mt-3 grid gap-2">
                      {validationMessages.map((warning) => (
                        <div key={warning} className="rounded bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                          {warning}
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="submit" disabled={submitStatus.state === 'loading' || !canSavePlan} className="mt-3 w-full rounded bg-stone-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                    Save to account
                  </button>
                </>
              )}
              {submitStatus.state === 'error' && submitStatus.message && (
                <p className={`mt-2 rounded px-2 py-1.5 text-xs font-bold ${submitStatus.state === 'error' ? 'bg-red-100 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {submitStatus.message}
                </p>
              )}
            </form>
            <section className="rounded border border-stone-200 bg-white p-4">
              <h2 className="text-base font-bold text-stone-950">Plan Summary</h2>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <dt className="font-semibold text-stone-500">Height</dt>
                <dd className="text-right font-bold">{formatInches(planDetails.height)}</dd>
                <dt className="font-semibold text-stone-500">Wall width</dt>
                <dd className="text-right font-bold">{formatInches(planDetails.wallWidth)}</dd>
                <dt className="font-semibold text-stone-500">Assembled</dt>
                <dd className="text-right font-bold">{formatInches(planDetails.assembledWidth)}</dd>
                <dt className="font-semibold text-stone-500">Needed</dt>
                <dd className="text-right font-bold">{formatInches(planDetails.requiredWidth)}</dd>
                <dt className="font-semibold text-stone-500">Opening</dt>
                <dd className="text-right font-bold">{formatInches(planDetails.openingWidth)}</dd>
                <dt className="font-semibold text-stone-500">Door</dt>
                <dd className="text-right font-bold">{reachInDoorTypes.find((type) => type.value === planDetails.doorType)?.label || 'No door / regular'}</dd>
              </dl>
            </section>
            <section className="rounded border border-stone-200 bg-white p-4">
              <h2 className="text-base font-bold text-stone-950">Towers</h2>
              <ol className="mt-2 grid gap-1 text-sm font-semibold text-stone-700">
                {modules.map((module, index) => (
                  <li key={module.id}>{index + 1}. {towerNames[module.code] || module.code} / {module.width}" bay</li>
                ))}
              </ol>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function OrbitHintBadge() {
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 grid h-14 w-14 place-items-center rounded-full border border-stone-300 bg-white/85 shadow-sm" aria-hidden="true">
      <svg viewBox="0 0 64 64" className="h-11 w-11 text-stone-700">
        <path d="M12 32c0-9.9 7.4-18.1 17-19.4" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M29 6l8 6-9 5" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M52 32c0 9.9-7.4 18.1-17 19.4" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M35 58l-8-6 9-5" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <text x="32" y="37" textAnchor="middle" className="fill-current text-[15px] font-bold">
          360
        </text>
      </svg>
    </div>
  );
}

function ReachInRoomSetup({
  title = 'Setup',
  plannerHeight,
  onHeightChange,
  ceilingHeight,
  onCeilingHeightChange,
  wallWidth,
  onWallWidthChange,
  reachInDepth,
  onDepthChange,
  doorType,
  onDoorTypeChange,
  openingWidth,
  onOpeningWidthChange,
  openingLeft,
  onOpeningLeftChange,
  openingRight,
  onOpeningRightChange,
  onCenterOpening,
  planDetails,
}) {
  const inputClass = 'w-20 flex-none rounded border border-stone-300 px-2 py-1.5 text-sm font-bold text-stone-950';

  return (
    <section className="rounded border border-stone-200 bg-white p-2.5">
      <h2 className="text-sm font-bold text-stone-950">{title}</h2>
      <div className="mt-2 grid gap-2">
        <div className="grid gap-2 rounded bg-stone-50 p-2 md:grid-cols-4">
          <div>
            <div className="mb-1 text-xs font-semibold text-stone-500">System height</div>
            <div className="max-w-36">
              <HeightSelector height={plannerHeight} onChange={onHeightChange} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-500" htmlFor="ceiling-height">
              Ceiling height
            </label>
            <div className="flex items-center gap-1">
              <input
                id="ceiling-height"
                type="number"
                min="0"
                step="0.25"
                value={ceilingHeight}
                onChange={(event) => onCeilingHeightChange(event.target.value)}
                className={inputClass}
              />
              <span className="text-xs font-bold text-stone-500">in</span>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-500" htmlFor="wall-width">
              Back wall
            </label>
            <div className="flex items-center gap-1">
              <input
                id="wall-width"
                type="number"
                min="18"
                step="0.25"
                value={wallWidth}
                onChange={(event) => onWallWidthChange(event.target.value)}
                className={inputClass}
              />
              <span className="text-xs font-bold text-stone-500">in</span>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-500" htmlFor="reach-in-depth">
              Closet depth
            </label>
            <div className="flex items-center gap-1">
              <input
                id="reach-in-depth"
                type="number"
                min={depth}
                step="0.25"
                value={reachInDepth}
                onChange={(event) => onDepthChange(event.target.value)}
                className={inputClass}
              />
              <span className="text-xs font-bold text-stone-500">in</span>
            </div>
          </div>
        </div>

        <div className="grid gap-2 rounded bg-stone-50 p-2 md:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-500" htmlFor="reach-in-opening">
              Opening width
            </label>
            <div className="flex items-center gap-1">
              <input
                id="reach-in-opening"
                type="number"
                min="0"
                step="0.25"
                value={openingWidth}
                onChange={(event) => onOpeningWidthChange(event.target.value)}
                className={inputClass}
              />
              <span className="text-xs font-bold text-stone-500">in</span>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-500" htmlFor="reach-in-opening-left">
              Left return wall
            </label>
            <div className="flex items-center gap-1">
              <input
                id="reach-in-opening-left"
                type="number"
                min="0"
                step="0.25"
                value={openingLeft}
                onChange={(event) => onOpeningLeftChange(event.target.value)}
                className={inputClass}
              />
              <span className="text-xs font-bold text-stone-500">in</span>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-500" htmlFor="reach-in-opening-right">
              Right return wall
            </label>
            <div className="flex items-center gap-1">
              <input
                id="reach-in-opening-right"
                type="number"
                min="0"
                step="0.25"
                value={openingRight}
                onChange={(event) => onOpeningRightChange(event.target.value)}
                className={inputClass}
              />
              <span className="text-xs font-bold text-stone-500">in</span>
            </div>
          </div>
          <div className="flex flex-col justify-end gap-1">
            <button
              type="button"
              onClick={onCenterOpening}
              className="h-8 whitespace-nowrap rounded border border-stone-300 bg-white px-2 text-xs font-bold text-stone-700 hover:border-brand-orange"
            >
              Center opening
            </button>
            <div className={`whitespace-nowrap text-xs font-semibold ${planDetails.openingMatchesWall ? 'text-stone-500' : 'text-red-700'}`}>
              Total {formatInches(planDetails.openingTotal)} / {formatInches(planDetails.wallWidth)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded bg-stone-50 p-2">
          <div className="text-xs font-semibold text-stone-500">Door type</div>
          <div className="flex flex-wrap gap-1">
              {reachInDoorTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => onDoorTypeChange(type.value)}
                  className={`rounded border px-2 py-1 text-xs font-bold leading-none transition ${
                    doorType === type.value ? 'border-brand-orange bg-brand-orange text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-brand-orange'
                  }`}
                >
                  {type.label}
                </button>
              ))}
          </div>
          <div className="ml-auto text-xs font-semibold text-stone-500">
            Clear past unit
            <div className="text-sm font-bold text-stone-950">{formatInches(planDetails.clearDepth)}</div>
          </div>
          {Number(ceilingHeight) <= Number(plannerHeight) && (
            <div className="rounded bg-red-50 px-2 py-1 text-xs font-bold text-red-700">Ceiling must be higher than system.</div>
          )}
        </div>
      </div>
    </section>
  );
}

function ClosetTypeStart({ onReachIn }) {
  return (
    <main className="grid min-h-screen place-items-center bg-brand-ui p-4 text-brand-black">
      <section className="w-full max-w-3xl rounded border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-stone-950">Reach-in Closet Planner</h1>
          <p className="mt-1 text-sm font-semibold text-stone-500">Enter closet dimensions to start your reach-in design.</p>
        </div>
        <div className="mb-4 flex justify-start">
          <ConsultationCta />
        </div>
        <div>
          <button type="button" onClick={onReachIn} className="rounded border border-brand-orange bg-orange-50 p-4 text-left transition hover:bg-orange-100">
            <div className="text-lg font-bold text-stone-950">Start reach-in design</div>
            <div className="mt-1 text-sm font-semibold text-stone-600">One back wall with depth, opening, and door type.</div>
          </button>
        </div>
      </section>
    </main>
  );
}

function ReachInRoomCaptureStep({ setupProps, planDetails, onContinue, onBack }) {
  const blocking = [];

  if (planDetails.wallWidth <= 0 || planDetails.roomDepthInput <= 0 || planDetails.openingWidth <= 0) {
    blocking.push('Enter positive room and opening dimensions.');
  }

  if (planDetails.roomDepthInput < depth) {
    blocking.push(`Reach-in depth must be at least ${formatInches(depth)}.`);
  }

  if (!planDetails.openingClear) {
    blocking.push('Opening should be at least 24" clear.');
  }

  if (!planDetails.openingMatchesWall) {
    blocking.push(`Opening wall math should equal the back wall: ${formatInches(planDetails.openingTotal)} entered vs ${formatInches(planDetails.wallWidth)} back wall.`);
  }

  if (!planDetails.ceilingClear) {
    blocking.push(`Closet ceiling height ${formatInches(planDetails.ceilingHeight)} must be higher than the ${formatInches(planDetails.height)} closet system height.`);
  }

  return (
    <main className="h-screen overflow-y-auto bg-brand-ui text-brand-black">
      <header className="flex h-16 items-center justify-between border-b border-stone-200 bg-white px-4">
        <div>
          <h1 className="text-lg font-bold text-stone-950">Reach-in Closet Planner</h1>
          <p className="text-xs font-semibold text-stone-500">Step 1: closet dimensions and opening</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <ConsultationCta compact />
        </div>
      </header>
      <section className="grid gap-3 p-3 xl:grid-cols-[minmax(280px,0.25fr)_minmax(0,0.75fr)]">
        <div className="space-y-3">
          <ReachInRoomSetup title="Closet Dimensions" {...setupProps} planDetails={planDetails} />
          <section className="rounded border border-stone-200 bg-white p-3">
            <h2 className="text-base font-bold text-stone-950">Validation</h2>
            <div className="mt-2 space-y-2 text-sm font-bold">
              {blocking.length === 0 ? (
                <div className="rounded bg-emerald-50 px-3 py-2 text-emerald-700">Dimensions are ready.</div>
              ) : (
                blocking.map((warning) => (
                  <div key={warning} className="rounded bg-amber-50 px-3 py-2 text-amber-700">
                    {warning}
                  </div>
                ))
              )}
            </div>
            <button
              type="button"
              disabled={blocking.length > 0}
              onClick={onContinue}
              className="mt-3 w-full rounded bg-stone-950 px-4 py-2 text-sm font-bold text-white disabled:bg-stone-300"
            >
              Continue to configurations
            </button>
          </section>
        </div>
        <ReachInPlanView
          modules={[]}
          wallWidth={planDetails.wallWidth}
          roomDepth={planDetails.roomDepth}
          openingWidth={planDetails.openingWidth}
          openingLeft={planDetails.openingLeft}
          openingRight={planDetails.openingRight}
          doorType={planDetails.doorType}
          height={planDetails.height}
          drawerWarnings={planDetails.drawerWarnings}
        />
      </section>
    </main>
  );
}

export default function App({ internalRenderer = false }) {
  const requestedKitHandle = useMemo(getRequestedKitHandle, []);
  const requestedFallbackKit = useMemo(() => kitHandleToDrawing(requestedKitHandle) || fallbackKit, [requestedKitHandle]);
  const exposeCaptureData = useMemo(shouldExposeCaptureData, []);
  const requestedMode = useMemo(() => {
    if (!internalRenderer) return 'planner';
    if (typeof window === 'undefined') return 'renderer';
    return new URLSearchParams(window.location.search).get('mode') === 'planner' ? 'planner' : 'renderer';
  }, [internalRenderer]);
  const requestedType = useMemo(() => (typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('type')), []);
  const requestedReachInPlan = useMemo(getRequestedReachInPlan, []);
  const requestedEstimatePage = useMemo(shouldShowEstimatePage, []);
  const requestedPlanDetails = requestedReachInPlan?.planDetails || {};
  const requestedPlanModules = Array.isArray(requestedReachInPlan?.modules) ? requestedReachInPlan.modules : null;
  const [appMode, setAppMode] = useState(internalRenderer ? requestedMode : 'planner');
  const [airtableStatus, setAirtableStatus] = useState({
    state: 'loading',
    message: 'Checking Airtable...',
  });
  const startsInReachIn = internalRenderer || requestedType !== 'walk-in' || requestedMode === 'renderer' || Boolean(requestedReachInPlan);
  const [closetType, setClosetType] = useState(startsInReachIn ? 'reach-in' : '');
  const [reachInRoomCaptured, setReachInRoomCaptured] = useState(internalRenderer || requestedMode === 'renderer' || Boolean(requestedReachInPlan));
  const [kitOptions, setKitOptions] = useState([requestedFallbackKit]);
  const [selectedHandle, setSelectedHandle] = useState(requestedFallbackKit.handle);
  const [viewMode, setViewMode] = useState('photo');
  const [photoInstallationType, setPhotoInstallationType] = useState('reach-in');
  const [photoWorkspaceTab, setPhotoWorkspaceTab] = useState('generated');
  const [photoGalleryVersion, setPhotoGalleryVersion] = useState(0);
  const [plannerHeight, setPlannerHeight] = useState(requestedPlanDetails.height || 84);
  const [ceilingHeight, setCeilingHeight] = useState(requestedPlanDetails.ceilingHeight || 108);
  const [wallWidth, setWallWidth] = useState(requestedPlanDetails.wallWidth || 96);
  const [reachInDepth, setReachInDepth] = useState(requestedPlanDetails.roomDepthInput || requestedPlanDetails.roomDepth || 24);
  const [reachInOpeningWidth, setReachInOpeningWidth] = useState(requestedPlanDetails.openingWidth || 30);
  const [reachInOpeningLeft, setReachInOpeningLeft] = useState(requestedPlanDetails.openingLeft || 33);
  const [reachInOpeningRight, setReachInOpeningRight] = useState(requestedPlanDetails.openingRight || 33);
  const [reachInDoorType, setReachInDoorType] = useState(requestedPlanDetails.doorType || 'regular');
  const [plannerPreviewMode, setPlannerPreviewMode] = useState('plan');
  const [plannerModules, setPlannerModules] = useState(() => requestedPlanModules || [createPlannerModule('SHELF', requestedPlanDetails.height || 84, 24), createPlannerModule('SHELF', requestedPlanDetails.height || 84, 24)]);
  const [plannerStep, setPlannerStep] = useState('design');

  useEffect(() => {
    let ignore = false;

    async function loadKits() {
      try {
        const response = await fetch('/api/kits');
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Unable to load Airtable kits');
        }

        const productDrawings = payload.records
          .map(kitRecordToDrawing)
          .filter(Boolean);
        const connectedTowerDrawings = productDrawings.filter((kit) => kit.towerSpecs.length >= 2);

        if (!ignore) {
          const fallbackOptions = requestedFallbackKit.handle === fallbackKit.handle ? [fallbackKit] : [requestedFallbackKit, fallbackKit];
          setKitOptions(productDrawings.length > 0 ? productDrawings : fallbackOptions);
          setSelectedHandle((currentHandle) => {
            if (productDrawings.some((kit) => kit.handle === currentHandle)) {
              return currentHandle;
            }

            return (
              productDrawings.find((kit) => kit.handle === requestedKitHandle)?.handle ||
              requestedFallbackKit.handle ||
              productDrawings.find((kit) => kit.handle === 'H3D-S8-51-96-14-W')?.handle ||
              productDrawings.find((kit) => kit.handle === 'H3D-S9-51-96-14-W')?.handle ||
              productDrawings[0]?.handle ||
              fallbackKit.handle
            );
          });
          setAirtableStatus({
            state: 'ready',
            message: `${connectedTowerDrawings.length} connected kits / ${productDrawings.length} products`,
          });
        }
      } catch (error) {
        if (!ignore) {
          const fallbackOptions = requestedFallbackKit.handle === fallbackKit.handle ? [fallbackKit] : [requestedFallbackKit, fallbackKit];
          setKitOptions(fallbackOptions);
          setSelectedHandle((currentHandle) => (fallbackOptions.some((kit) => kit.handle === currentHandle) ? currentHandle : requestedFallbackKit.handle));
          setAirtableStatus({
            state: 'error',
            message: error.message,
          });
        }
      }
    }

    loadKits();

    return () => {
      ignore = true;
    };
  }, [requestedFallbackKit, requestedKitHandle]);

  const productCatalog = useMemo(() => {
    const catalog = kitOptions.length ? kitOptions : [fallbackKit];

    return catalog.filter((product) => product.matchSignature && product.status !== 'archived');
  }, [kitOptions]);

  const productBySignature = useMemo(() => {
    const map = new Map();

    productCatalog.forEach((product) => {
      const existing = map.get(product.matchSignature);
      if (shouldPreferProductCandidate(product, existing)) {
        map.set(product.matchSignature, product);
      }
    });

    return map;
  }, [productCatalog]);

  const plannerBaseDrawing = useMemo(() => createPlannerDrawing(plannerHeight, plannerModules), [plannerHeight, plannerModules]);
  const plannerEvaluation = useMemo(() => {
    if (plannerModules.length === 0) {
      return {
        signature: '',
        match: null,
        displayPrice: 0,
        estimatedPrice: 0,
      };
    }

    const signature = buildMatchSignature(plannerHeight, plannerModules);
    const match = productBySignature.get(signature) || null;
    const calculatedPrice = calculateCustomEstimate(plannerModules, productCatalog, plannerHeight);

    return {
      signature,
      match,
      displayPrice: calculatedPrice,
      estimatedPrice: calculatedPrice,
    };
  }, [plannerHeight, plannerModules, productBySignature, productCatalog]);
  const plannerPlanDetails = useMemo(() => {
    const assembledWidth = plannerModules.length ? getAssembledWidth(plannerModules) : 0;
    const requiredWidth = plannerModules.length ? getRequiredWidth(assembledWidth) : 0;
    const roomDepthInput = Number(reachInDepth) || 0;
    const roomDepth = Math.max(depth, roomDepthInput || depth);
    const openingWidth = Number(reachInOpeningWidth) || 0;
    const openingLeft = Number(reachInOpeningLeft) || 0;
    const openingRight = Number(reachInOpeningRight) || 0;
    const openingTotal = Number((openingLeft + openingWidth + openingRight).toFixed(2));
    const wallNumber = Number(wallWidth) || 0;
    const openingMatchesWall = Math.abs(openingTotal - wallNumber) < 0.01;
    const openingClear = openingWidth >= 24;
    const runStart = Math.max(0, (wallNumber - assembledWidth) / 2);
    const moduleSegments = getModuleSegments(plannerModules, runStart);
    const sharedDividerCenters = plannerModules.length > 1 ? getSharedDividerCenters(plannerModules, runStart) : [];
    const wallCenter = wallNumber / 2;
    const slidingDividerAligned = reachInDoorType !== 'sliding' || sharedDividerCenters.some((dividerCenter) => Math.abs(dividerCenter - wallCenter) <= 0.5);
    const drawerAccessZones =
      reachInDoorType === 'sliding'
        ? [
            [openingLeft, openingLeft + openingWidth / 2],
            [openingLeft + openingWidth / 2, openingLeft + openingWidth],
          ]
        : [[openingLeft, openingLeft + openingWidth]];
    const drawerWarnings = moduleSegments
      .filter(({ module }) => isDrawerTower(module))
      .filter(({ start, length }) => {
        const end = start + length;
        return !drawerAccessZones.some(([zoneStart, zoneEnd]) => start >= zoneStart - 0.01 && end <= zoneEnd + 0.01);
      })
      .map(({ module }) =>
        reachInDoorType === 'sliding'
          ? `${towerNames[module.code] || module.code} drawers are not fully cleared by either sliding-door opening and may not open all the way.`
          : `${towerNames[module.code] || module.code} drawers are not fully cleared by the closet opening and may not open all the way.`,
      );

    return {
      height: plannerHeight,
      ceilingHeight: Number(ceilingHeight) || 0,
      depth,
      roomDepth,
      roomDepthInput,
      clearDepth: Number((roomDepth - depth).toFixed(2)),
      wallWidth: wallNumber,
      openingWidth,
      openingLeft,
      openingRight,
      openingTotal,
      openingMatchesWall,
      openingClear,
      doorType: reachInDoorType,
      slidingDividerAligned,
      drawerWarnings,
      wallCenter,
      sharedDividerCenters,
      assembledWidth,
      requiredWidth,
      remainingWidth: Number((wallNumber - requiredWidth).toFixed(2)),
      ceilingClear: (Number(ceilingHeight) || 0) > Number(plannerHeight),
      drawerAccessClear: drawerWarnings.length === 0,
      fits: plannerModules.length > 0 && wallNumber >= requiredWidth && openingMatchesWall && openingClear && slidingDividerAligned && drawerWarnings.length === 0 && (Number(ceilingHeight) || 0) > Number(plannerHeight),
      visualOrder: plannerModules.map((module) => `${module.code}${module.width}`),
    };
  }, [ceilingHeight, plannerHeight, plannerModules, reachInDepth, reachInDoorType, reachInOpeningLeft, reachInOpeningRight, reachInOpeningWidth, wallWidth]);

  const addPlannerModule = (configCode, targetIndex = null) => {
    setPlannerStep('design');
    setPlannerModules((currentModules) => {
      const nextModules = [...currentModules];
      const insertAt = Number.isInteger(targetIndex) ? Math.max(0, Math.min(targetIndex, nextModules.length)) : nextModules.length;

      nextModules.splice(insertAt, 0, createPlannerModule(configCode, plannerHeight));
      return nextModules;
    });
  };

  const removePlannerModule = (id) => {
    setPlannerStep('design');
    setPlannerModules((currentModules) => currentModules.filter((module) => module.id !== id));
  };

  const movePlannerModule = (index, direction) => {
    setPlannerStep('design');
    setPlannerModules((currentModules) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= currentModules.length) {
        return currentModules;
      }

      const nextModules = [...currentModules];
      const [module] = nextModules.splice(index, 1);
      nextModules.splice(nextIndex, 0, module);
      return nextModules;
    });
  };

  const reorderPlannerModule = (moduleId, targetIndex) => {
    setPlannerStep('design');
    setPlannerModules((currentModules) => {
      const currentIndex = currentModules.findIndex((module) => module.id === moduleId);

      if (currentIndex === -1) {
        return currentModules;
      }

      const nextModules = [...currentModules];
      const [module] = nextModules.splice(currentIndex, 1);
      const adjustedTarget = currentIndex < targetIndex ? targetIndex - 1 : targetIndex;
      const insertAt = Math.max(0, Math.min(adjustedTarget, nextModules.length));

      nextModules.splice(insertAt, 0, module);
      return nextModules;
    });
  };

  const updatePlannerModuleWidth = (id, width) => {
    setPlannerStep('design');
    setPlannerModules((currentModules) =>
      currentModules.map((module) => {
        if (module.id !== id) {
          return module;
        }

        return {
          ...module,
          width,
          label: `${towerNames[module.code] || module.code} ${width}"`,
        };
      }),
    );
  };

  const balanceOpeningReturns = (nextWallWidth = wallWidth, nextOpeningWidth = reachInOpeningWidth) => {
    const wallNumber = Number(nextWallWidth) || 0;
    const openingNumber = Number(nextOpeningWidth) || 0;
    const returnWidth = Math.max(0, (wallNumber - openingNumber) / 2);
    const balancedWidth = Number(returnWidth.toFixed(2));

    setReachInOpeningLeft(balancedWidth);
    setReachInOpeningRight(balancedWidth);
  };

  const updateReachInWallWidth = (value) => {
    setWallWidth(value);
    balanceOpeningReturns(value, reachInOpeningWidth);
  };

  const updateReachInOpeningWidth = (value) => {
    setReachInOpeningWidth(value);
    balanceOpeningReturns(wallWidth, value);
  };

  const selectReachIn = () => {
    setAppMode('planner');
    setClosetType('reach-in');
    setReachInRoomCaptured(false);
    setPlannerStep('design');
    setPlannerPreviewMode('plan');
  };

  const enterReachInConfiguration = () => {
    setReachInRoomCaptured(true);
    window.requestAnimationFrame(() => {
      document.querySelector('.app-shell')?.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const resetClosetType = () => {
    setClosetType('');
    setReachInRoomCaptured(false);
    setPlannerStep('design');
  };

  const changePlannerHeight = (height) => {
    setPlannerStep('design');
    setPlannerHeight(height);
    setPlannerModules((currentModules) =>
      currentModules.map((module) => {
        const code = getPlannerCode(module.configCode, height);

        return {
          ...module,
          code,
          label: `${towerNames[code] || code} ${module.width}"`,
        };
      }),
    );
  };

  const baseDrawing = appMode === 'planner' ? plannerBaseDrawing : kitOptions.find((kit) => kit.handle === selectedHandle) || kitOptions[0] || fallbackKit;
  const drawing = useMemo(() => createDrawing(baseDrawing), [baseDrawing]);
  const photoMode = viewMode === 'photo';
  const rendererPhotoMode = photoMode && appMode === 'renderer';
  const plannerCameraDistance = Math.max(250, drawing.assembledWidth * 2.75);
  const rendererPhotoCameraDistance = Math.max(360, drawing.height * 4);
  const rendererPhotoZoom = 8;
  const camera = photoMode
    ? {
        position: [appMode === 'planner' ? 52 : 42, drawing.height * 0.52, appMode === 'planner' ? plannerCameraDistance : rendererPhotoCameraDistance],
        fov: appMode === 'planner' ? 21 : 18,
        zoom: rendererPhotoMode ? rendererPhotoZoom : undefined,
        near: 0.1,
        far: 1000,
      }
    : { position: [78, 64, 250], fov: 24, near: 0.1, far: 1000 };

  useEffect(() => {
    if (!exposeCaptureData) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      const canvas = document.querySelector('canvas');

      try {
        window.__closetExport = {
          handle: drawing.handle,
          dataUrl: canvas?.toDataURL('image/png') || '',
        };
      } catch (error) {
        window.__closetExport = {
          handle: drawing.handle,
          dataUrl: '',
          error: error.message,
        };
      }
    }, 1600);

    return () => window.clearTimeout(timeoutId);
  }, [drawing, exposeCaptureData, viewMode]);

  const reachInSetupProps = {
    plannerHeight,
    onHeightChange: changePlannerHeight,
    ceilingHeight,
    onCeilingHeightChange: setCeilingHeight,
    wallWidth,
    onWallWidthChange: updateReachInWallWidth,
    reachInDepth,
    onDepthChange: setReachInDepth,
    doorType: reachInDoorType,
    onDoorTypeChange: setReachInDoorType,
    openingWidth: reachInOpeningWidth,
    onOpeningWidthChange: updateReachInOpeningWidth,
    openingLeft: reachInOpeningLeft,
    onOpeningLeftChange: setReachInOpeningLeft,
    openingRight: reachInOpeningRight,
    onOpeningRightChange: setReachInOpeningRight,
    onCenterOpening: () => balanceOpeningReturns(wallWidth, reachInOpeningWidth),
  };

  if (requestedEstimatePage && requestedReachInPlan) {
    return (
      <ReachInEstimatePage
        evaluation={plannerEvaluation}
        modules={plannerModules}
        planDetails={plannerPlanDetails}
        drawing={drawing}
      />
    );
  }

  if (appMode === 'planner' && !closetType) {
    return <ClosetTypeStart onReachIn={selectReachIn} />;
  }

  if (appMode === 'planner' && closetType === 'reach-in' && !reachInRoomCaptured) {
    return (
      <ReachInRoomCaptureStep
        setupProps={reachInSetupProps}
        planDetails={plannerPlanDetails}
        onContinue={enterReachInConfiguration}
        onBack={resetClosetType}
      />
    );
  }

  return (
    <main className="app-shell app-shell-scroll bg-brand-ui text-brand-black">
      <header className="app-header flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4">
        <h1 className="hidden whitespace-nowrap text-base font-semibold leading-none sm:block">
          {internalRenderer ? 'Internal Image Renderer' : 'Reach-in Closet Planner'}
        </h1>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          {!internalRenderer && appMode === 'planner' && <ConsultationCta compact />}
          {internalRenderer && (
            <>
              <a href="/internal-renderer-style-guide.md" target="_blank" className="whitespace-nowrap rounded border border-stone-300 px-3 py-2 text-sm font-bold text-stone-700">
                Style guide
              </a>
              <a href="/shopify-photo-workflow.md" target="_blank" className="whitespace-nowrap rounded border border-stone-300 px-3 py-2 text-sm font-bold text-stone-700">
                Photo workflow
              </a>
              <span
                className={`whitespace-nowrap text-xs font-semibold ${
                  airtableStatus.state === 'ready'
                    ? 'text-emerald-700'
                    : airtableStatus.state === 'error'
                      ? 'text-red-700'
                      : 'text-stone-500'
                }`}
                title={airtableStatus.message}
              >
                Airtable: {airtableStatus.message}
              </span>
              <AppModeToggle appMode={appMode} onChange={setAppMode} />
              <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
              {appMode === 'renderer' && <KitSelector drawings={kitOptions} selectedHandle={drawing.handle} onChange={setSelectedHandle} />}
              {appMode === 'renderer' && viewMode === 'photo' && (
                <>
                  <div className="flex rounded border border-stone-300 bg-white p-0.5 text-xs font-bold">
                    {[
                      ['generated', 'Generated photos'],
                      ['geometry', 'Geometry render'],
                    ].map(([tab, label]) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setPhotoWorkspaceTab(tab)}
                        className={`rounded px-2 py-1 ${photoWorkspaceTab === tab ? 'bg-brand-orange text-white' : 'text-stone-600 hover:bg-stone-100'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <PhotoSetRules drawing={drawing} installationType={photoInstallationType} onChange={setPhotoInstallationType} />
                </>
              )}
              {appMode === 'renderer' && viewMode === 'photo' && photoWorkspaceTab === 'generated' && (
                <button
                  type="button"
                  onClick={() => setPhotoWorkspaceTab('geometry')}
                  className="rounded bg-brand-orange px-3 py-1.5 text-sm font-black text-white shadow-sm hover:bg-orange-700"
                >
                  Generate new photos
                </button>
              )}
              {appMode === 'renderer' && viewMode === 'photo' && photoWorkspaceTab === 'geometry' && (
                <GeneratePhotosButton
                  drawing={drawing}
                  installationType={photoInstallationType}
                  onGenerated={() => {
                    setPhotoGalleryVersion((version) => version + 1);
                    setPhotoWorkspaceTab('generated');
                  }}
                />
              )}
              {appMode === 'renderer' && <ExportButton drawing={drawing} installationType={photoInstallationType} />}
            </>
          )}
        </div>
      </header>
      {appMode === 'planner' ? (
        <section className="app-workspace grid grid-cols-1 gap-0 xl:grid-cols-[minmax(0,0.75fr)_minmax(240px,0.25fr)]">
          {plannerStep === 'review' ? (
            <section className="bg-white xl:col-span-2">
              <OrderReviewPanel
                evaluation={plannerEvaluation}
                modules={plannerModules}
                planDetails={plannerPlanDetails}
                onBack={() => setPlannerStep('design')}
              />
            </section>
          ) : (
            <>
              <section
                className="grid bg-white xl:min-h-0 xl:grid-rows-[auto_minmax(75vh,1fr)]"
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const configCode = event.dataTransfer.getData('text/plain');
                  if (configCode) {
                    addPlannerModule(configCode);
                  }
                }}
              >
                <div className="grid gap-2 border-b border-stone-200 bg-stone-100 p-2 xl:grid-cols-2">
                  <section className="rounded border border-stone-200 bg-white p-2">
                    <h2 className="text-sm font-bold text-stone-950">Configure your closet</h2>
                    <p className="mb-1 mt-0.5 text-xs text-stone-500">Click or drag a configuration.</p>
                    <ModulePalette height={plannerHeight} onAdd={addPlannerModule} />
                  </section>
                  <ModuleControlStrip
                    modules={plannerModules}
                    height={plannerHeight}
                    onRemove={removePlannerModule}
                    onMove={movePlannerModule}
                    onWidthChange={updatePlannerModuleWidth}
                  />
                  {internalRenderer ? (
                    <div className="xl:col-span-2">
                      <ReachInRoomSetup {...reachInSetupProps} planDetails={plannerPlanDetails} />
                    </div>
                  ) : null}
                </div>
                <section className="relative bg-white">
                  <div className="sticky top-2 z-20 ml-auto mr-3 mt-3 flex w-fit rounded border border-stone-300 bg-white p-0.5 text-xs font-bold shadow-sm xl:absolute xl:right-3 xl:top-3 xl:m-0">
                    {[
                      ['plan', 'Plan'],
                      ['3d', '3D'],
                    ].map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPlannerPreviewMode(mode)}
                        className={`rounded px-3 py-1.5 transition ${plannerPreviewMode === mode ? 'bg-brand-orange text-white' : 'text-stone-600 hover:bg-stone-100'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {plannerPreviewMode === 'plan' ? (
                    <div className="bg-stone-50 p-4 pt-3 xl:pt-14">
                      <ReachInPlanView
                        modules={plannerModules}
                        wallWidth={plannerPlanDetails.wallWidth}
                        roomDepth={plannerPlanDetails.roomDepth}
                        openingWidth={plannerPlanDetails.openingWidth}
                        openingLeft={plannerPlanDetails.openingLeft}
                        openingRight={plannerPlanDetails.openingRight}
                        doorType={plannerPlanDetails.doorType}
                        height={plannerHeight}
                        drawerWarnings={plannerPlanDetails.drawerWarnings}
                      />
                    </div>
                  ) : (
                    <div className="relative h-[460px] bg-white sm:h-[560px] xl:h-full">
                      <OrbitHintBadge />
                      <Canvas
                        key={`${viewMode}-${drawing.handle}`}
                        className="h-full w-full"
                        orthographic={false}
                        camera={camera}
                        dpr={[1, 2]}
                        gl={{ antialias: true, preserveDrawingBuffer: true }}
                        shadows
                        onCreated={({ gl }) => {
                          gl.shadowMap.enabled = true;
                          gl.shadowMap.type = PCFSoftShadowMap;
                          gl.outputColorSpace = SRGBColorSpace;
                          gl.toneMapping = ACESFilmicToneMapping;
                          gl.toneMappingExposure = photoMode ? 0.95 : 1;
                        }}
                      >
                        <RenderScene drawing={drawing} photoMode={photoMode} wallWidth={plannerPlanDetails.wallWidth} reachInRoom={plannerPlanDetails} />
                      </Canvas>
                    </div>
                  )}
                </section>
              </section>
              <aside className="border-t border-stone-200 bg-stone-50 p-3 xl:border-l xl:border-t-0">
                <div className="space-y-3">
                  {!internalRenderer ? (
                    <ReachInSpaceSummary planDetails={plannerPlanDetails} onEdit={() => setReachInRoomCaptured(false)}>
                      <ReachInClosetDetailsSummary planDetails={plannerPlanDetails} moduleCount={plannerModules.length} embedded />
                    </ReachInSpaceSummary>
                  ) : (
                    <section className="rounded border border-stone-200 bg-white p-3">
                      <ReachInClosetDetailsSummary planDetails={plannerPlanDetails} moduleCount={plannerModules.length} embedded />
                    </section>
                  )}
                  <MatchPanel
                    evaluation={plannerEvaluation}
                    modules={plannerModules}
                    planDetails={plannerPlanDetails}
                    onContinue={() => navigateInsideFrame(buildReachInEstimateUrl(plannerPlanDetails, plannerModules))}
                    isCatalogReady={airtableStatus.state !== 'loading'}
                  />
                </div>
              </aside>
            </>
          )}
        </section>
      ) : (
        <section
          className={`app-workspace ${photoMode ? '' : 'grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]'}`}
        >
          {photoMode && photoWorkspaceTab === 'generated' ? (
            <GeneratedPhotoGallery drawing={drawing} onSelectHandle={setSelectedHandle} refreshToken={photoGalleryVersion} />
          ) : (
            <section className="relative h-full min-h-0 bg-white">
              {photoMode && (
                <span className="absolute left-3 top-3 z-10 rounded bg-stone-950/80 px-3 py-1 text-xs font-bold text-white">Geometry source · not final photo</span>
              )}
              <Canvas
                key={`${viewMode}-${drawing.handle}`}
                className="h-full w-full"
                orthographic={rendererPhotoMode}
                camera={camera}
                dpr={[1, 2]}
                gl={{ antialias: true, preserveDrawingBuffer: true }}
                shadows
                onCreated={({ gl }) => {
                  gl.shadowMap.enabled = true;
                  gl.shadowMap.type = PCFSoftShadowMap;
                  gl.outputColorSpace = SRGBColorSpace;
                  gl.toneMapping = ACESFilmicToneMapping;
                  gl.toneMappingExposure = photoMode ? 0.95 : 1;
                }}
              >
                <RenderScene drawing={drawing} photoMode={photoMode} />
              </Canvas>
            </section>
          )}
          {!photoMode && (
            <section className="min-h-0 border-l border-stone-200 bg-white">
              <TechnicalDrawing drawing={drawing} />
            </section>
          )}
        </section>
      )}
    </main>
  );
}

