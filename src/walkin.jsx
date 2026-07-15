import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Edges, OrbitControls } from '@react-three/drei';
import './styles.css';

const panelThickness = 0.75;
const closetDepth = 14;
const storefrontBaseUrl = 'https://www.closetswarehouse.com';
const consultationUrl = `${storefrontBaseUrl}/pages/free-closets-design-consultation`;
const contactUrl = `${storefrontBaseUrl}/pages/contact`;
const phoneDisplay = '(954) 247-8032';
const phoneHref = 'tel:+19542478032';
const cornerReachGap = 12;
const cornerStopDistance = closetDepth + cornerReachGap;
const closetHeights = [84, 96];
const allowedModuleWidths = [18, 24, 30];
const toeKickHeight = 5;
const drawerSideOverlay = panelThickness / 2 - 1 / 16;
const drawerPullLength = 5;
const drawerPullHeight = 0.5;
const drawerPullProjection = 1.4;
const frontDrillLineZ = closetDepth / 2 - 1.1;
const shelfOnlyAdjustableShelfCounts = {
  S7: 6,
  S8: 7,
};

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
        Saved. Plan ID {quoteId}. Print this page for future reference, or reopen it later from the Your plans section using the email and phone you entered.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button type="button" onClick={() => window.print()} className="rounded bg-emerald-700 px-3 py-2 text-center text-sm font-bold text-white hover:bg-emerald-800">
          Print reference
        </button>
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

function PrintablePlanReference({ quoteId, planType = 'Closet plan' }) {
  if (!quoteId) {
    return null;
  }

  return (
    <section className="print-plan-reference rounded border border-stone-300 bg-white p-4">
      <p className="text-xs font-bold uppercase text-brand-orange">Closets Warehouse</p>
      <h2 className="mt-1 text-xl font-bold text-stone-950">{planType}</h2>
      <p className="mt-2 text-base font-bold text-stone-950">Plan ID: {quoteId}</p>
    </section>
  );
}

const moduleConfigs = [
  { code: 'LH', label: 'Long Hang', defaultWidth: 24 },
  { code: 'DH', label: 'Double Hang', defaultWidth: 24 },
  { code: 'HS', label: 'Hang + Shelves', defaultWidth: 24 },
  { code: 'S3D', label: 'Shelves + 3 Drawers', defaultWidth: 24 },
  { code: 'H3D', label: 'Hang + 3 Drawers', defaultWidth: 24 },
  { code: 'S2D', label: 'Shelves + 2 Drawers', defaultWidth: 24 },
  { code: 'SHELF', label: 'Shelf Tower', defaultWidth: 24 },
];

const towerNames = {
  LH: 'Long Hang',
  DH: 'Double Hang',
  HS: 'Hang & Shelves',
  S3D: 'Shelves & 3 Drawers',
  H3D: 'Hang & 3 Drawers',
  S2D: 'Shelves & 2 Drawers',
  S7: '7-Shelf',
  S8: '8-Shelf',
  S9: '8-Shelf',
};

const towerCodePattern = /^(LH|DH|HS|S3D|3DS|H3D|3DH|S2D|2DS|S7|S8|S9)$/;
const widthTokenPattern = /^(18|24|30)$/;
const singleTowerWidthTokenMap = {
  20: 18,
  26: 24,
  32: 30,
};

const wallLabels = {
  back: 'Back wall',
  left: 'Left wall',
  right: 'Right wall',
};

const wallHeightKeys = {
  back: 'backHeight',
  left: 'leftHeight',
  right: 'rightHeight',
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatInches(value) {
  return `${Number(value || 0).toFixed(value % 1 ? 2 : 0)}"`;
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? `$${number.toFixed(2)}` : '';
}

function normalizeHandle(value) {
  return String(value || '').toUpperCase();
}

function normalizePrice(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getShopifyHandle(fields, sku) {
  return String(fields.shopify_handle || sku || '')
    .trim()
    .toLowerCase();
}

function getProductUrl(handle) {
  const shopifyHandle = String(handle || '').trim().toLowerCase();
  return shopifyHandle ? `${storefrontBaseUrl}/products/${shopifyHandle}` : '';
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

function getShelfCodeForHeight(height) {
  return Number(height) >= 96 ? 'S8' : 'S7';
}

function getWalkInProductCode(module, height) {
  return module.code === 'SHELF' ? getShelfCodeForHeight(height) : module.code;
}

function getNominalWidthFromSkuToken(token) {
  if (widthTokenPattern.test(token)) {
    return Number(token);
  }

  return singleTowerWidthTokenMap[token] || null;
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

  return `${height}|${closetDepth}|${modules}`;
}

function formatTowerTitle(towerSpecs) {
  const systemType = towerSpecs.length === 1 ? 'Single Tower' : towerSpecs.length === 2 ? 'Double Tower' : `${towerSpecs.length}-Tower`;

  return `${towerSpecs
    .map((tower) => `${towerNames[tower.code] || tower.code}${tower.width === 24 ? '' : ` (${tower.width}")`}`)
    .join(' + ')} ${systemType}`;
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

function kitRecordToProduct(record) {
  const fields = record.fields;
  const sku = fields.shopify_sku || fields['Kit Name'];
  const towerSpecs = parseTowerSku(sku);

  if (!towerSpecs) {
    return null;
  }

  const height = Number(fields.Height) || (normalizeHandle(sku).includes('-96-') ? 96 : 84);
  const assembledWidth = Number(fields.Width) || getRunLength(towerSpecs);
  const shopifyHandle = getShopifyHandle(fields, sku);

  return {
    handle: sku,
    title: formatTowerTitle(towerSpecs),
    kitId: fields.KitID || record.id,
    height,
    assembledWidth,
    requiredWidth: Number(fields['Width Requirement']) || assembledWidth + 2,
    price: normalizePrice(fields.retail_price),
    productUrl: getProductUrl(shopifyHandle),
    matchSignature: buildMatchSignature(height, towerSpecs),
    status: String(fields.Status || 'active').toLowerCase(),
    towerSpecs,
  };
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

function getWallTowerSpecs(room, wall, modules) {
  const height = getWallHeight(room, wall);

  return modules.map((module) => ({
    code: getWalkInProductCode(module, height),
    width: numberValue(module.width),
    label: module.label,
  }));
}

function calculateWallEstimate(modules, height, productCatalog) {
  const singleProductsBySignature = new Map(
    productCatalog
      .filter((product) => product.towerSpecs.length === 1 && product.price > 0)
      .map((product) => [product.matchSignature, product]),
  );
  const baseTotal = modules.reduce((sum, module) => {
    const code = getWalkInProductCode(module, height);
    const width = numberValue(module.width);
    const singleSignature = buildMatchSignature(height, [{ code, width }]);
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

    return sum + (singleProduct?.price || fallbackByCode[code] || 275);
  }, 0);
  const sharedPanelCredit = Math.max(0, modules.length - 1) * 32;

  return Number(Math.max(0, baseTotal - sharedPanelCredit).toFixed(2));
}

function getWallHeight(room, wall) {
  const height = numberValue(room[wallHeightKeys[wall]]);
  return closetHeights.includes(height) ? height : closetHeights[1];
}

function createModule(code) {
  const config = moduleConfigs.find((item) => item.code === code) || moduleConfigs[0];

  return {
    id: uid(),
    code: config.code,
    label: config.label,
    width: allowedModuleWidths.includes(config.defaultWidth) ? config.defaultWidth : 24,
  };
}

function getRunLength(modules) {
  if (!modules.length) {
    return 0;
  }

  return modules.reduce((total, module) => total + numberValue(module.width), 0) + (modules.length + 1) * panelThickness;
}

function getUsableLengths(room, corners) {
  const backWidth = numberValue(room.backWidth);
  const leftDepth = numberValue(room.leftDepth);
  const rightDepth = numberValue(room.rightDepth);

  return {
    back: Math.max(0, backWidth - (corners.backLeft === 'left' ? cornerStopDistance : 0) - (corners.backRight === 'right' ? cornerStopDistance : 0)),
    left: Math.max(0, leftDepth - (corners.backLeft === 'back' ? cornerStopDistance : 0)),
    right: Math.max(0, rightDepth - (corners.backRight === 'back' ? cornerStopDistance : 0)),
  };
}

function isDrawerTower(module) {
  return ['S3D', 'H3D', 'S2D'].includes(module.code);
}

function rangesOverlap(start, end, zoneStart, zoneEnd) {
  return start < zoneEnd - 0.01 && end > zoneStart + 0.01;
}

function getWalkInDrawerWarnings(room, corners, runs) {
  const backWidth = numberValue(room.backWidth);
  const leftDepth = numberValue(room.leftDepth);
  const rightDepth = numberValue(room.rightDepth);
  const warnings = [];
  const wallZones = {
    back: [
      ...(corners.backLeft === 'left' ? [[closetDepth, closetDepth + cornerReachGap, 'back-left corner reach zone']] : []),
      ...(corners.backRight === 'right' ? [[backWidth - closetDepth - cornerReachGap, backWidth - closetDepth, 'back-right corner reach zone']] : []),
    ],
    left: corners.backLeft === 'back' ? [[closetDepth, closetDepth + cornerReachGap, 'back-left corner reach zone']] : [],
    right: corners.backRight === 'back' ? [[closetDepth, closetDepth + cornerReachGap, 'back-right corner reach zone']] : [],
  };

  [
    ['back', corners.backLeft === 'left' ? cornerStopDistance : 0],
    ['left', corners.backLeft === 'back' ? cornerStopDistance : 0],
    ['right', corners.backRight === 'back' ? cornerStopDistance : 0],
  ].forEach(([wall, startOffset]) => {
    getModuleSegments(runs[wall] || [], startOffset).forEach(({ module, start, length }) => {
      if (!isDrawerTower(module)) {
        return;
      }

      const end = start + length;
      wallZones[wall].forEach(([zoneStart, zoneEnd, zoneLabel]) => {
        if (rangesOverlap(start, end, zoneStart, zoneEnd)) {
          warnings.push(`${wallLabels[wall]} ${module.label} drawers overlap the ${zoneLabel}; drawers may be hard to reach there.`);
        }
      });
    });
  });

  return warnings;
}

function evaluatePlan(room, corners, runs) {
  const backWidth = numberValue(room.backWidth);
  const leftDepth = numberValue(room.leftDepth);
  const rightDepth = numberValue(room.rightDepth);
  const openingWidth = numberValue(room.openingWidth);
  const openingLeft = numberValue(room.openingLeft);
  const openingRight = numberValue(room.openingRight);
  const ceilingHeight = numberValue(room.ceilingHeight);
  const selectedHeights = ['back', 'left', 'right'].map((wall) => getWallHeight(room, wall));
  const usable = getUsableLengths(room, corners);
  const runLengths = {
    back: getRunLength(runs.back),
    left: getRunLength(runs.left),
    right: getRunLength(runs.right),
  };
  const warnings = [];
  const blocking = [];

  if (backWidth <= 0 || leftDepth <= 0 || rightDepth <= 0 || openingWidth <= 0) {
    blocking.push('Enter positive room and opening dimensions.');
  }

  const frontTotal = openingLeft + openingWidth + openingRight;
  if (backWidth > 0 && Math.abs(frontTotal - backWidth) > 1) {
    blocking.push(`Opening wall math should equal the back wall: ${formatInches(frontTotal)} entered vs ${formatInches(backWidth)} back wall.`);
  }

  if (openingWidth < 24) {
    blocking.push('Opening should be at least 24" clear.');
  }

  if (selectedHeights.some((height) => !closetHeights.includes(height))) {
    blocking.push('Closet height must be 84" or 96" on every wall.');
  }

  if (ceilingHeight <= 0 || selectedHeights.some((height) => ceilingHeight <= height)) {
    blocking.push(`Room ceiling height ${formatInches(ceilingHeight)} must be higher than every selected closet height.`);
  }

  if (openingLeft > 0 && openingLeft < closetDepth && runs.left.length > 0) {
    blocking.push(`Left opening-side wall is only ${formatInches(openingLeft)}; keep at least ${formatInches(closetDepth)} so left-side units do not project into the entrance.`);
  }

  if (openingRight > 0 && openingRight < closetDepth && runs.right.length > 0) {
    blocking.push(`Right opening-side wall is only ${formatInches(openingRight)}; keep at least ${formatInches(closetDepth)} so right-side units do not project into the entrance.`);
  }

  Object.entries(runLengths).forEach(([wall, length]) => {
    if (length > usable[wall] + 0.01) {
      blocking.push(`${wallLabels[wall]} run is ${formatInches(length)} but usable length is ${formatInches(usable[wall])}.`);
    }
  });

  Object.values(runs)
    .flat()
    .forEach((module) => {
      const width = numberValue(module.width);
      if (!allowedModuleWidths.includes(width)) {
        blocking.push(`${module.label} width must be 18", 24", or 30".`);
      }
    });

  getWalkInDrawerWarnings(room, corners, runs).forEach((warning) => warnings.push(warning));

  if (runLengths.back === 0 && runLengths.left === 0 && runLengths.right === 0) {
    blocking.push('Add at least one tower to the design.');
  }

  warnings.push('Each inside corner keeps a 14" x 12" reach zone measured from the front line of the winning closet run; use it as blank space or a top shelf/bridge only.');

  return {
    blocking,
    warnings,
    runLengths,
    usable,
    complete: blocking.length === 0,
  };
}

function evaluateRoomStep(room) {
  const backWidth = numberValue(room.backWidth);
  const leftDepth = numberValue(room.leftDepth);
  const rightDepth = numberValue(room.rightDepth);
  const openingWidth = numberValue(room.openingWidth);
  const openingLeft = numberValue(room.openingLeft);
  const openingRight = numberValue(room.openingRight);
  const ceilingHeight = numberValue(room.ceilingHeight);
  const blocking = [];

  if (backWidth <= 0 || leftDepth <= 0 || rightDepth <= 0 || openingWidth <= 0) {
    blocking.push('Enter positive room and opening dimensions.');
  }

  const frontTotal = openingLeft + openingWidth + openingRight;
  if (backWidth > 0 && Math.abs(frontTotal - backWidth) > 1) {
    blocking.push(`Opening wall math should equal the back wall: ${formatInches(frontTotal)} entered vs ${formatInches(backWidth)} back wall.`);
  }

  if (openingWidth < 24) {
    blocking.push('Opening should be at least 24" clear.');
  }

  if (['back', 'left', 'right'].some((wall) => !closetHeights.includes(getWallHeight(room, wall)))) {
    blocking.push('Closet height must be 84" or 96" on every wall.');
  }

  if (ceilingHeight <= 0 || ['back', 'left', 'right'].some((wall) => ceilingHeight <= getWallHeight(room, wall))) {
    blocking.push(`Room ceiling height ${formatInches(ceilingHeight)} must be higher than every selected closet height.`);
  }

  return {
    blocking,
    complete: blocking.length === 0,
  };
}

function RoomSetup({ room, setRoom, corners, setCorners }) {
  const updateRoom = (key, value) => setRoom((current) => ({ ...current, [key]: value }));
  const updateCorner = (key, value) => setCorners((current) => ({ ...current, [key]: value }));
  const updateHeight = (wall, height) => updateRoom(wallHeightKeys[wall], height);

  return (
    <section className="rounded border border-stone-200 bg-white p-3">
      <h2 className="text-base font-bold text-stone-950">Room Dimensions</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {[
          ['backWidth', 'Room back wall width'],
          ['leftDepth', 'Room left wall width'],
          ['rightDepth', 'Room right wall width'],
          ['ceilingHeight', 'Room ceiling height'],
          ['openingWidth', 'Entrance opening'],
          ['openingLeft', 'Left return wall'],
          ['openingRight', 'Right return wall'],
        ].map(([key, label]) => (
          <label key={key} className="block">
            <span className="mb-1 block text-xs font-bold text-stone-500">{label}</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                step="0.25"
                value={room[key]}
                onChange={(event) => updateRoom(key, event.target.value)}
                className="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1.5 text-sm font-bold text-stone-950"
              />
              <span className="text-xs font-bold text-stone-500">in</span>
            </div>
          </label>
        ))}
      </div>

      <div className="mt-4 grid gap-2">
        <h3 className="text-xs font-bold uppercase text-stone-500">Closet System Height</h3>
        {numberValue(room.ceilingHeight) <= Math.max(...['back', 'left', 'right'].map((wall) => getWallHeight(room, wall))) && (
          <div className="rounded bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
            Room ceiling must be higher than every selected closet system height.
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          {['back', 'left', 'right'].map((wall) => (
            <div key={wall} className="rounded border border-stone-200 p-2">
              <div className="mb-2 text-xs font-bold text-stone-600">{wallLabels[wall]}</div>
              <div className="grid grid-cols-2 rounded border border-stone-300 bg-white p-0.5 text-xs font-bold">
                {closetHeights.map((height) => (
                  <button
                    key={height}
                    type="button"
                    onClick={() => updateHeight(wall, height)}
                    className={`rounded px-2 py-1.5 ${getWallHeight(room, wall) === height ? 'bg-brand-orange text-white' : 'text-stone-600 hover:bg-stone-100'}`}
                  >
                    {height}"
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <div>
          <h3 className="text-xs font-bold uppercase text-stone-500">Corner Run Choice</h3>
          <p className="mt-1 text-sm font-semibold text-stone-600">
            At each back corner, choose which wall gets the full closet run into the corner. The other wall stops short to leave the gray reach zone.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <CornerToggle
            label="Back-left corner"
            value={corners.backLeft}
            sideLabel="Left wall continues"
            onChange={(value) => updateCorner('backLeft', value)}
            sideValue="left"
          />
          <CornerToggle
            label="Back-right corner"
            value={corners.backRight}
            sideLabel="Right wall continues"
            onChange={(value) => updateCorner('backRight', value)}
            sideValue="right"
          />
        </div>
      </div>
    </section>
  );
}

function CornerToggle({ label, value, onChange, sideLabel, sideValue }) {
  const backSelected = value === 'back';
  const selectedText = backSelected ? 'Back wall continues; side wall stops short.' : `${sideLabel}; back wall stops short.`;

  return (
    <div className="rounded border border-stone-200 bg-stone-50 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-bold text-stone-700">{label}</div>
        <span className="rounded bg-white px-2 py-1 text-[11px] font-bold text-stone-500">14" x 12" reach zone</span>
      </div>
      <div className="grid grid-cols-2 rounded border border-stone-300 bg-white p-0.5 text-xs font-bold">
        {[
          ['back', 'Back wall continues'],
          [sideValue, sideLabel],
        ].map(([option, optionLabel]) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded px-2 py-1.5 ${value === option ? 'bg-brand-orange text-white' : 'text-stone-600 hover:bg-stone-100'}`}
          >
            {optionLabel}
          </button>
        ))}
      </div>
      <div className="mt-2 rounded bg-white px-2 py-1.5 text-xs font-semibold text-stone-600">
        {selectedText}
      </div>
    </div>
  );
}

function WalkInRoomDiagram({ room, corners, roomEvaluation }) {
  const backWidth = Math.max(1, numberValue(room.backWidth));
  const leftDepth = Math.max(1, numberValue(room.leftDepth));
  const rightDepth = Math.max(1, numberValue(room.rightDepth));
  const maxDepth = Math.max(leftDepth, rightDepth);
  const openingWidth = Math.max(0, numberValue(room.openingWidth));
  const openingLeft = Math.max(0, numberValue(room.openingLeft));
  const openingRight = Math.max(0, numberValue(room.openingRight));
  const openingStart = Math.min(backWidth, openingLeft);
  const openingEnd = Math.min(backWidth, openingLeft + openingWidth);
  const padding = 58;
  const viewWidth = 640;
  const viewHeight = 300;
  const wallPx = 7;
  const scale = Math.min((viewWidth - padding * 2) / backWidth, (viewHeight - padding * 2) / maxDepth);
  const toX = (value) => padding + value * scale;
  const toY = (value) => padding + value * scale;
  const backLeftReach = corners.backLeft === 'back'
    ? { x: 0, y: closetDepth, width: closetDepth, depth: cornerReachGap }
    : { x: closetDepth, y: 0, width: cornerReachGap, depth: closetDepth };
  const backRightReach = corners.backRight === 'back'
    ? { x: backWidth - closetDepth, y: closetDepth, width: closetDepth, depth: cornerReachGap }
    : { x: backWidth - closetDepth - cornerReachGap, y: 0, width: cornerReachGap, depth: closetDepth };

  const renderReachZone = (zone, id) => (
    <g key={id}>
      <rect
        x={toX(zone.x)}
        y={toY(zone.y)}
        width={Math.max(0, zone.width * scale)}
        height={Math.max(0, zone.depth * scale)}
        className="fill-stone-300/55 stroke-stone-500"
        strokeDasharray="4 3"
      />
    </g>
  );

  return (
    <section className="rounded border border-stone-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-stone-950">Walk-in Plan</h2>
          <p className="text-xs font-semibold text-stone-500">Left, back, right walls, entrance opening, and corner reach zones.</p>
        </div>
        <span className={`rounded px-2 py-1 text-xs font-bold ${roomEvaluation.complete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {roomEvaluation.complete ? 'Room ready' : 'Needs dimensions'}
        </span>
      </div>
      <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="h-[250px] w-full rounded bg-stone-50">
        <rect x={toX(0)} y={toY(0)} width={backWidth * scale} height={maxDepth * scale} className="fill-white stroke-stone-200" strokeWidth="1.5" />
        <rect x={toX(0)} y={toY(0) - wallPx / 2} width={backWidth * scale} height={wallPx} rx="1" className="fill-stone-600" />
        <rect x={toX(0) - wallPx / 2} y={toY(0)} width={wallPx} height={leftDepth * scale} rx="1" className="fill-stone-500" />
        <rect x={toX(backWidth) - wallPx / 2} y={toY(0)} width={wallPx} height={rightDepth * scale} rx="1" className="fill-stone-500" />
        {openingStart > 0 && <rect x={toX(0)} y={toY(maxDepth) - wallPx / 2} width={openingStart * scale} height={wallPx} rx="1" className="fill-stone-500" />}
        {backWidth - openingEnd > 0 && <rect x={toX(openingEnd)} y={toY(maxDepth) - wallPx / 2} width={(backWidth - openingEnd) * scale} height={wallPx} rx="1" className="fill-stone-500" />}
        <line x1={toX(openingStart)} y1={toY(maxDepth)} x2={toX(openingEnd)} y2={toY(maxDepth)} className="stroke-stone-400" strokeWidth="2" strokeDasharray="5 4" />
        {[backLeftReach, backRightReach].map(renderReachZone)}
        <text x={toX(backWidth / 2)} y={toY(0) - 14} textAnchor="middle" className="fill-stone-700 text-[16px] font-bold">
          Back wall {formatInches(backWidth)}
        </text>
        <text x={toX(0) - 24} y={toY(leftDepth / 2)} textAnchor="middle" className="fill-stone-700 text-[16px] font-bold" transform={`rotate(-90 ${toX(0) - 24} ${toY(leftDepth / 2)})`}>
          Left {formatInches(leftDepth)}
        </text>
        <text x={toX(backWidth) + 24} y={toY(rightDepth / 2)} textAnchor="middle" className="fill-stone-700 text-[16px] font-bold" transform={`rotate(90 ${toX(backWidth) + 24} ${toY(rightDepth / 2)})`}>
          Right {formatInches(rightDepth)}
        </text>
        <text x={toX(openingLeft + openingWidth / 2)} y={toY(maxDepth) + 20} textAnchor="middle" className="fill-emerald-700 text-[13px] font-bold">
          Opening {formatInches(openingWidth)}
        </text>
        {openingLeft > 0 && (
          <text x={toX(openingLeft / 2)} y={toY(maxDepth) + 20} textAnchor="middle" className="fill-stone-500 text-[13px] font-bold">
            L {formatInches(openingLeft)}
          </text>
        )}
        {openingRight > 0 && (
          <text x={toX(openingEnd + openingRight / 2)} y={toY(maxDepth) + 20} textAnchor="middle" className="fill-stone-500 text-[13px] font-bold">
            R {formatInches(openingRight)}
          </text>
        )}
        <text x={toX(backWidth / 2)} y={toY(Math.min(maxDepth - 8, closetDepth + cornerReachGap + 8))} textAnchor="middle" className="fill-stone-600 text-[12px] font-bold">
          shaded areas are 14" x 12" corner reach zones
        </text>
      </svg>
      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-4">
        <div className="rounded bg-stone-50 px-2 py-1.5">
          <div className="font-semibold text-stone-500">Back wall</div>
          <div className="text-sm font-bold text-stone-950">{formatInches(backWidth)}</div>
        </div>
        <div className="rounded bg-stone-50 px-2 py-1.5">
          <div className="font-semibold text-stone-500">Left / Right</div>
          <div className="text-sm font-bold text-stone-950">{formatInches(leftDepth)} / {formatInches(rightDepth)}</div>
        </div>
        <div className="rounded bg-stone-50 px-2 py-1.5">
          <div className="font-semibold text-stone-500">Ceiling</div>
          <div className={`text-sm font-bold ${roomEvaluation.complete ? 'text-emerald-700' : 'text-red-700'}`}>{formatInches(room.ceilingHeight)}</div>
        </div>
        <div className="rounded bg-stone-50 px-2 py-1.5">
          <div className="font-semibold text-stone-500">Opening</div>
          <div className="text-sm font-bold text-stone-950">{formatInches(openingWidth)}</div>
        </div>
        <div className="rounded bg-stone-50 px-2 py-1.5">
          <div className="font-semibold text-stone-500">Open math</div>
          <div className={`text-sm font-bold ${roomEvaluation.complete ? 'text-emerald-700' : 'text-red-700'}`}>{formatInches(openingLeft + openingWidth + openingRight)}</div>
        </div>
      </div>
    </section>
  );
}

function RoomCaptureStep({ room, setRoom, corners, setCorners, roomEvaluation, onContinue }) {
  return (
    <main className="app-shell bg-brand-ui text-brand-black">
      <header className="app-header flex items-center justify-between border-b border-stone-200 bg-white px-4">
        <div>
          <h1 className="text-lg font-bold text-stone-950">Walk-in Shape Planner</h1>
          <p className="text-xs font-semibold text-stone-500">Step 1: room dimensions</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <ConsultationCta compact />
        </div>
      </header>
      <section className="app-workspace min-h-0 w-full overflow-y-auto">
        <div className="mx-auto grid max-w-5xl gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4">
            <RoomSetup room={room} setRoom={setRoom} corners={corners} setCorners={setCorners} />
            <WalkInRoomDiagram room={room} corners={corners} roomEvaluation={roomEvaluation} />
          </div>
          <aside className="rounded border border-stone-200 bg-white p-3">
            <h2 className="text-base font-bold text-stone-950">Step 2</h2>
            <p className="mt-2 text-sm font-semibold text-stone-600">After the room is captured, the planner opens a wider layout for configurations, wall runs, and 3D review.</p>
            <div className="mt-4 grid gap-2 text-sm font-semibold">
              {roomEvaluation.blocking.length === 0 ? (
                <div className="rounded bg-emerald-50 px-3 py-2 text-emerald-700">Room dimensions are ready.</div>
              ) : (
                roomEvaluation.blocking.map((warning) => (
                  <div key={warning} className="rounded bg-red-50 px-3 py-2 text-red-700">
                    {warning}
                  </div>
                ))
              )}
            </div>
            <button
              type="button"
              disabled={!roomEvaluation.complete}
              onClick={onContinue}
              className="mt-4 w-full rounded bg-stone-950 px-4 py-2 text-sm font-bold text-white disabled:bg-stone-300"
            >
              Continue to configurations
            </button>
          </aside>
        </div>
      </section>
    </main>
  );
}

function RoomSummaryBar({ room, corners, onEdit, compact = false }) {
  const values = [
    ['Back', formatInches(room.backWidth), formatInches(getWallHeight(room, 'back'))],
    ['Left', formatInches(room.leftDepth), formatInches(getWallHeight(room, 'left'))],
    ['Right', formatInches(room.rightDepth), formatInches(getWallHeight(room, 'right'))],
    ['Opening', formatInches(room.openingWidth), `${formatInches(room.openingLeft)} / ${formatInches(room.openingRight)}`],
  ];

  return (
    <section className="rounded border border-stone-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-stone-950">{compact ? 'Room' : 'Captured Room'}</h2>
          <p className="text-xs font-semibold text-stone-500">
            Back-left: {corners.backLeft === 'back' ? 'back wall wins' : 'left wall wins'} / Back-right: {corners.backRight === 'back' ? 'back wall wins' : 'right wall wins'}
          </p>
        </div>
        <button type="button" onClick={onEdit} className="rounded border border-stone-300 px-3 py-2 text-sm font-bold text-stone-700 hover:bg-stone-50">
          Edit room
        </button>
      </div>
      <dl className={`mt-3 grid gap-2 ${compact ? '' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
        {values.map(([label, primary, secondary]) => (
          <div key={label} className={`rounded border border-stone-200 bg-stone-50 ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
            <dt className="text-xs font-bold uppercase text-stone-500">{label}</dt>
            <dd className={`${compact ? 'mt-0.5' : 'mt-1'} flex items-center justify-between gap-2 text-sm font-bold text-stone-950`}>
              <span>{primary}</span>
              <span className="text-xs text-stone-500">{label === 'Opening' ? 'L/R' : 'Height'} {secondary}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ClosetTypeStart({ onWalkIn }) {
  return (
    <main className="grid min-h-screen place-items-center bg-brand-ui p-6 text-brand-black">
      <section className="w-full max-w-3xl rounded border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase text-brand-orange">Closets Warehouse</p>
        <h1 className="mt-1 text-3xl font-bold text-stone-950">Walk-in Shape Planner</h1>
        <div className="mt-4 flex justify-start">
          <ConsultationCta />
        </div>
        <div className="mt-6">
          <button type="button" onClick={onWalkIn} className="rounded border border-brand-orange bg-orange-50 p-4 text-left transition hover:bg-orange-100">
            <div className="text-lg font-bold text-stone-950">Start walk-in design</div>
            <div className="mt-2 text-sm font-semibold text-stone-600">Plan left, back, and right wall runs with corner and entrance rules.</div>
          </button>
        </div>
      </section>
    </main>
  );
}

function TowerConfigIcon({ code }) {
  const shelves = {
    LH: [64],
    DH: [38, 72],
    HS: [42, 58, 74],
    S3D: [24, 38, 52],
    H3D: [28],
    S2D: [24, 38, 52],
    SHELF: [22, 34, 46, 58, 70, 82],
  }[code] || [34, 58, 82];
  const drawers = {
    S3D: [64, 76, 88],
    H3D: [58, 72, 86],
    S2D: [70, 84],
  }[code] || [];
  const rods = {
    LH: [26],
    DH: [26, 60],
    HS: [28],
    H3D: [30],
  }[code] || [];

  return (
    <svg viewBox="0 0 72 108" aria-hidden="true" className="h-16 w-12 text-stone-800">
      <rect x="10" y="8" width="52" height="92" rx="2" className="fill-white stroke-stone-700" strokeWidth="3" />
      <line x1="18" y1="8" x2="18" y2="100" className="stroke-stone-200" strokeWidth="2" />
      <line x1="54" y1="8" x2="54" y2="100" className="stroke-stone-200" strokeWidth="2" />
      {shelves.map((y) => (
        <line key={`shelf-${code}-${y}`} x1="13" y1={y} x2="59" y2={y} className="stroke-stone-500" strokeWidth="2" />
      ))}
      {rods.map((y) => (
        <g key={`rod-${code}-${y}`}>
          <line x1="22" y1={y} x2="50" y2={y} className="stroke-brand-orange" strokeWidth="4" strokeLinecap="round" />
          <path d={`M25 ${y + 4}c2 7 8 11 11 11s9-4 11-11`} fill="none" className="stroke-stone-500" strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
      {drawers.map((y) => (
        <g key={`drawer-${code}-${y}`}>
          <rect x="17" y={y - 7} width="38" height="12" rx="1.5" className="fill-orange-50 stroke-orange-700" strokeWidth="2" />
          <line x1="30" y1={y - 1} x2="42" y2={y - 1} className="stroke-orange-700" strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

function WallRunEditor({ wall, wallHeight, usableLength, rawLength, modules, onAdd, onDropModule, onRemove, onMove, onWidthChange }) {
  const [showPicker, setShowPicker] = useState(false);
  const moveLabels =
    wall === 'back'
      ? { previous: '<', next: '>', previousTitle: 'Move left', nextTitle: 'Move right' }
      : { previous: 'Up', next: 'Dn', previousTitle: 'Move up', nextTitle: 'Move down' };
  const runLength = getRunLength(modules);
  const availableLength = Math.max(0, numberValue(usableLength));
  const graySpaceLength = Math.max(0, numberValue(rawLength) - availableLength);
  const usageText = `${formatInches(runLength)} of ${formatInches(availableLength)} closet space`;
  const exceedsLength = runLength > availableLength + 0.01;
  const addConfiguration = (code) => {
    onAdd(code, wall);
    setShowPicker(false);
  };

  return (
    <section
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const code = event.dataTransfer.getData('text/plain');
        if (code) {
          onDropModule(code, wall);
        }
      }}
      className={`min-w-0 rounded border bg-white p-3 ${exceedsLength ? 'border-red-300' : 'border-stone-200'}`}
    >
      <div className="mb-3 flex w-full flex-wrap items-center justify-between gap-2">
        <span>
          <span className="block text-base font-bold text-stone-950">{wallLabels[wall]}</span>
          <span className={`text-xs font-semibold ${exceedsLength ? 'text-red-700' : 'text-stone-500'}`}>
            {modules.length ? `${modules.length} tower${modules.length === 1 ? '' : 's'}` : '0 towers'} / {usageText}
          </span>
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPicker((current) => !current)}
            aria-expanded={showPicker}
            title={`Add configuration to ${wallLabels[wall]}`}
            className="grid h-9 w-9 place-items-center rounded bg-brand-orange text-xl font-bold leading-none text-white transition hover:bg-orange-700"
          >
            +
          </button>
        </div>
      </div>
      {exceedsLength && (
        <div className="mb-3 rounded bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          This wall exceeds the allowable closet space by {formatInches(runLength - availableLength)}.
        </div>
      )}

      {showPicker && (
        <div className="mb-3 grid grid-cols-4 gap-2 rounded border border-orange-200 bg-orange-50 p-2 sm:grid-cols-7">
          {moduleConfigs.map((config) => (
            <button
              key={config.code}
              type="button"
              onClick={() => addConfiguration(config.code)}
              aria-label={`Add ${config.label} to ${wallLabels[wall]}`}
              title={`${config.label} - ${config.defaultWidth}" default bay`}
              className="relative grid min-h-[88px] place-items-center rounded border border-stone-200 bg-white px-2 py-2 transition hover:border-brand-orange hover:bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange"
            >
              <TowerConfigIcon code={config.code} />
              <span className="sr-only">{config.label}</span>
              <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded bg-orange-50 text-xs font-bold leading-none text-brand-orange">+</span>
            </button>
          ))}
        </div>
      )}

      <div className="min-h-[128px] min-w-0 rounded border border-dashed border-stone-300 bg-stone-50 p-2 pr-4 sm:pr-2">
        {modules.length === 0 ? (
          <div className="grid h-[108px] place-items-center text-center">
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="inline-flex items-center gap-2 rounded border border-stone-300 bg-white px-3 py-2 text-sm font-bold text-stone-700 transition hover:border-brand-orange hover:text-brand-orange"
            >
              <span className="grid h-6 w-6 place-items-center rounded bg-orange-50 text-base leading-none text-brand-orange">+</span>
              Add configuration
            </button>
          </div>
        ) : (
          <div className="min-w-0 overflow-x-auto pr-2">
            <div className="relative mb-2 flex items-center pt-5">
              <div className="absolute left-0 top-0 text-xs font-bold uppercase text-stone-500">Move</div>
              {modules.map((module, index) => {
                const visualWidth = Math.max(86, numberValue(module.width) * 4.2);

                return (
                  <div
                    key={`walkin-move-${module.id}`}
                    className="grid shrink-0 grid-cols-2 items-center px-1"
                    style={{ width: `${visualWidth + (index === 0 ? 16 : 8)}px` }}
                  >
                    <button
                      type="button"
                      onClick={() => onMove(wall, index, -1)}
                      disabled={index === 0}
                      className="grid h-7 min-w-7 place-items-center justify-self-start rounded border border-stone-300 bg-white px-2 text-xs font-bold text-stone-700 disabled:opacity-25"
                      title={moveLabels.previousTitle}
                    >
                      {moveLabels.previous}
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(wall, index, 1)}
                      disabled={index === modules.length - 1}
                      className="grid h-7 min-w-7 place-items-center justify-self-end rounded border border-stone-300 bg-white px-2 text-xs font-bold text-stone-700 disabled:opacity-25"
                      title={moveLabels.nextTitle}
                    >
                      {moveLabels.next}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex min-h-[126px] items-stretch">
              {modules.map((module, index) => {
                const visualWidth = Math.max(86, numberValue(module.width) * 4.2);

                return (
                  <div key={module.id} className="group flex shrink-0 items-stretch">
                    {index === 0 && <div className="w-2 rounded-l bg-stone-300" title="Side panel" />}
                    <div
                      className={`flex flex-col justify-between border-y border-stone-300 p-2 ${index % 2 ? 'bg-orange-50' : 'bg-white'}`}
                      style={{ width: `${visualWidth}px` }}
                      title={module.label}
                    >
                      <div className="grid justify-items-center gap-1">
                        <TowerConfigIcon code={module.code} />
                        <div className="text-xs font-bold text-stone-600">{formatInches(module.width)}</div>
                      </div>
                      <label className="mt-3 flex items-center gap-1">
                        <select
                          value={module.width}
                          onChange={(event) => onWidthChange(wall, module.id, Number(event.target.value))}
                          className="min-w-0 flex-1 rounded border border-stone-300 bg-white px-1.5 py-1 text-xs font-bold text-stone-700"
                        >
                          {allowedModuleWidths.map((width) => (
                            <option key={width} value={width}>
                              {width}" bay
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => onRemove(wall, module.id)}
                        className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
                      >
                        Remove tower
                      </button>
                    </div>
                    <div className="w-2 bg-stone-300" title={index === modules.length - 1 ? 'Side panel' : 'Shared divider panel'} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-4">
        <div className="rounded bg-white px-2 py-1.5">
          <div className="font-semibold text-stone-500">Space used</div>
          <div className={`text-sm font-bold ${exceedsLength ? 'text-red-700' : 'text-stone-950'}`}>{modules.length ? formatInches(runLength) : '-'}</div>
        </div>
        <div className="rounded bg-white px-2 py-1.5">
          <div className="font-semibold text-stone-500">Closet space</div>
          <div className="text-sm font-bold text-stone-950">{formatInches(availableLength)}</div>
        </div>
        <div className="rounded bg-white px-2 py-1.5">
          <div className="font-semibold text-stone-500">Towers</div>
          <div className="text-sm font-bold text-stone-950">{modules.length || '-'}</div>
        </div>
        <div className="rounded bg-white px-2 py-1.5">
          <div className="font-semibold text-stone-500">{graySpaceLength > 0 ? 'Gray space' : 'Height'}</div>
          <div className="text-sm font-bold text-stone-950">{graySpaceLength > 0 ? formatInches(graySpaceLength) : formatInches(wallHeight)}</div>
        </div>
      </div>
    </section>
  );
}

function getModuleSegments(modules, start = 0) {
  let cursor = start + panelThickness;

  return modules.map((module) => {
    const segment = {
      module,
      start: cursor,
      length: numberValue(module.width),
      center: cursor + numberValue(module.width) / 2,
    };

    cursor += numberValue(module.width) + panelThickness;
    return segment;
  });
}

function getWalkInLayoutCode(module, height) {
  return module.code === 'SHELF' ? getShelfCodeForHeight(height) : module.code;
}

function buildAdjustableShelves(height, count, bottom = toeKickHeight + panelThickness, top = height - panelThickness) {
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

function buildWalkInTowerLayout(height, code) {
  const topShelf = height - panelThickness;
  const bottomShelf = toeKickHeight;
  const s2dDrawerTop = getDrawerBounds(buildDrawers('S2D')).top;
  const drawerDeck = code === 'S2D' ? s2dDrawerTop : 46;
  const longHangShelfY = height - 18;
  const rodDropBelowShelf = 4.5;
  const longHangRodY = longHangShelfY - rodDropBelowShelf;
  const hsLowerShelfTopY = height >= 96 ? 52 : 43;
  const hasTallHeight = height >= 96;
  const shelfCountByCode = {
    S3D: hasTallHeight ? 5 : 4,
    H3D: hasTallHeight ? 2 : 1,
    S2D: hasTallHeight ? 5 : 4,
    ...shelfOnlyAdjustableShelfCounts,
  };
  const defaultShelves = [
    { y: bottomShelf, fixed: true },
    ...buildAdjustableShelves(height, shelfCountByCode[code] || 3),
    { y: topShelf, fixed: true },
  ];

  if (code === 'LH') {
    return {
      shelves: [
        { y: bottomShelf, fixed: true },
        { y: longHangShelfY, fixed: false },
        { y: topShelf, fixed: true },
      ],
      rods: [{ label: 'Long hang rod', y: longHangRodY }],
      drawers: [],
    };
  }

  if (code === 'HS') {
    return {
      shelves: [
        { y: bottomShelf, fixed: true },
        ...buildAdjustableShelves(height, 3, bottomShelf, hsLowerShelfTopY),
        { y: topShelf, fixed: true },
      ],
      rods: [{ label: 'Hang rod', y: height - 8.5 }],
      drawers: [],
    };
  }

  if (code === 'H3D') {
    return {
      shelves: [
        { y: bottomShelf, fixed: true },
        { y: 14.35, fixed: false },
        { y: drawerDeck, fixed: false },
        { y: topShelf, fixed: true },
      ],
      rods: [{ label: 'Hang rod', y: height - 7.5 }],
      drawers: buildDrawers(code),
    };
  }

  if (code === 'DH') {
    const middleShelfY = bottomShelf + (topShelf - bottomShelf) / 2;

    return {
      shelves: [
        { y: bottomShelf, fixed: true },
        { y: middleShelfY, fixed: false },
        { y: topShelf, fixed: true },
      ],
      rods: [
        { label: 'Upper rod', y: topShelf - rodDropBelowShelf },
        { label: 'Lower rod', y: middleShelfY - rodDropBelowShelf },
      ],
      drawers: [],
    };
  }

  if (code === 'S3D' || code === 'S2D') {
    const drawerTowerDrawers = buildDrawers(code);
    const drawerBounds = getDrawerBounds(drawerTowerDrawers);
    const lowerShelfY = bottomShelf + (drawerBounds.bottom - bottomShelf) / 2;
    const upperShelfCount = hasTallHeight ? 3 : 2;

    return {
      shelves: [
        { y: bottomShelf, fixed: true },
        { y: lowerShelfY, fixed: false },
        { y: drawerDeck, fixed: code === 'S2D' },
        ...buildAdjustableShelves(height, upperShelfCount, drawerDeck, topShelf),
        { y: topShelf, fixed: true },
      ],
      rods: [],
      drawers: drawerTowerDrawers,
    };
  }

  return {
    shelves: defaultShelves,
    rods: [],
    drawers: [],
  };
}

function TopDownPlan({ room, runs, corners, evaluation }) {
  const backWidth = Math.max(1, numberValue(room.backWidth));
  const leftDepth = Math.max(1, numberValue(room.leftDepth));
  const rightDepth = Math.max(1, numberValue(room.rightDepth));
  const maxDepth = Math.max(leftDepth, rightDepth);
  const padding = 54;
  const viewWidth = 560;
  const viewHeight = 300;
  const scale = Math.min((viewWidth - padding * 2) / backWidth, (viewHeight - padding * 2) / maxDepth);
  const toX = (value) => padding + value * scale;
  const toY = (value) => padding + value * scale;
  const run = evaluation.runLengths;
  const backStart = corners.backLeft === 'left' ? cornerStopDistance : 0;
  const leftStart = corners.backLeft === 'back' ? cornerStopDistance : 0;
  const rightStart = corners.backRight === 'back' ? cornerStopDistance : 0;
  const openingLeft = numberValue(room.openingLeft);
  const openingWidth = numberValue(room.openingWidth);
  const backSegments = getModuleSegments(runs.back, backStart);
  const leftSegments = getModuleSegments(runs.left, leftStart);
  const rightSegments = getModuleSegments(runs.right, rightStart);
  const reachZones = [
    corners.backLeft === 'back'
      ? { id: 'left-corner-reach', x: 0, y: closetDepth, width: closetDepth, height: cornerReachGap, labelX: closetDepth / 2, labelY: closetDepth + cornerReachGap / 2 }
      : { id: 'back-left-corner-reach', x: closetDepth, y: 0, width: cornerReachGap, height: closetDepth, labelX: closetDepth + cornerReachGap / 2, labelY: closetDepth / 2 },
    corners.backRight === 'back'
      ? {
          id: 'right-corner-reach',
          x: backWidth - closetDepth,
          y: closetDepth,
          width: closetDepth,
          height: cornerReachGap,
          labelX: backWidth - closetDepth / 2,
          labelY: closetDepth + cornerReachGap / 2,
        }
      : {
          id: 'back-right-corner-reach',
          x: backWidth - closetDepth - cornerReachGap,
          y: 0,
          width: cornerReachGap,
          height: closetDepth,
          labelX: backWidth - closetDepth - cornerReachGap / 2,
          labelY: closetDepth / 2,
        },
  ];

  return (
    <section className="rounded border border-stone-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-bold text-stone-950">Room Plan</h2>
        <span className={`rounded px-2 py-1 text-xs font-bold ${evaluation.complete ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {evaluation.complete ? 'Valid' : 'Needs fixes'}
        </span>
      </div>
      <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="h-[300px] w-full rounded bg-stone-50">
        <line x1={toX(0)} y1={toY(0)} x2={toX(backWidth)} y2={toY(0)} className="stroke-stone-900" strokeWidth="3" />
        <line x1={toX(0)} y1={toY(0)} x2={toX(0)} y2={toY(leftDepth)} className="stroke-stone-900" strokeWidth="3" />
        <line x1={toX(backWidth)} y1={toY(0)} x2={toX(backWidth)} y2={toY(rightDepth)} className="stroke-stone-900" strokeWidth="3" />
        <line x1={toX(0)} y1={toY(maxDepth)} x2={toX(openingLeft)} y2={toY(maxDepth)} className="stroke-stone-400" strokeWidth="2" />
        <line x1={toX(openingLeft + openingWidth)} y1={toY(maxDepth)} x2={toX(backWidth)} y2={toY(maxDepth)} className="stroke-stone-400" strokeWidth="2" />

        {run.back > 0 && <rect x={toX(backStart)} y={toY(0)} width={run.back * scale} height={closetDepth * scale} className="fill-brand-orange/70 stroke-orange-800" />}
        {run.left > 0 && <rect x={toX(0)} y={toY(leftStart)} width={closetDepth * scale} height={run.left * scale} className="fill-stone-300 stroke-stone-700" />}
        {run.right > 0 && <rect x={toX(backWidth - closetDepth)} y={toY(rightStart)} width={closetDepth * scale} height={run.right * scale} className="fill-stone-300 stroke-stone-700" />}

        {backSegments.map(({ module, start, length, center }, index) => (
          <g key={`back-segment-${module.id}`}>
            <rect x={toX(start)} y={toY(1.6)} width={length * scale} height={(closetDepth - 3.2) * scale} className={index % 2 ? 'fill-orange-200/75 stroke-orange-800' : 'fill-orange-100/75 stroke-orange-800'} />
            <text x={toX(center)} y={toY(closetDepth / 2) + 4} textAnchor="middle" className="fill-stone-900 text-[13px] font-bold">
              {formatInches(module.width)}
            </text>
          </g>
        ))}
        {leftSegments.map(({ module, start, length, center }, index) => (
          <g key={`left-segment-${module.id}`}>
            <rect x={toX(1.6)} y={toY(start)} width={(closetDepth - 3.2) * scale} height={length * scale} className={index % 2 ? 'fill-stone-200 stroke-stone-700' : 'fill-white stroke-stone-700'} />
            <text x={toX(closetDepth / 2)} y={toY(center) + 4} textAnchor="middle" className="fill-stone-900 text-[12px] font-bold" transform={`rotate(-90 ${toX(closetDepth / 2)} ${toY(center)})`}>
              {formatInches(module.width)}
            </text>
          </g>
        ))}
        {rightSegments.map(({ module, start, length, center }, index) => (
          <g key={`right-segment-${module.id}`}>
            <rect x={toX(backWidth - closetDepth + 1.6)} y={toY(start)} width={(closetDepth - 3.2) * scale} height={length * scale} className={index % 2 ? 'fill-stone-200 stroke-stone-700' : 'fill-white stroke-stone-700'} />
            <text x={toX(backWidth - closetDepth / 2)} y={toY(center) + 4} textAnchor="middle" className="fill-stone-900 text-[12px] font-bold" transform={`rotate(90 ${toX(backWidth - closetDepth / 2)} ${toY(center)})`}>
              {formatInches(module.width)}
            </text>
          </g>
        ))}

        {reachZones.map((zone) => (
          <g key={zone.id}>
            <rect
              x={toX(zone.x)}
              y={toY(zone.y)}
              width={zone.width * scale}
              height={zone.height * scale}
              className="fill-stone-400/50 stroke-stone-600"
              strokeDasharray="4 3"
            />
            <text x={toX(zone.labelX)} y={toY(zone.labelY) + 4} textAnchor="middle" className="fill-stone-700 text-[11px] font-bold">
              14x12 reach
            </text>
          </g>
        ))}

        <text x={toX(backWidth / 2)} y={toY(0) - 12} textAnchor="middle" className="fill-stone-700 text-[16px] font-bold">
          Back {formatInches(backWidth)}
        </text>
        <text x={toX(openingLeft + openingWidth / 2)} y={toY(maxDepth) + 20} textAnchor="middle" className="fill-stone-600 text-[14px] font-bold">
          Opening {formatInches(openingWidth)}
        </text>
        <text x={toX(0) - 22} y={toY(leftDepth / 2)} textAnchor="middle" className="fill-stone-700 text-[16px] font-bold" transform={`rotate(-90 ${toX(0) - 22} ${toY(leftDepth / 2)})`}>
          Left {formatInches(leftDepth)}
        </text>
        <text x={toX(backWidth) + 22} y={toY(rightDepth / 2)} textAnchor="middle" className="fill-stone-700 text-[16px] font-bold" transform={`rotate(90 ${toX(backWidth) + 22} ${toY(rightDepth / 2)})`}>
          Right {formatInches(rightDepth)}
        </text>
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-bold text-stone-600">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-5 rounded-sm bg-stone-400/50 ring-1 ring-stone-500" />
          14" x 12" reach zone measured from the closet face line: leave blank or cover with top shelf/bridge only
        </span>
      </div>
    </section>
  );
}

function WalkInBoxPart({ position, scale, material, edge = true }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={scale} />
      <meshStandardMaterial {...material} />
      {edge && <Edges color="#deded6" threshold={18} />}
    </mesh>
  );
}

function WalkInHanger({ xPosition, y, z, scale = 0.72 }) {
  return (
    <group position={[xPosition, y, z]} scale={scale}>
      <mesh position={[0, -0.2, 0]} rotation={[0, 0, 0.82]} castShadow>
        <boxGeometry args={[0.22, 3.5, 0.25]} />
        <meshStandardMaterial color="#b07a3d" roughness={0.58} metalness={0} />
      </mesh>
      <mesh position={[0, -0.2, 0]} rotation={[0, 0, -0.82]} castShadow>
        <boxGeometry args={[0.22, 3.5, 0.25]} />
        <meshStandardMaterial color="#b07a3d" roughness={0.58} metalness={0} />
      </mesh>
      <mesh position={[0, -1.65, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <boxGeometry args={[0.18, 3.4, 0.22]} />
        <meshStandardMaterial color="#b07a3d" roughness={0.58} metalness={0} />
      </mesh>
      <mesh position={[0, 1.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.42, 0.045, 10, 24, Math.PI * 1.25]} />
        <meshStandardMaterial color="#b7b7b7" roughness={0.24} metalness={0.9} />
      </mesh>
    </group>
  );
}

function WalkInModule3D({ module, height }) {
  const code = getWalkInLayoutCode(module, height);
  const width = numberValue(module.width);
  const layout = buildWalkInTowerLayout(height, code);
  const panelMaterial = { color: '#fffdf7', roughness: 0.68, metalness: 0 };
  const edgeMaterial = { color: '#f4f1e9', roughness: 0.78, metalness: 0 };
  const drawerMaterial = { color: '#f8f7f1', roughness: 0.74, metalness: 0 };
  const pullMaterial = { color: '#c7c5bf', roughness: 0.32, metalness: 0.82 };
  const toeKickPanelZ = closetDepth / 2 - 2.1 - panelThickness / 2;
  const frontZ = closetDepth / 2 + 0.28;
  const drawerFaceWidth = width + drawerSideOverlay * 2;

  return (
    <group>
      <WalkInBoxPart position={[-width / 2 - panelThickness / 2, height / 2, 0]} scale={[panelThickness, height, closetDepth]} material={panelMaterial} />
      <WalkInBoxPart position={[width / 2 + panelThickness / 2, height / 2, 0]} scale={[panelThickness, height, closetDepth]} material={panelMaterial} />

      {layout.shelves.map((shelf, index) => (
        <WalkInBoxPart
          key={`shelf-${index}-${shelf.y}`}
          position={[0, shelf.y + panelThickness / 2, 0]}
          scale={[width, panelThickness, closetDepth]}
          material={panelMaterial}
        />
      ))}

      <WalkInBoxPart position={[0, toeKickHeight / 2, toeKickPanelZ]} scale={[width, toeKickHeight, panelThickness]} material={edgeMaterial} />

      {layout.rods.map((rod, rodIndex) => {
        const rodLength = Math.max(1, width - 2.4);

        return (
          <group key={`${rod.label}-${rod.y}`} position={[0, rod.y, frontDrillLineZ]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
              <cylinderGeometry args={[0.34, 0.34, rodLength, 32]} />
              <meshStandardMaterial color="#b8b8b8" roughness={0.25} metalness={0.9} />
            </mesh>
            {[-rodLength / 2, rodLength / 2].map((bracketX) => (
              <mesh key={`bracket-${bracketX}`} position={[bracketX, 0, -0.4]} castShadow receiveShadow>
                <sphereGeometry args={[0.48, 20, 14]} />
                <meshStandardMaterial color="#a6a6a6" roughness={0.35} metalness={0.85} />
              </mesh>
            ))}
            {Array.from({ length: Math.max(3, Math.floor(width / 6)) }, (_, index) => {
              const spacing = rodLength / (Math.max(3, Math.floor(width / 6)) + 1);
              return <WalkInHanger key={`hanger-${rodIndex}-${index}`} xPosition={-rodLength / 2 + spacing * (index + 1)} y={-1.4} z={-0.22 - index * 0.02} />;
            })}
          </group>
        );
      })}

      {layout.drawers.map((drawer, index) => (
        <group key={`${drawer.label}-${drawer.centerY}`}>
          <WalkInBoxPart position={[0, drawer.centerY, frontZ]} scale={[drawerFaceWidth, drawer.height, 0.42]} material={drawerMaterial} />
          <group position={[0, drawer.centerY, frontZ + 0.58]}>
            <WalkInBoxPart position={[0, 0, drawerPullProjection / 2]} scale={[drawerPullLength, drawerPullHeight, 0.5]} material={pullMaterial} edge={false} />
            {[-1, 1].map((side) => (
              <WalkInBoxPart
                key={`pull-post-${index}-${side}`}
                position={[side * (drawerPullLength / 2 - 0.35), 0, 0.15]}
                scale={[0.42, drawerPullHeight, 0.7]}
                material={pullMaterial}
                edge={false}
              />
            ))}
          </group>
        </group>
      ))}
    </group>
  );
}

function WalkInRun3D({ wall, room, runs, corners, backWidth, maxDepth }) {
  const wallHeight = getWallHeight(room, wall);
  const segments =
    wall === 'back'
      ? getModuleSegments(runs.back, corners.backLeft === 'left' ? cornerStopDistance : 0)
      : wall === 'left'
        ? getModuleSegments(runs.left, corners.backLeft === 'back' ? cornerStopDistance : 0)
        : getModuleSegments(runs.right, corners.backRight === 'back' ? cornerStopDistance : 0);
  const centerX = backWidth / 2;
  const centerZ = maxDepth / 2;

  return (
    <>
      {segments.map(({ module, start, length }) => {
        const centerAlongWall = start + length / 2;
        const position =
          wall === 'back'
            ? [centerAlongWall - centerX, 0, closetDepth / 2 - centerZ]
            : wall === 'left'
              ? [closetDepth / 2 - centerX, 0, centerAlongWall - centerZ]
              : [backWidth - closetDepth / 2 - centerX, 0, centerAlongWall - centerZ];
        const rotation = wall === 'back' ? [0, 0, 0] : wall === 'left' ? [0, Math.PI / 2, 0] : [0, -Math.PI / 2, 0];

        return (
          <group key={`three-${wall}-${module.id}`} position={position} rotation={rotation}>
            <WalkInModule3D module={{ ...module, width: length }} height={wallHeight} />
          </group>
        );
      })}
    </>
  );
}

function WalkInRoom3D({ room, runs, corners }) {
  const backWidth = Math.max(1, numberValue(room.backWidth));
  const leftDepth = Math.max(1, numberValue(room.leftDepth));
  const rightDepth = Math.max(1, numberValue(room.rightDepth));
  const maxDepth = Math.max(leftDepth, rightDepth);
  const maxHeight = Math.max(...['back', 'left', 'right'].map((wall) => getWallHeight(room, wall)));
  const roomWallMaterial = { color: '#f2f0ea', roughness: 0.96, metalness: 0, transparent: true, opacity: 0.08, depthWrite: false };
  const floorMaterial = { color: '#d9c19a', roughness: 0.68, metalness: 0 };

  return (
    <group>
      <mesh position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[backWidth + 20, maxDepth + 28]} />
        <meshStandardMaterial {...floorMaterial} />
      </mesh>
      <WalkInBoxPart position={[0, maxHeight / 2, -maxDepth / 2 - 0.2]} scale={[backWidth, maxHeight, 0.35]} material={roomWallMaterial} edge={false} />
      <WalkInBoxPart
        position={[-backWidth / 2 - 0.2, maxHeight / 2, -maxDepth / 2 + leftDepth / 2]}
        scale={[0.35, maxHeight, leftDepth]}
        material={roomWallMaterial}
        edge={false}
      />
      <WalkInBoxPart
        position={[backWidth / 2 + 0.2, maxHeight / 2, -maxDepth / 2 + rightDepth / 2]}
        scale={[0.35, maxHeight, rightDepth]}
        material={roomWallMaterial}
        edge={false}
      />
      <WalkInRun3D wall="back" room={room} runs={runs} corners={corners} backWidth={backWidth} maxDepth={maxDepth} />
      <WalkInRun3D wall="left" room={room} runs={runs} corners={corners} backWidth={backWidth} maxDepth={maxDepth} />
      <WalkInRun3D wall="right" room={room} runs={runs} corners={corners} backWidth={backWidth} maxDepth={maxDepth} />
      <ContactShadows position={[0, 0.02, 2]} opacity={0.24} scale={120} blur={3.5} far={18} />
    </group>
  );
}

function WalkInOrbitHintBadge() {
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

function WalkIn3DPreview({ room, runs, corners, evaluation }) {
  const orbitBackWidth = Math.max(1, numberValue(room.backWidth));
  const orbitLeftDepth = Math.max(1, numberValue(room.leftDepth));
  const orbitRightDepth = Math.max(1, numberValue(room.rightDepth));
  const orbitMaxDepth = Math.max(orbitLeftDepth, orbitRightDepth);
  const orbitMaxHeight = Math.max(...['back', 'left', 'right'].map((wall) => getWallHeight(room, wall)));
  const orbitRoomRadius = Math.max(orbitBackWidth, orbitMaxDepth, orbitMaxHeight) * 1.35;
  const orbitCameraTarget = [0, orbitMaxHeight * 0.45, -orbitMaxDepth * 0.22];

  return (
    <section className="rounded border border-stone-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-stone-950">3D View</h2>
          <p className="text-xs font-semibold text-stone-500">Drag to orbit 360, scroll to zoom</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded px-2 py-1 text-xs font-bold ${evaluation.complete ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {evaluation.complete ? 'Valid' : 'Needs fixes'}
          </span>
        </div>
      </div>
      <div className="relative w-full overflow-hidden rounded bg-stone-50" style={{ height: 560 }}>
        <WalkInOrbitHintBadge />
        <Canvas shadows camera={{ position: [orbitRoomRadius * 0.85, orbitMaxHeight * 0.72, orbitRoomRadius * 0.95], fov: 36, near: 0.1, far: 1200 }} style={{ width: '100%', height: '100%' }}>
          <color attach="background" args={['#fbfaf6']} />
          <hemisphereLight args={['#fff8ea', '#d3c2a1', 0.5]} />
          <ambientLight intensity={0.78} />
          <directionalLight
            position={[-48, 88, 70]}
            intensity={2.4}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-90}
            shadow-camera-right={90}
            shadow-camera-top={120}
            shadow-camera-bottom={-20}
          />
          <directionalLight position={[72, 64, 72]} intensity={0.95} />
          <directionalLight position={[0, 54, -44]} intensity={0.45} />
          <WalkInRoom3D room={room} runs={runs} corners={corners} />
          <OrbitControls
            makeDefault
            enableDamping
            enablePan
            target={orbitCameraTarget}
            minDistance={Math.max(72, orbitRoomRadius * 0.55)}
            maxDistance={Math.max(260, orbitRoomRadius * 2.4)}
            maxPolarAngle={Math.PI * 0.49}
          />
        </Canvas>
      </div>
    </section>
  );

  const backWidth = Math.max(1, numberValue(room.backWidth));
  const leftDepth = Math.max(1, numberValue(room.leftDepth));
  const rightDepth = Math.max(1, numberValue(room.rightDepth));
  const maxDepth = Math.max(leftDepth, rightDepth);
  const viewWidth = 760;
  const viewHeight = 380;
  const heightScale = 0.55;
  const getDisplayHeight = (wall) => getWallHeight(room, wall) * heightScale;
  const maxCabinetHeight = Math.max(...['back', 'left', 'right'].map((wall) => getDisplayHeight(wall)));
  const scale = Math.min(4, 650 / Math.max(backWidth + maxDepth, 1));
  const isoX = scale * 0.86;
  const isoY = scale * 0.36;
  const isoZ = scale * 0.52;
  const centerX = backWidth / 2;
  const centerY = maxDepth / 2;
  const rotation = (viewAngle * Math.PI) / 180;
  const rotatePoint = (x, y) => {
    const dx = x - centerX;
    const dy = y - centerY;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    return {
      x: centerX + dx * cos - dy * sin,
      y: centerY + dx * sin + dy * cos,
    };
  };
  const rawProject = (x, y, z = 0) => ({
    x: (rotatePoint(x, y).x - rotatePoint(x, y).y) * isoX,
    y: (rotatePoint(x, y).x + rotatePoint(x, y).y) * isoY - z * isoZ,
  });
  const boundsPoints = [
    [0, 0, 0],
    [backWidth, 0, 0],
    [backWidth, maxDepth, 0],
    [0, maxDepth, 0],
    [0, 0, maxCabinetHeight],
    [backWidth, 0, maxCabinetHeight],
    [backWidth, maxDepth, maxCabinetHeight],
    [0, maxDepth, maxCabinetHeight],
  ].map(([x, y, z]) => rawProject(x, y, z));
  const minX = Math.min(...boundsPoints.map((point) => point.x));
  const maxX = Math.max(...boundsPoints.map((point) => point.x));
  const minY = Math.min(...boundsPoints.map((point) => point.y));
  const maxY = Math.max(...boundsPoints.map((point) => point.y));
  const offsetX = (viewWidth - (maxX - minX)) / 2 - minX;
  const offsetY = (viewHeight - (maxY - minY)) / 2 - minY + 8;
  const project = (x, y, z = 0) => {
    const point = rawProject(x, y, z);
    return { x: point.x + offsetX, y: point.y + offsetY };
  };
  const points = (items) => items.map(([x, y, z = 0]) => {
    const point = project(x, y, z);
    return `${point.x},${point.y}`;
  }).join(' ');
  const backStart = corners.backLeft === 'left' ? cornerStopDistance : 0;
  const leftStart = corners.backLeft === 'back' ? cornerStopDistance : 0;
  const rightStart = corners.backRight === 'back' ? cornerStopDistance : 0;
  const backSegments = getModuleSegments(runs.back, backStart);
  const leftSegments = getModuleSegments(runs.left, leftStart);
  const rightSegments = getModuleSegments(runs.right, rightStart);
  const reachZones = [
    corners.backLeft === 'back'
      ? { id: 'left-reach-3d', x: 0, y: closetDepth, width: closetDepth, depth: cornerReachGap }
      : { id: 'back-left-reach-3d', x: closetDepth, y: 0, width: cornerReachGap, depth: closetDepth },
    corners.backRight === 'back'
      ? { id: 'right-reach-3d', x: backWidth - closetDepth, y: closetDepth, width: closetDepth, depth: cornerReachGap }
      : { id: 'back-right-reach-3d', x: backWidth - closetDepth - cornerReachGap, y: 0, width: cornerReachGap, depth: closetDepth },
  ];

  const renderFloorRect = ({ id, x, y, width, depth }) => (
    <g key={id}>
      <polygon
        points={points([
          [x, y, 0.2],
          [x + width, y, 0.2],
          [x + width, y + depth, 0.2],
          [x, y + depth, 0.2],
        ])}
        className="fill-stone-300/70 stroke-stone-600"
        strokeDasharray="4 3"
      />
    </g>
  );

  const renderCabinet = ({ id, x, y, width, depth, height, actualHeight, module, wall, label, color = 'orange' }) => {
    const frontFill = color === 'orange' ? '#f6bf91' : '#f7f2eb';
    const sideFill = color === 'orange' ? '#e4a373' : '#ded8cf';
    const topFill = color === 'orange' ? '#ffe2c8' : '#ffffff';
    const labelPoint = project(x + width / 2, y + depth / 2, height + 4);
    const detailStroke = '#8b6b55';
    const hardwareStroke = '#77716a';
    const code = getWalkInLayoutCode(module, actualHeight);
    const layout = buildWalkInTowerLayout(actualHeight, code);
    const toDisplayY = (value) => (value / actualHeight) * height;
    const facePoint = (u, z) => {
      if (wall === 'left') {
        return project(x + width, y + depth * u, z);
      }
      if (wall === 'right') {
        return project(x, y + depth * (1 - u), z);
      }
      return project(x + width * u, y + depth, z);
    };
    const facePolygonPoints = () => {
      const a = facePoint(0, 0);
      const b = facePoint(1, 0);
      const c = facePoint(1, height);
      const d = facePoint(0, height);

      return `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`;
    };
    const faceLine = (u1, z1, u2, z2, stroke = detailStroke, strokeWidth = 1.2) => {
      const start = facePoint(u1, z1);
      const end = facePoint(u2, z2);

      return <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={stroke} strokeWidth={strokeWidth} />;
    };
    const faceRect = (u1, z1, u2, z2, fill = '#fff8f0', stroke = detailStroke) => {
      const a = facePoint(u1, z1);
      const b = facePoint(u2, z1);
      const c = facePoint(u2, z2);
      const d = facePoint(u1, z2);

      return <polygon points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`} fill={fill} stroke={stroke} strokeWidth="1" />;
    };
    const shelfBoard = (shelf, index) => {
      const z = toDisplayY(shelf.y);
      const halfThickness = Math.max(0.5, toDisplayY(panelThickness) / 2);

      return <g key={`shelf-${index}`}>{faceRect(0.04, z - halfThickness, 0.96, z + halfThickness, shelf.fixed ? '#fffaf0' : '#fffdf7')}</g>;
    };
    const drawerPull = (z, drawerWidth = 24) => {
      const halfPull = Math.min(0.17, (drawerPullLength / drawerWidth) / 2);
      return faceLine(0.5 - halfPull, z, 0.5 + halfPull, z, hardwareStroke, 1.6);
    };
    const rod = (z, index) => {
      const hangerCount = 3;

      return (
        <g key={`rod-${index}`}>
          {faceLine(0.14, z, 0.86, z, hardwareStroke, 2.1)}
          {Array.from({ length: hangerCount }, (_, hangerIndex) => {
            const u = 0.26 + hangerIndex * 0.24;
            const hook = facePoint(u, z - height * 0.015);
            const left = facePoint(u - 0.035, z - height * 0.09);
            const right = facePoint(u + 0.035, z - height * 0.09);

            return <polyline key={`hanger-${hangerIndex}`} points={`${hook.x},${hook.y} ${left.x},${left.y} ${right.x},${right.y} ${hook.x},${hook.y}`} fill="none" stroke={hardwareStroke} strokeWidth="0.9" />;
          })}
        </g>
      );
    };
    const renderKitDetails = () => {
      const drawerWidth = numberValue(module.width) || 24;

      return (
        <g>
          {faceRect(0.04, 0, 0.96, toDisplayY(toeKickHeight), '#e8dfd2', '#9a6a4a')}
          {layout.shelves.map(shelfBoard)}
          {layout.rods.map((item, index) => rod(toDisplayY(item.y), index))}
          {layout.drawers.map((drawer, index) => {
            const drawerBottom = toDisplayY(drawer.centerY - drawer.height / 2);
            const drawerTop = toDisplayY(drawer.centerY + drawer.height / 2);
            const overlay = Math.min(0.025, drawerSideOverlay / drawerWidth);

            return (
              <g key={`drawer-${index}`}>
                {faceRect(0.08 - overlay, drawerBottom, 0.92 + overlay, drawerTop, '#fffaf2', '#8b6b55')}
                {drawerPull(toDisplayY(drawer.centerY), drawerWidth)}
              </g>
            );
          })}
        </g>
      );
    };

    return (
      <g key={id}>
        <polygon
          points={points([
            [x + width, y, 0],
            [x + width, y + depth, 0],
            [x + width, y + depth, height],
            [x + width, y, height],
          ])}
          fill={sideFill}
          stroke="#9a6a4a"
          strokeWidth="1"
        />
        <polygon
          points={points([
            [x, y + depth, 0],
            [x + width, y + depth, 0],
            [x + width, y + depth, height],
            [x, y + depth, height],
          ])}
          fill={frontFill}
          stroke="#9a6a4a"
          strokeWidth="1"
        />
        <polygon points={facePolygonPoints()} fill={frontFill} stroke="#9a6a4a" strokeWidth="1" />
        {renderKitDetails()}
        <polygon
          points={points([
            [x, y, height],
            [x + width, y, height],
            [x + width, y + depth, height],
            [x, y + depth, height],
          ])}
          fill={topFill}
          stroke="#9a6a4a"
          strokeWidth="1"
        />
        <text x={labelPoint.x} y={labelPoint.y} textAnchor="middle" className="fill-stone-900 text-[9px] font-bold">
          {label}
        </text>
      </g>
    );
  };

  return (
    <section className="rounded border border-stone-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-bold text-stone-950">3D View</h2>
        <div className="flex items-center gap-2">
          <div className="grid grid-cols-3 rounded border border-stone-300 bg-white p-0.5 text-xs font-bold">
            <button type="button" onClick={() => onTurn?.(-90)} className="rounded px-2 py-1 text-stone-600 hover:bg-stone-100" title="Turn left">
              Left
            </button>
            <button type="button" onClick={() => onTurn?.(0, true)} className="rounded px-2 py-1 text-stone-600 hover:bg-stone-100" title="Reset view">
              Reset
            </button>
            <button type="button" onClick={() => onTurn?.(90)} className="rounded px-2 py-1 text-stone-600 hover:bg-stone-100" title="Turn right">
              Right
            </button>
          </div>
          <span className={`rounded px-2 py-1 text-xs font-bold ${evaluation.complete ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {evaluation.complete ? 'Valid' : 'Needs fixes'}
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="h-[380px] w-full rounded bg-stone-50">
        <polygon
          points={points([
            [0, 0, 0],
            [backWidth, 0, 0],
            [backWidth, maxDepth, 0],
            [0, maxDepth, 0],
          ])}
          className="fill-stone-100 stroke-stone-300"
          strokeWidth="1"
        />
        <polygon
          points={points([
            [0, 0, 0],
            [backWidth, 0, 0],
            [backWidth, 0, maxCabinetHeight],
            [0, 0, maxCabinetHeight],
          ])}
          className="fill-white/75 stroke-stone-300"
          strokeWidth="1"
        />
        <polygon
          points={points([
            [0, 0, 0],
            [0, leftDepth, 0],
            [0, leftDepth, maxCabinetHeight],
            [0, 0, maxCabinetHeight],
          ])}
          className="fill-stone-100/75 stroke-stone-300"
          strokeWidth="1"
        />
        <polygon
          points={points([
            [backWidth, 0, 0],
            [backWidth, rightDepth, 0],
            [backWidth, rightDepth, maxCabinetHeight],
            [backWidth, 0, maxCabinetHeight],
          ])}
          className="fill-stone-100/75 stroke-stone-300"
          strokeWidth="1"
        />

        {reachZones.map(renderFloorRect)}
        {leftSegments.map(({ module, start, length }) =>
          renderCabinet({
            id: `left-3d-${module.id}`,
            x: 0,
            y: start,
            width: closetDepth,
            depth: length,
            height: getDisplayHeight('left'),
            actualHeight: getWallHeight(room, 'left'),
            module,
            wall: 'left',
            label: `${module.label} ${formatInches(module.width)}`,
            color: 'stone',
          }),
        )}
        {rightSegments.map(({ module, start, length }) =>
          renderCabinet({
            id: `right-3d-${module.id}`,
            x: backWidth - closetDepth,
            y: start,
            width: closetDepth,
            depth: length,
            height: getDisplayHeight('right'),
            actualHeight: getWallHeight(room, 'right'),
            module,
            wall: 'right',
            label: `${module.label} ${formatInches(module.width)}`,
            color: 'stone',
          }),
        )}
        {backSegments.map(({ module, start, length }) =>
          renderCabinet({
            id: `back-3d-${module.id}`,
            x: start,
            y: 0,
            width: length,
            depth: closetDepth,
            height: getDisplayHeight('back'),
            actualHeight: getWallHeight(room, 'back'),
            module,
            wall: 'back',
            label: `${module.label} ${formatInches(module.width)}`,
          }),
        )}
      </svg>
      <div className="mt-2 text-xs font-bold text-stone-600">
        3D preview uses the same run lengths, corner offsets, and module order as the room plan.
      </div>
    </section>
  );
}

function ValidationPanel({ evaluation }) {
  return (
    <section className="rounded border border-stone-200 bg-white p-3">
      <h2 className="text-base font-bold text-stone-950">Validation</h2>
      <div className="mt-3 grid gap-2 text-sm font-semibold">
        {evaluation.blocking.length === 0 && <div className="rounded bg-emerald-50 px-3 py-2 text-emerald-700">All sizing and corner rules pass.</div>}
        {evaluation.blocking.map((warning) => (
          <div key={warning} className="rounded bg-red-50 px-3 py-2 text-red-700">
            {warning}
          </div>
        ))}
        {evaluation.warnings.map((warning) => (
          <div key={warning} className="rounded bg-amber-50 px-3 py-2 text-amber-700">
            {warning}
          </div>
        ))}
      </div>
    </section>
  );
}

function buildWalkInMaterials(runs) {
  const allModules = Object.values(runs).flat();

  if (!allModules.length) {
    return [];
  }

  return [
    { label: 'Vertical panels', quantity: allModules.length + Object.values(runs).filter((modules) => modules.length > 0).length },
    { label: 'Toe kicks', quantity: allModules.length },
    { label: 'Wall runs', quantity: Object.values(runs).filter((modules) => modules.length > 0).length },
    { label: 'Towers', quantity: allModules.length },
  ];
}

function buildWalkInPlanUrl(room, corners, runs) {
  if (typeof window === 'undefined') {
    return '';
  }

  const url = new URL(window.location.href);
  url.searchParams.set('type', 'walk-in');
  url.searchParams.delete('estimate');
  url.searchParams.set('plan', btoa(JSON.stringify({ room, corners, runs })));
  return url.toString();
}

function buildWalkInEstimateUrl(room, corners, runs) {
  const url = new URL(buildWalkInPlanUrl(room, corners, runs));
  url.searchParams.set('estimate', '1');
  return url.toString();
}

function navigateInsideFrame(path) {
  if (typeof window === 'undefined') return;
  window.self.location.assign(new URL(path, window.self.location.href).toString());
}

function shouldShowEstimatePage() {
  if (typeof window === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location.search).get('estimate') === '1';
}

function buildDetailedWalkInParts(room, runs) {
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

  let towerCount = 0;
  let adjustableShelfCount = 0;
  let rodCount = 0;
  let smallDrawerCount = 0;
  let largeDrawerCount = 0;

  ['back', 'left', 'right'].forEach((wall) => {
    const modules = runs[wall] || [];
    const height = getWallHeight(room, wall);

    if (!modules.length) {
      return;
    }

    towerCount += modules.length;
    add(`VL-24-${height}-W`, `Left vertical panel 24" x ${height}"`, 1, `${wallLabels[wall]} outer left side panel.`, 'Panels');
    add(`VR-24-${height}-W`, `Right vertical panel 24" x ${height}"`, 1, `${wallLabels[wall]} outer right side panel.`, 'Panels');
    add(`VD-24-${height}-W`, `Shared divider panel 24" x ${height}"`, Math.max(0, modules.length - 1), `${wallLabels[wall]} shared dividers between connected towers.`, 'Panels');

    modules.forEach((module) => {
      const code = getWalkInLayoutCode(module, height);
      const width = numberValue(module.width);
      const layout = buildWalkInTowerLayout(height, code);
      const fixedShelves = layout.shelves.filter((shelf) => shelf.fixed).length;
      const adjustableShelves = layout.shelves.length - fixedShelves;
      const rods = layout.rods.length;
      const smallDrawers = layout.drawers.filter((drawer) => drawer.height === 5).length;
      const largeDrawers = layout.drawers.filter((drawer) => drawer.height === 10).length;

      adjustableShelfCount += adjustableShelves;
      rodCount += rods;
      smallDrawerCount += smallDrawers;
      largeDrawerCount += largeDrawers;

      add(`FS-${width}-14-W`, `Fixed shelf ${width}" x 14"`, fixedShelves, `${wallLabels[wall]} ${towerNames[code] || code} structural shelves.`, 'Shelves');
      add(`SH-${width}-14-W`, `Adjustable shelf ${width}" x 14"`, adjustableShelves, `${wallLabels[wall]} ${towerNames[code] || code} movable shelves.`, 'Shelves');
      add(`TKK-${width}-5-W`, `Toe-kick kit ${width}" x 5"`, 1, `Toe-kick kit for the ${wallLabels[wall].toLowerCase()} run.`, 'Kits');
      add(`RK-${width}-S`, `Rod kit ${width}"`, rods, `${wallLabels[wall]} hanging rod kit.`, 'Kits');
    });
  });

  add('DRK-24-5-13-W', 'Small drawer kit 24" x 5" x 13"', smallDrawerCount, 'Complete drawer kit with panels, rails, screws, and centered bar pull.', 'Kits');
  add('DRK-24-10-13-W', 'Large drawer kit 24" x 10" x 13"', largeDrawerCount, 'Complete drawer kit with panels, rails, screws, and centered bar pull.', 'Kits');
  add('RDB-S-1', 'Rod bracket set, pair', rodCount, `${rodCount * 2} individual brackets total; one pair per rod.`, 'Hardware');
  const wallBracketCount = towerCount * 2;
  add('WLB-S-1', 'Wall L-bracket', wallBracketCount, 'Two wall safety brackets per tower section.', 'Hardware');
  add('PIN-20-S', 'Shelf pin pack, 20 pins', Math.ceil((adjustableShelfCount * 4) / 20), `${adjustableShelfCount * 4} shelf pins required for ${adjustableShelfCount} adjustable shelves.`, 'Hardware');
  add('CAMKIT-10-W', 'Rafix/cam lock and screw kit, 10 pieces', towerCount, `${towerCount * 8} Rafix/bolt connector positions required; one 10-piece kit packed per tower.`, 'Hardware');
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

function getRequestedWalkInPlan() {
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

function WalkInEstimatePage({ room, corners, runs, evaluation, pricing }) {
  const [previewMode, setPreviewMode] = useState('plan');
  const [customer, setCustomer] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [submitStatus, setSubmitStatus] = useState({ state: 'idle', message: '' });
  const parts = useMemo(() => buildDetailedWalkInParts(room, runs), [room, runs]);
  const planUrl = useMemo(() => buildWalkInPlanUrl(room, corners, runs), [room, corners, runs]);
  const submitForVerification = async (event) => {
    event.preventDefault();
    setSubmitStatus({ state: 'loading', message: 'Saving plan to your account...' });

    try {
      const modules = Object.entries(runs).flatMap(([wall, wallModules]) =>
        wallModules.map((module, index) => ({
          wall,
          index,
          code: getWalkInProductCode(module, getWallHeight(room, wall)),
          width: module.width,
          label: module.label,
        })),
      );
      const response = await fetch('/api/quote-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planType: 'walk-in',
          customer,
          room,
          corners,
          runs,
          materials: parts.map(({ category, sku, name, quantity }) => ({ category, sku, name, quantity })),
          modules,
          estimatedPrice: pricing.estimatedPrice,
          signature: pricing.signature,
          planUrl,
          wallSummaries: pricing.wallSummaries,
          internalType: 'walk-in estimate verification',
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
    <main className="print-flow h-screen overflow-y-auto bg-brand-ui p-2 text-brand-black sm:p-4">
      <div className="mx-auto grid max-w-6xl gap-4">
        <PrintablePlanReference quoteId={submitStatus.quoteId} planType="Walk-in saved plan" />
        <header className="rounded border border-stone-200 bg-white p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-brand-orange">Closets Warehouse</p>
              <h1 className="text-xl font-bold text-stone-950 sm:text-2xl">Walk-in Estimate Detail</h1>
              <p className="mt-1 text-sm font-semibold text-stone-600">Saved room plan, visual review, and exact build parts for verification.</p>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-xs font-bold uppercase text-stone-500">Estimated price</div>
              <div className="text-2xl font-bold text-stone-950">{money(pricing.estimatedPrice) || '$0.00'}</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={planUrl} className="rounded bg-brand-orange px-3 py-2 text-sm font-bold text-white hover:bg-orange-700">Open editable plan</a>
            <a href="/walkin.html?type=walk-in" className="rounded border border-stone-300 px-3 py-2 text-sm font-bold text-stone-700 hover:bg-stone-50">Start new walk-in</a>
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
                <TopDownPlan room={room} runs={runs} corners={corners} evaluation={evaluation} />
              ) : (
                <WalkIn3DPreview room={room} runs={runs} corners={corners} evaluation={evaluation} />
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
                  <button type="submit" disabled={submitStatus.state === 'loading'} className="mt-3 w-full rounded bg-stone-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
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
              <h2 className="text-base font-bold text-stone-950">Room</h2>
              <p className="mt-1 text-xs font-semibold text-stone-500">
                Back-left: {corners.backLeft === 'back' ? 'back wall wins' : 'left wall wins'} / Back-right: {corners.backRight === 'back' ? 'back wall wins' : 'right wall wins'}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <dt className="font-semibold text-stone-500">Back</dt>
                <dd className="text-right font-bold">{formatInches(room.backWidth)}</dd>
                <dt className="font-semibold text-stone-500">Left</dt>
                <dd className="text-right font-bold">{formatInches(room.leftDepth)}</dd>
                <dt className="font-semibold text-stone-500">Right</dt>
                <dd className="text-right font-bold">{formatInches(room.rightDepth)}</dd>
                <dt className="font-semibold text-stone-500">Opening</dt>
                <dd className="text-right font-bold">{formatInches(room.openingWidth)}</dd>
              </dl>
            </section>
            <section className="rounded border border-stone-200 bg-white p-4">
              <h2 className="text-base font-bold text-stone-950">Wall Runs</h2>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {Object.entries(evaluation.runLengths).map(([wall, length]) => (
                  <React.Fragment key={wall}>
                    <dt className="font-semibold text-stone-500">{wallLabels[wall]}</dt>
                    <dd className="text-right font-bold text-stone-950">{formatInches(length)} / {formatInches(getWallHeight(room, wall))}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </section>
            <section className="rounded border border-stone-200 bg-white p-4">
              <h2 className="text-base font-bold text-stone-950">Configurations</h2>
              <div className="mt-2 grid gap-2 text-sm font-semibold text-stone-700">
                {['back', 'left', 'right'].map((wall) => (
                  <div key={wall} className="rounded bg-stone-50 px-2 py-1.5">
                    <div className="font-bold text-stone-950">{wallLabels[wall]}</div>
                    <div>{runs[wall].length ? runs[wall].map((module) => `${getWalkInLayoutCode(module, getWallHeight(room, wall))} ${module.width}"`).join(', ') : '-'}</div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function SummaryPanel({ room, corners, runs, evaluation, pricing }) {
  const [showForm, setShowForm] = useState(false);
  const [customer, setCustomer] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [submitStatus, setSubmitStatus] = useState({ state: 'idle', message: '' });
  const materials = useMemo(() => buildWalkInMaterials(runs), [runs]);
  const wallProductMatches = pricing.wallSummaries.filter((summary) => summary.match);
  const shouldShowProductLinks = evaluation.complete && pricing.allThreeWallsMatched;

  const submitForVerification = async (event) => {
    event.preventDefault();
    setSubmitStatus({ state: 'loading', message: 'Submitting for verification...' });

    try {
      const modules = Object.entries(runs).flatMap(([wall, wallModules]) =>
        wallModules.map((module, index) => ({
          wall,
          index,
          code: getWalkInProductCode(module, getWallHeight(room, wall)),
          width: module.width,
          label: module.label,
        })),
      );
      const response = await fetch('/api/quote-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planType: 'walk-in',
          customer,
          room,
          corners,
          runs,
          materials,
          modules,
          estimatedPrice: pricing.estimatedPrice,
          signature: pricing.signature,
          planUrl: buildWalkInPlanUrl(room, corners, runs),
          wallSummaries: pricing.wallSummaries,
          internalType: 'walk-in estimate verification',
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
    <section className="rounded border border-stone-200 bg-white p-3">
      <h2 className="text-base font-bold text-stone-950">Price & Next Step</h2>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {Object.entries(evaluation.runLengths).map(([wall, length]) => (
          <React.Fragment key={wall}>
            <dt className="font-semibold text-stone-500">{wallLabels[wall]}</dt>
            <dd className="text-right font-bold text-stone-950">{formatInches(length)} / {formatInches(getWallHeight(room, wall))}</dd>
          </React.Fragment>
        ))}
      </dl>

      {shouldShowProductLinks && (
        <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-xs font-bold uppercase text-emerald-700">Existing products found</div>
          <p className="mt-1 text-sm font-semibold text-stone-700">All three wall runs match products. Use these product pages for checkout.</p>
          <div className="mt-3 grid gap-2">
            {wallProductMatches.map((summary) => (
              <a key={summary.wall} href={summary.match.productUrl} className="rounded bg-brand-orange px-3 py-2 text-sm font-bold text-white hover:bg-orange-700">
                {wallLabels[summary.wall]}: {summary.match.title} {summary.match.price > 0 ? `- ${money(summary.match.price)}` : ''}
              </a>
            ))}
            <button
              type="button"
              onClick={() => navigateInsideFrame(buildWalkInEstimateUrl(room, corners, runs))}
              className="rounded bg-stone-950 px-3 py-2 text-sm font-bold text-white"
            >
              Verify estimate
            </button>
          </div>
        </div>
      )}

      {!shouldShowProductLinks && (
        <div className="mt-3 rounded border border-stone-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold uppercase text-stone-500">Estimated walk-in price</div>
              <div className="text-xl font-bold text-stone-950">{money(pricing.estimatedPrice) || '$0.00'}</div>
            </div>
            <button
              type="button"
              disabled={!evaluation.complete}
              onClick={() => navigateInsideFrame(buildWalkInEstimateUrl(room, corners, runs))}
              className="rounded bg-stone-950 px-3 py-2 text-sm font-bold text-white disabled:bg-stone-300"
            >
              Verify estimate
            </button>
          </div>
          <div className="mt-3 grid gap-1 text-xs">
            {pricing.wallSummaries.map((summary) => (
              <div key={summary.wall} className="flex justify-between rounded bg-stone-50 px-2 py-1.5">
                <span className="font-semibold text-stone-600">{wallLabels[summary.wall]}</span>
                <span className="font-bold text-stone-950">{summary.modules.length ? money(summary.estimate) : '-'}</span>
              </div>
            ))}
          </div>

          {showForm && (
            <form className="mt-3 grid gap-2" onSubmit={submitForVerification}>
              {submitStatus.state === 'success' ? (
                <SavedPlanActions quoteId={submitStatus.quoteId} />
              ) : (
                <>
                  <input type="text" value={customer.firstName} onChange={(event) => setCustomer((current) => ({ ...current, firstName: event.target.value }))} placeholder="First name" className="rounded border border-stone-300 px-2 py-1.5 text-sm font-semibold" required />
                  <input type="text" value={customer.lastName} onChange={(event) => setCustomer((current) => ({ ...current, lastName: event.target.value }))} placeholder="Last name" className="rounded border border-stone-300 px-2 py-1.5 text-sm font-semibold" required />
                  <input type="email" value={customer.email} onChange={(event) => setCustomer((current) => ({ ...current, email: event.target.value }))} placeholder="Email" className="rounded border border-stone-300 px-2 py-1.5 text-sm font-semibold" required />
                  <input type="tel" value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone" className="rounded border border-stone-300 px-2 py-1.5 text-sm font-semibold" required />
                  <button type="submit" disabled={submitStatus.state === 'loading'} className="rounded bg-brand-orange px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                    Verify estimate
                  </button>
                </>
              )}
              {submitStatus.state === 'error' && submitStatus.message && (
                <p className={`rounded px-2 py-1.5 text-xs font-bold ${submitStatus.state === 'error' ? 'bg-red-100 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {submitStatus.message}
                </p>
              )}
            </form>
          )}
        </div>
      )}
    </section>
  );
}

function WalkInPlanner() {
  const requestedPlan = useMemo(() => getRequestedWalkInPlan(), []);
  const requestedEstimatePage = useMemo(shouldShowEstimatePage, []);
  const defaultRoom = {
    backWidth: 96,
    leftDepth: 72,
    rightDepth: 72,
    openingWidth: 30,
    openingLeft: 33,
    openingRight: 33,
    ceilingHeight: 108,
    backHeight: 96,
    leftHeight: 96,
    rightHeight: 96,
  };
  const [room, setRoom] = useState({ ...defaultRoom, ...(requestedPlan?.room || {}) });
  const [corners, setCorners] = useState(requestedPlan?.corners || { backLeft: 'back', backRight: 'back' });
  const [viewMode, setViewMode] = useState('plan');
  const [roomCaptured, setRoomCaptured] = useState(Boolean(requestedPlan));
  const [runs, setRuns] = useState(requestedPlan?.runs || {
    back: [],
    left: [],
    right: [],
  });
  const [productCatalog, setProductCatalog] = useState([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const evaluation = useMemo(() => evaluatePlan(room, corners, runs), [room, corners, runs]);
  const roomEvaluation = useMemo(() => evaluateRoomStep(room), [room]);
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
  const pricing = useMemo(() => {
    const wallSummaries = ['back', 'left', 'right'].map((wall) => {
      const modules = runs[wall] || [];
      const height = getWallHeight(room, wall);
      const towerSpecs = getWallTowerSpecs(room, wall, modules);
      const signature = modules.length ? buildMatchSignature(height, towerSpecs) : '';
      const match = signature ? productBySignature.get(signature) || null : null;
      const estimate = match?.price || calculateWallEstimate(modules, height, productCatalog);

      return {
        wall,
        height,
        modules,
        towerSpecs,
        signature,
        match,
        estimate,
      };
    });
    const allThreeWallsMatched = wallSummaries.every((summary) => summary.modules.length > 0 && summary.match?.productUrl);
    const estimatedPrice = Number(wallSummaries.reduce((total, summary) => total + (summary.match?.price || summary.estimate || 0), 0).toFixed(2));

    return {
      wallSummaries,
      allThreeWallsMatched,
      estimatedPrice,
      signature: wallSummaries.map((summary) => `${summary.wall}:${summary.signature || 'empty'}`).join('|'),
    };
  }, [productCatalog, productBySignature, room, runs]);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        const response = await fetch('/api/kits');
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Unable to load product catalog');
        }

        const products = (payload.records || []).map(kitRecordToProduct).filter(Boolean);

        if (!cancelled) {
          setProductCatalog(products);
          setCatalogReady(true);
        }
      } catch {
        if (!cancelled) {
          setProductCatalog([]);
          setCatalogReady(true);
        }
      }
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  if (requestedEstimatePage && requestedPlan) {
    return (
      <WalkInEstimatePage
        room={room}
        corners={corners}
        runs={runs}
        evaluation={evaluation}
        pricing={pricing}
      />
    );
  }

  const addModule = (code, wall = 'back') => {
    setRuns((current) => ({
      ...current,
      [wall]: [...current[wall], createModule(code)],
    }));
  };

  const removeModule = (wall, id) => {
    setRuns((current) => ({
      ...current,
      [wall]: current[wall].filter((module) => module.id !== id),
    }));
  };

  const updateWidth = (wall, id, width) => {
    const nextWidth = allowedModuleWidths.includes(Number(width)) ? Number(width) : 24;
    setRuns((current) => ({
      ...current,
      [wall]: current[wall].map((module) => (module.id === id ? { ...module, width: nextWidth } : module)),
    }));
  };

  const moveModule = (wall, index, direction) => {
    setRuns((current) => {
      const nextIndex = index + direction;
      const wallModules = current[wall];

      if (nextIndex < 0 || nextIndex >= wallModules.length) {
        return current;
      }

      const nextWallModules = [...wallModules];
      const [module] = nextWallModules.splice(index, 1);
      nextWallModules.splice(nextIndex, 0, module);

      return {
        ...current,
        [wall]: nextWallModules,
      };
    });
  };

  if (!roomCaptured) {
    return (
      <RoomCaptureStep
        room={room}
        setRoom={setRoom}
        corners={corners}
        setCorners={setCorners}
        roomEvaluation={roomEvaluation}
        onContinue={() => setRoomCaptured(true)}
      />
    );
  }

  return (
    <main className="app-shell bg-brand-ui text-brand-black">
      <header className="flex min-h-16 items-center justify-between gap-3 border-b border-stone-200 bg-white px-3 py-2 sm:px-4">
        <div>
          <h1 className="text-lg font-bold text-stone-950">Walk-in Shape Planner</h1>
          <p className="text-xs font-semibold text-stone-500">Left, back, and right wall layout</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <ConsultationCta compact />
        </div>
      </header>
      <section className="app-workspace grid min-w-0 gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 bg-white p-3 pr-6 sm:p-4 sm:pr-6 lg:min-h-0 lg:overflow-y-auto lg:pr-4">
          <div className="mb-3 flex items-center justify-end gap-2">
            {[
              ['plan', 'Plan view'],
              ['3d', 'View in 3D'],
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                aria-pressed={viewMode === mode}
                className={`rounded border px-3 py-2 text-sm font-bold ${
                  viewMode === mode ? 'border-brand-orange bg-orange-50 text-brand-orange' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {viewMode === 'plan' ? (
            <TopDownPlan room={room} runs={runs} corners={corners} evaluation={evaluation} />
          ) : (
            <WalkIn3DPreview room={room} runs={runs} corners={corners} evaluation={evaluation} />
          )}
          <section className="mt-4 min-w-0 rounded border border-stone-200 bg-stone-50 p-3 pr-4 sm:p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-stone-950">Wall Configurations</h2>
            </div>
            <div className="grid gap-3">
              {['back', 'left', 'right'].map((wall) => (
                <WallRunEditor
                  key={wall}
                  wall={wall}
                  wallHeight={getWallHeight(room, wall)}
                  usableLength={evaluation.usable[wall]}
                  rawLength={wall === 'back' ? room.backWidth : wall === 'left' ? room.leftDepth : room.rightDepth}
                  modules={runs[wall]}
                  onAdd={addModule}
                  onDropModule={addModule}
                  onRemove={removeModule}
                  onMove={moveModule}
                  onWidthChange={updateWidth}
                />
              ))}
            </div>
          </section>
        </section>
        <aside className="min-w-0 border-t border-stone-200 bg-stone-50 p-3 pr-6 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:pr-3">
          <div className="space-y-3">
            <RoomSummaryBar compact room={room} corners={corners} onEdit={() => setRoomCaptured(false)} />
            <ValidationPanel evaluation={evaluation} />
            <SummaryPanel room={room} corners={corners} runs={runs} evaluation={evaluation} pricing={pricing} isCatalogReady={catalogReady} />
          </div>
        </aside>
      </section>
    </main>
  );
}

function ShapePlannerApp() {
  const requestedType = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('type');
  const [closetType, setClosetType] = useState(requestedType === 'reach-in' ? '' : 'walk-in');

  if (closetType !== 'walk-in') {
    return <ClosetTypeStart onWalkIn={() => setClosetType('walk-in')} />;
  }

  return <WalkInPlanner />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ShapePlannerApp />
  </React.StrictMode>,
);
