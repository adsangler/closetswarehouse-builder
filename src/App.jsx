import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Edges, OrbitControls } from '@react-three/drei';
import { PCFSoftShadowMap } from 'three';

const fallbackKit = {
  handle: 'H3D-S8-51-96-14-W',
  title: 'K12-K14 Hang & Drawers + 8-Shelf',
  kitId: 'K12-K14',
  height: 96,
  assembledWidth: 50.25,
  towerSpecs: [
    { code: 'H3D', width: 24, label: 'K12 H3D' },
    { code: 'S8', width: 24, label: 'K14 S8' },
  ],
};

const depth = 14;
const panelThickness = 0.75;
const toeKickHeight = 5;
const toeKickDepth = 5;
const drawerSideOverlay = panelThickness / 2 - 1 / 16;
const drawerPullLength = 5;
const drawerPullHeight = 0.5;
const drawerPullProjection = 1.4;
const frontDrillLineInsetX = 0.75;
const frontDrillLineZ = depth / 2 + 0.06;
const shelfPinStartY = 9;
const shelfPinSpacingY = 2.1;
const shelfOnlyAdjustableShelfCounts = {
  S7: 6,
  S8: 7,
  S9: 7,
};

function nearestDrillHoleY(y) {
  return shelfPinStartY + Math.round((y - shelfPinStartY) / shelfPinSpacingY) * shelfPinSpacingY;
}
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
const photoPanelMaterial = {
  color: '#fffefa',
  roughness: 0.56,
  metalness: 0,
};
const photoDrawerMaterial = {
  color: '#fffdf8',
  roughness: 0.5,
  metalness: 0,
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

const towerCodePattern = /^(LH|DH|HS|S3D|H3D|S2D|S7|S8|S9)$/;
const widthTokenPattern = /^(18|24|30)$/;

function normalizeHandle(value) {
  return String(value || '').toUpperCase();
}

function formatTowerTitle(towerSpecs) {
  const systemType = towerSpecs.length === 2 ? 'Double Tower' : `${towerSpecs.length}-Tower`;

  return `${towerSpecs
    .map((tower) => `${towerNames[tower.code] || tower.code}${tower.width === 24 ? '' : ` (${tower.width}")`}`)
    .join(' + ')} ${systemType}`;
}

function parseConnectedTowerSku(sku) {
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
    const width = widthTokenPattern.test(nextToken) ? Number(nextToken) : 24;

    if (widthTokenPattern.test(nextToken)) {
      index += 1;
    }

    towerSpecs.push({
      code: token === 'S9' ? 'S8' : token,
      sourceCode: token,
      width,
      label: `${token} ${width}"`,
    });
  }

  return towerSpecs.length >= 2 ? towerSpecs : null;
}

function kitRecordToDrawing(record) {
  const fields = record.fields;
  const sku = fields.shopify_sku || fields['Kit Name'];
  const towerSpecs = parseConnectedTowerSku(sku);

  if (!towerSpecs) {
    return null;
  }

  return {
    handle: sku,
    title: formatTowerTitle(towerSpecs),
    kitId: fields.KitID || record.id,
    height: Number(fields.Height) || 84,
    assembledWidth: Number(fields.Width) || towerSpecs.reduce((total, tower) => total + tower.width, panelThickness),
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
    toeKickDepth,
    towers,
    panelXs: [0, ...towers.slice(1).map((tower) => tower.bayX - panelThickness), baseDrawing.assembledWidth - panelThickness],
    sceneCenterX: baseDrawing.assembledWidth / 2,
  };
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
      { label: 'Small drawer', centerY: 43.2, height: 5.6 },
      { label: 'Small drawer', centerY: 37.4, height: 5.6 },
    ];
  }

  return [
    { label: 'Small drawer', centerY: 43.2, height: 5.6 },
    { label: 'Small drawer', centerY: 37.4, height: 5.6 },
    { label: 'Large drawer', centerY: 29.05, height: 10.7 },
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
  const drawerDeck = tower.code === 'S2D' ? 47.5 : 46;
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
      rods: [{ label: 'Long hang rod', y: nearestDrillHoleY(longHangRodY), bayX: tower.bayX, width: tower.width }],
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
      rods: [{ label: 'Hang rod', y: nearestDrillHoleY(drawing.height - 8.5), bayX: tower.bayX, width: tower.width }],
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
      rods: [{ label: 'Hang rod', y: nearestDrillHoleY(drawing.height - 7.5), bayX: tower.bayX, width: tower.width }],
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
        { label: 'Upper rod', y: nearestDrillHoleY(topShelf - rodDropBelowShelf), bayX: tower.bayX, width: tower.width },
        { label: 'Lower rod', y: nearestDrillHoleY(middleShelfY - rodDropBelowShelf), bayX: tower.bayX, width: tower.width },
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
        { y: drawerDeck, fixed: false },
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

function BoxPart({ position, scale, material = panelMaterial, edge = true }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={scale} />
      <meshStandardMaterial {...material} />
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
      edge={!photoMode}
    />
  );
}

function ToeKick({ drawing, photoMode = false }) {
  const frontInset = 2.1;

  return (
    <>
      <BoxPart
        position={[0, toeKickHeight / 2, depth / 2 - frontInset]}
        scale={[drawing.assembledWidth - panelThickness * 2, toeKickHeight, panelThickness]}
        material={edgeMaterial}
        edge={!photoMode}
      />
      {drawing.towers.map((tower) => (
        <BoxPart
          key={`${tower.id}-toe`}
          position={[tower.bayX + tower.width / 2 - drawing.sceneCenterX, toeKickHeight / 2, depth / 2 - toeKickDepth / 2 - frontInset]}
          scale={[tower.width - 1.5, toeKickHeight, toeKickDepth]}
          material={edgeMaterial}
          edge={!photoMode}
        />
      ))}
    </>
  );
}

function Rod3D({ drawing, rod }) {
  const socketXs = [
    rod.bayX + frontDrillLineInsetX - drawing.sceneCenterX,
    rod.bayX + rod.width - frontDrillLineInsetX - drawing.sceneCenterX,
  ];
  const rodLength = socketXs[1] - socketXs[0];
  const rodX = (socketXs[0] + socketXs[1]) / 2;

  return (
    <group position={[rodX, rod.y, frontDrillLineZ]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.34, rodLength, 32]} />
        <meshStandardMaterial color="#b8b8b8" roughness={0.25} metalness={0.9} />
      </mesh>
      {[-rodLength / 2, rodLength / 2].map((bracketX) => (
        <group key={bracketX} position={[bracketX, 0, 0]}>
          <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.72, 0.72, 0.18, 32]} />
            <meshStandardMaterial color="#a6a6a6" roughness={0.35} metalness={0.85} />
          </mesh>
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[0.36, 24, 16]} />
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
  const hangerPlaneZ = frontDrillLineZ;

  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <Hanger
          key={`${rod.label}-${rod.bayX}-${index}`}
          xPosition={bayStart + index * spacing}
          y={rod.y - 1.5}
          z={hangerPlaneZ}
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
  const sideRevealWidth = 0.08;
  const pullMaterial = { color: '#c7c5bf', roughness: 0.32, metalness: 0.82 };

  return (
    <>
      {drawers.map((drawer, index) => (
        <group key={`${tower.id}-${drawer.label}-${drawer.centerY}`}>
          <BoxPart
            position={[drawerX, drawer.centerY, frontZ]}
            scale={[drawerFaceWidth, drawer.height, 0.42]}
            material={photoMode ? photoDrawerMaterial : { color: '#f8f7f1', roughness: 0.74, metalness: 0 }}
            edge={!photoMode}
          />
          {[-1, 1].map((side) => (
            <BoxPart
              key={`${drawer.centerY}-overlay-${side}`}
              position={[drawerX + side * (tower.width / 2 + drawerSideOverlay / 2), drawer.centerY, frontZ + 0.23]}
              scale={[sideRevealWidth, drawer.height, 0.09]}
              material={{ color: '#bdbdb5', roughness: 0.84, metalness: 0 }}
              edge={false}
            />
          ))}
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
  const pinYs = Array.from({ length: 40 }, (_, index) => shelfPinStartY + index * shelfPinSpacingY).filter((pinY) => pinY < drawing.height - 6);
  const rowXs = [
    tower.bayX + frontDrillLineInsetX - drawing.sceneCenterX,
    tower.bayX + tower.width - frontDrillLineInsetX - drawing.sceneCenterX,
  ];

  return (
    <>
      {rowXs.map((pinX) =>
        pinYs.map((pinY) => (
          <mesh key={`${tower.id}-${pinX}-${pinY}`} position={[pinX, pinY, frontDrillLineZ]} rotation={[Math.PI / 2, 0, 0]}>
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

function Room({ drawing, photoMode = false }) {
  const wallColor = photoMode ? '#f0ebe3' : '#f1f0ea';
  const floorColor = photoMode ? '#d2b783' : '#d9c19a';
  const baseboardColor = photoMode ? '#f7f4ee' : '#f8f7f2';
  const roomWidth = photoMode ? 190 : 120;

  return (
    <>
      <mesh position={[0, drawing.height / 2, -7.35]} receiveShadow>
        <boxGeometry args={[roomWidth, drawing.height + 8, 0.4]} />
        <meshStandardMaterial color={wallColor} roughness={0.94} />
      </mesh>
      <mesh position={[0, -0.18, 5]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[photoMode ? 196 : 128, 82]} />
        <meshStandardMaterial color={floorColor} roughness={0.64} />
      </mesh>
      {Array.from({ length: 14 }, (_, index) => (
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
      <BoxPart position={[0, 2.2, -6.65]} scale={[roomWidth, 3.2, 0.45]} material={{ color: baseboardColor, roughness: 0.86, metalness: 0 }} edge={false} />
      <BoxPart position={[0, 4.1, -6.42]} scale={[roomWidth, 0.28, 0.45]} material={{ color: '#e4e1d8', roughness: 0.86, metalness: 0 }} edge={false} />
      {photoMode && (
        <>
          <SunPatch position={[-44, 38, -6.12]} scale={[18, 30]} opacity={0.15} />
          <SunPatch position={[-42, 13, -6.1]} scale={[22, 10]} opacity={0.11} />
          <SunPatch position={[-34, 0.04, 12]} scale={[26, 16]} opacity={0.1} rotation={[-Math.PI / 2, 0, -0.15]} />
        </>
      )}
    </>
  );
}

function ClosetSystem({ drawing, photoMode = false }) {
  return (
    <group position={[0, 0, 0]}>
      {drawing.panelXs.map((atX) => (
        <VerticalPanel key={atX} drawing={drawing} atX={atX} photoMode={photoMode} />
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

function RenderScene({ drawing, photoMode = false }) {
  return (
    <>
      <color attach="background" args={[photoMode ? '#f4efe7' : '#fbfaf6']} />
      {photoMode && <hemisphereLight args={['#fff9ee', '#c8b38d', 0.36]} />}
      <ambientLight intensity={photoMode ? 0.86 : 0.82} />
      <directionalLight
        position={photoMode ? [-46, 92, 58] : [-34, 78, 42]}
        intensity={photoMode ? 2.75 : 2.65}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={112}
        shadow-camera-bottom={-12}
      />
      <directionalLight position={[42, 56, 36]} intensity={photoMode ? 0.78 : 0.95} />
      <directionalLight position={[0, 50, -44]} intensity={photoMode ? 0.55 : 0.58} />
      <Room drawing={drawing} photoMode={photoMode} />
      <ClosetSystem drawing={drawing} photoMode={photoMode} />
      <ContactShadows position={[0, 0.02, 4]} opacity={photoMode ? 0.3 : 0.24} scale={84} blur={photoMode ? 3.3 : 2.8} far={14} />
      <OrbitControls makeDefault enableDamping target={[0, drawing.height / 2, 0]} minDistance={120} maxDistance={320} />
    </>
  );
}

function ExportButton({ drawing }) {
  const [status, setStatus] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');

  const exportRender = () => {
    const canvas = document.querySelector('canvas');

    if (!canvas) {
      setStatus('No canvas found');
      return;
    }

    try {
      const dataUrl = canvas.toDataURL('image/png');
      setDownloadUrl(dataUrl);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${drawing.handle}.png`;
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
        Export PNG
      </button>
      {status && <span className="text-xs font-medium text-stone-500">{status}</span>}
      {downloadUrl && (
        <a className="text-xs font-semibold text-brand-orange underline" href={downloadUrl} download={`${drawing.handle}.png`}>
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
        <Panel key={atX} atX={atX} label={index === 0 ? 'VL' : index === drawing.panelXs.length - 1 ? 'VR' : 'VD shared'} />
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
  return (
    <select
      value={selectedHandle}
      onChange={(event) => onChange(event.target.value)}
      className="max-w-[330px] rounded border border-stone-300 bg-white px-2 py-1 text-sm font-semibold text-stone-700"
    >
      {drawings.map((option) => (
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

export default function App() {
  const requestedKitHandle = useMemo(getRequestedKitHandle, []);
  const exposeCaptureData = useMemo(shouldExposeCaptureData, []);
  const [airtableStatus, setAirtableStatus] = useState({
    state: 'loading',
    message: 'Checking Airtable...',
  });
  const [kitOptions, setKitOptions] = useState([fallbackKit]);
  const [selectedHandle, setSelectedHandle] = useState(requestedKitHandle || fallbackKit.handle);
  const [viewMode, setViewMode] = useState('photo');

  useEffect(() => {
    let ignore = false;

    async function loadKits() {
      try {
        const response = await fetch('/api/kits');
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Unable to load Airtable kits');
        }

        const connectedTowerDrawings = payload.records
          .map(kitRecordToDrawing)
          .filter(Boolean)
          .filter((kit) => kit.towerSpecs.length >= 2);

        if (!ignore) {
          setKitOptions(connectedTowerDrawings.length > 0 ? connectedTowerDrawings : [fallbackKit]);
          setSelectedHandle((currentHandle) => {
            if (connectedTowerDrawings.some((kit) => kit.handle === currentHandle)) {
              return currentHandle;
            }

            return (
              connectedTowerDrawings.find((kit) => kit.handle === requestedKitHandle)?.handle ||
              connectedTowerDrawings.find((kit) => kit.handle === 'H3D-S8-51-96-14-W')?.handle ||
              connectedTowerDrawings.find((kit) => kit.handle === 'H3D-S9-51-96-14-W')?.handle ||
              connectedTowerDrawings[0]?.handle ||
              fallbackKit.handle
            );
          });
          setAirtableStatus({
            state: 'ready',
            message: `${connectedTowerDrawings.length} connected kits`,
          });
        }
      } catch (error) {
        if (!ignore) {
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
  }, []);

  const baseDrawing = kitOptions.find((kit) => kit.handle === selectedHandle) || kitOptions[0] || fallbackKit;
  const drawing = useMemo(() => createDrawing(baseDrawing), [baseDrawing]);
  const photoMode = viewMode === 'photo';
  const camera = photoMode
    ? { position: [76, 62, 245], fov: 23, near: 0.1, far: 1000 }
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

  return (
    <main className="h-screen bg-brand-ui text-brand-black">
      <header className="flex h-16 items-center justify-between gap-3 border-b border-stone-200 bg-white px-4">
        <h1 className="hidden whitespace-nowrap text-base font-semibold leading-none sm:block">Closets Warehouse Renderer</h1>
        <div className="flex min-w-0 items-center gap-3">
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
          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          <KitSelector drawings={kitOptions} selectedHandle={drawing.handle} onChange={setSelectedHandle} />
          <ExportButton drawing={drawing} />
        </div>
      </header>
      <section
        className={photoMode ? '' : 'grid grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]'}
        style={{ height: 'calc(100vh - 4rem)' }}
      >
        <section className="h-full min-h-0 bg-white">
          <Canvas
            key={`${viewMode}-${drawing.handle}`}
            className="h-full w-full"
            camera={camera}
            gl={{ antialias: true, preserveDrawingBuffer: true }}
            shadows
            onCreated={({ gl }) => {
              gl.shadowMap.enabled = true;
              gl.shadowMap.type = PCFSoftShadowMap;
            }}
          >
            <RenderScene drawing={drawing} photoMode={photoMode} />
          </Canvas>
        </section>
        {!photoMode && (
          <section className="min-h-0 border-l border-stone-200 bg-white">
            <TechnicalDrawing drawing={drawing} />
          </section>
        )}
      </section>
    </main>
  );
}
