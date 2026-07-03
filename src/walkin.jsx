import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Edges, OrbitControls } from '@react-three/drei';
import './styles.css';

const panelThickness = 0.75;
const closetDepth = 14;
const cornerReachGap = 12;
const cornerStopDistance = closetDepth + cornerReachGap;
const closetHeights = [84, 96];
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

const moduleConfigs = [
  { code: 'LH', label: 'Long Hang', defaultWidth: 24 },
  { code: 'DH', label: 'Double Hang', defaultWidth: 24 },
  { code: 'HS', label: 'Hang + Shelves', defaultWidth: 24 },
  { code: 'S3D', label: 'Shelves + 3 Drawers', defaultWidth: 24 },
  { code: 'H3D', label: 'Hang + 3 Drawers', defaultWidth: 24 },
  { code: 'S2D', label: 'Shelves + 2 Drawers', defaultWidth: 24 },
  { code: 'SHELF', label: 'Shelf Tower', defaultWidth: 24 },
];

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
    width: config.defaultWidth,
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

function evaluatePlan(room, corners, runs) {
  const backWidth = numberValue(room.backWidth);
  const leftDepth = numberValue(room.leftDepth);
  const rightDepth = numberValue(room.rightDepth);
  const openingWidth = numberValue(room.openingWidth);
  const openingLeft = numberValue(room.openingLeft);
  const openingRight = numberValue(room.openingRight);
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
      if (width < 18 || width > 30) {
        blocking.push(`${module.label} width must stay between 18" and 30".`);
      }
      if (!Number.isInteger(width)) {
        warnings.push(`${module.label} ${formatInches(width)} is custom and should be reviewed before production.`);
      }
    });

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
      <h2 className="text-base font-bold text-stone-950">Room</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {[
          ['backWidth', 'Back wall'],
          ['leftDepth', 'Left wall'],
          ['rightDepth', 'Right wall'],
          ['openingWidth', 'Opening'],
          ['openingLeft', 'Left of opening'],
          ['openingRight', 'Right of opening'],
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
        <h3 className="text-xs font-bold uppercase text-stone-500">Closet Height</h3>
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
        <h3 className="text-xs font-bold uppercase text-stone-500">Corner Priority</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <CornerToggle
            label="Back-left corner"
            value={corners.backLeft}
            sideLabel="Left wall wins"
            onChange={(value) => updateCorner('backLeft', value)}
            sideValue="left"
          />
          <CornerToggle
            label="Back-right corner"
            value={corners.backRight}
            sideLabel="Right wall wins"
            onChange={(value) => updateCorner('backRight', value)}
            sideValue="right"
          />
        </div>
      </div>
    </section>
  );
}

function CornerToggle({ label, value, onChange, sideLabel, sideValue }) {
  return (
    <div className="rounded border border-stone-200 p-2">
      <div className="mb-2 text-xs font-bold text-stone-600">{label}</div>
      <div className="grid grid-cols-2 rounded border border-stone-300 bg-white p-0.5 text-xs font-bold">
        {[
          ['back', 'Back wall wins'],
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
    </div>
  );
}

function RoomCaptureStep({ room, setRoom, corners, setCorners, roomEvaluation, onContinue }) {
  return (
    <main className="h-screen bg-brand-ui text-brand-black">
      <header className="flex h-16 items-center justify-between border-b border-stone-200 bg-white px-4">
        <div>
          <h1 className="text-lg font-bold text-stone-950">Walk-in Shape Planner</h1>
          <p className="text-xs font-semibold text-stone-500">Step 1: room dimensions</p>
        </div>
        <a href="/" className="rounded border border-stone-300 px-3 py-2 text-sm font-bold text-stone-700">
          Reach-in app
        </a>
      </header>
      <section className="mx-auto grid max-w-5xl gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <RoomSetup room={room} setRoom={setRoom} corners={corners} setCorners={setCorners} />
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
        <h1 className="mt-1 text-3xl font-bold text-stone-950">Closet Shape Planner</h1>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a href="/" className="rounded border border-stone-300 p-4 transition hover:border-brand-orange hover:bg-orange-50">
            <div className="text-lg font-bold text-stone-950">Reach-in closet</div>
            <div className="mt-2 text-sm font-semibold text-stone-500">Use the current straight-wall planner.</div>
          </a>
          <button type="button" onClick={onWalkIn} className="rounded border border-brand-orange bg-orange-50 p-4 text-left transition hover:bg-orange-100">
            <div className="text-lg font-bold text-stone-950">Walk-in closet</div>
            <div className="mt-2 text-sm font-semibold text-stone-600">Plan left, back, and right wall runs with corner and entrance rules.</div>
          </button>
        </div>
      </section>
    </main>
  );
}

function ModulePalette({ onAdd, compact = false }) {
  return (
    <section className="rounded border border-stone-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-stone-950">Configurations</h2>
        {compact && <span className="text-xs font-bold text-stone-500">Click to add to selected wall or drag into a wall run</span>}
      </div>
      <div className={`mt-3 grid gap-2 ${compact ? 'sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7' : ''}`}>
        {moduleConfigs.map((config) => (
          <button
            key={config.code}
            type="button"
            draggable
            onDragStart={(event) => event.dataTransfer.setData('text/plain', config.code)}
            onClick={() => onAdd(config.code)}
            className="rounded border border-stone-200 bg-stone-50 px-3 py-2 text-left transition hover:border-brand-orange hover:bg-orange-50"
          >
            <div className="text-sm font-bold text-stone-950">{config.label}</div>
            <div className="text-xs font-semibold text-stone-500">{config.defaultWidth}" default bay</div>
          </button>
        ))}
      </div>
    </section>
  );
}

function WallRunEditor({ wall, modules, selected, onSelect, onDropModule, onRemove, onMove, onWidthChange }) {
  const moveLabels =
    wall === 'back'
      ? { previous: '<', next: '>', previousTitle: 'Move left', nextTitle: 'Move right' }
      : { previous: 'Up', next: 'Dn', previousTitle: 'Move up', nextTitle: 'Move down' };

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
      className={`rounded border p-3 ${selected ? 'border-brand-orange bg-orange-50' : 'border-stone-200 bg-white'}`}
    >
      <button type="button" onClick={() => onSelect(wall)} className="mb-3 flex w-full items-center justify-between text-left">
        <span className="text-base font-bold text-stone-950">{wallLabels[wall]}</span>
        <span className="rounded bg-white px-2 py-1 text-xs font-bold text-stone-500">{formatInches(getRunLength(modules))}</span>
      </button>
      <div className="space-y-2">
        {modules.length === 0 && <div className="rounded border border-dashed border-stone-300 p-4 text-center text-sm font-semibold text-stone-400">Drop towers here</div>}
        {modules.map((module, index) => (
          <article key={module.id} className="grid grid-cols-[1fr_84px_62px_32px] items-center gap-2 rounded border border-stone-200 bg-white p-2">
            <div>
              <div className="text-sm font-bold text-stone-950">{index + 1}. {module.label}</div>
              <div className="text-xs font-semibold text-stone-500">{module.code} / {formatInches(module.width)}</div>
            </div>
            <label className="flex items-center gap-1">
              <input
                type="number"
                min="18"
                max="30"
                step="1"
                value={module.width}
                onChange={(event) => onWidthChange(wall, module.id, Number(event.target.value))}
                className="w-full rounded border border-stone-300 px-2 py-1 text-sm font-bold"
              />
              <span className="text-xs font-bold text-stone-500">in</span>
            </label>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => onMove(wall, index, -1)}
                disabled={index === 0}
                className="grid h-8 place-items-center rounded border border-stone-300 text-xs font-bold text-stone-600 disabled:opacity-30"
                title={moveLabels.previousTitle}
              >
                {moveLabels.previous}
              </button>
              <button
                type="button"
                onClick={() => onMove(wall, index, 1)}
                disabled={index === modules.length - 1}
                className="grid h-8 place-items-center rounded border border-stone-300 text-xs font-bold text-stone-600 disabled:opacity-30"
                title={moveLabels.nextTitle}
              >
                {moveLabels.next}
              </button>
            </div>
            <button type="button" onClick={() => onRemove(wall, module.id)} className="grid h-8 place-items-center rounded border border-stone-300 text-sm font-bold text-stone-500">
              X
            </button>
          </article>
        ))}
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

function getShelfCodeForHeight(height) {
  return Number(height) >= 96 ? 'S8' : 'S7';
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
  const padding = 28;
  const viewWidth = 520;
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
            <text x={toX(center)} y={toY(closetDepth / 2) + 3} textAnchor="middle" className="fill-stone-900 text-[10px] font-bold">
              {module.code} {formatInches(module.width)}
            </text>
          </g>
        ))}
        {leftSegments.map(({ module, start, length, center }, index) => (
          <g key={`left-segment-${module.id}`}>
            <rect x={toX(1.6)} y={toY(start)} width={(closetDepth - 3.2) * scale} height={length * scale} className={index % 2 ? 'fill-stone-200 stroke-stone-700' : 'fill-white stroke-stone-700'} />
            <text x={toX(closetDepth / 2)} y={toY(center) + 3} textAnchor="middle" className="fill-stone-900 text-[9px] font-bold" transform={`rotate(-90 ${toX(closetDepth / 2)} ${toY(center)})`}>
              {module.code} {formatInches(module.width)}
            </text>
          </g>
        ))}
        {rightSegments.map(({ module, start, length, center }, index) => (
          <g key={`right-segment-${module.id}`}>
            <rect x={toX(backWidth - closetDepth + 1.6)} y={toY(start)} width={(closetDepth - 3.2) * scale} height={length * scale} className={index % 2 ? 'fill-stone-200 stroke-stone-700' : 'fill-white stroke-stone-700'} />
            <text x={toX(backWidth - closetDepth / 2)} y={toY(center) + 3} textAnchor="middle" className="fill-stone-900 text-[9px] font-bold" transform={`rotate(90 ${toX(backWidth - closetDepth / 2)} ${toY(center)})`}>
              {module.code} {formatInches(module.width)}
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
            <text x={toX(zone.labelX)} y={toY(zone.labelY) + 3} textAnchor="middle" className="fill-stone-700 text-[9px] font-bold">
              14x12 reach
            </text>
          </g>
        ))}

        <text x={toX(backWidth / 2)} y={toY(0) - 9} textAnchor="middle" className="fill-stone-700 text-[11px] font-bold">
          Back {formatInches(backWidth)}
        </text>
        <text x={toX(openingLeft + openingWidth / 2)} y={toY(maxDepth) + 18} textAnchor="middle" className="fill-stone-600 text-[11px] font-bold">
          Opening {formatInches(openingWidth)}
        </text>
        <text x={toX(8)} y={toY(leftDepth / 2)} className="fill-stone-700 text-[11px] font-bold" transform={`rotate(-90 ${toX(8)} ${toY(leftDepth / 2)})`}>
          Left {formatInches(leftDepth)}
        </text>
        <text x={toX(backWidth - 8)} y={toY(rightDepth / 2)} className="fill-stone-700 text-[11px] font-bold" transform={`rotate(90 ${toX(backWidth - 8)} ${toY(rightDepth / 2)})`}>
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
            label: `${getWalkInLayoutCode(module, getWallHeight(room, 'left'))} ${formatInches(module.width)}`,
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
            label: `${getWalkInLayoutCode(module, getWallHeight(room, 'right'))} ${formatInches(module.width)}`,
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
            label: `${getWalkInLayoutCode(module, getWallHeight(room, 'back'))} ${formatInches(module.width)}`,
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

function SummaryPanel({ room, runs, evaluation }) {
  const [done, setDone] = useState(false);

  return (
    <section className="rounded border border-stone-200 bg-white p-3">
      <h2 className="text-base font-bold text-stone-950">Complete</h2>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {Object.entries(evaluation.runLengths).map(([wall, length]) => (
          <React.Fragment key={wall}>
            <dt className="font-semibold text-stone-500">{wallLabels[wall]}</dt>
            <dd className="text-right font-bold text-stone-950">{formatInches(length)} / {formatInches(getWallHeight(room, wall))}</dd>
          </React.Fragment>
        ))}
      </dl>
      <button
        type="button"
        disabled={!evaluation.complete}
        onClick={() => setDone(true)}
        className="mt-4 w-full rounded bg-stone-950 px-4 py-2 text-sm font-bold text-white disabled:bg-stone-300"
      >
        Complete design
      </button>
      {done && <p className="mt-2 rounded bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">Walk-in layout is ready for review.</p>}
    </section>
  );
}

function WalkInPlanner() {
  const [room, setRoom] = useState({
    backWidth: 96,
    leftDepth: 72,
    rightDepth: 72,
    openingWidth: 30,
    openingLeft: 33,
    openingRight: 33,
    backHeight: 96,
    leftHeight: 96,
    rightHeight: 96,
  });
  const [corners, setCorners] = useState({ backLeft: 'back', backRight: 'back' });
  const [selectedWall, setSelectedWall] = useState('back');
  const [viewMode, setViewMode] = useState('plan');
  const [roomCaptured, setRoomCaptured] = useState(false);
  const [runs, setRuns] = useState({
    back: [],
    left: [],
    right: [],
  });
  const evaluation = useMemo(() => evaluatePlan(room, corners, runs), [room, corners, runs]);
  const roomEvaluation = useMemo(() => evaluateRoomStep(room), [room]);

  const addModule = (code, wall = selectedWall) => {
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
    setRuns((current) => ({
      ...current,
      [wall]: current[wall].map((module) => (module.id === id ? { ...module, width } : module)),
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
    <main className="h-screen bg-brand-ui text-brand-black">
      <header className="flex h-16 items-center justify-between border-b border-stone-200 bg-white px-4">
        <div>
          <h1 className="text-lg font-bold text-stone-950">Walk-in Shape Planner</h1>
          <p className="text-xs font-semibold text-stone-500">Left, back, and right wall layout</p>
        </div>
        <a href="/" className="rounded border border-stone-300 px-3 py-2 text-sm font-bold text-stone-700">
          Reach-in app
        </a>
      </header>
      <section className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]" style={{ height: 'calc(100vh - 4rem)' }}>
        <section className="min-h-0 overflow-y-auto bg-white p-4">
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
          <div className="mt-4 grid gap-3 md:grid-cols-[240px_minmax(0,1fr)]">
            <ModulePalette onAdd={(code) => addModule(code)} />
            <section className="rounded border border-stone-200 bg-stone-50 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-stone-950">Wall Locations</h2>
                <span className="text-xs font-bold text-stone-500">Select a wall, then add or drop configurations</span>
              </div>
              <div className="grid gap-3">
                {['back', 'left', 'right'].map((wall) => (
                  <WallRunEditor
                    key={wall}
                    wall={wall}
                    modules={runs[wall]}
                    selected={selectedWall === wall}
                    onSelect={setSelectedWall}
                    onDropModule={addModule}
                    onRemove={removeModule}
                    onMove={moveModule}
                    onWidthChange={updateWidth}
                  />
                ))}
              </div>
            </section>
          </div>
        </section>
        <aside className="min-h-0 overflow-y-auto border-l border-stone-200 bg-stone-50 p-3">
          <div className="space-y-3">
            <RoomSummaryBar compact room={room} corners={corners} onEdit={() => setRoomCaptured(false)} />
            <ValidationPanel evaluation={evaluation} />
            <SummaryPanel room={room} runs={runs} evaluation={evaluation} />
          </div>
        </aside>
      </section>
    </main>
  );
}

function ShapePlannerApp() {
  const requestedType = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('type');
  const [closetType, setClosetType] = useState(requestedType === 'walk-in' ? 'walk-in' : '');

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
