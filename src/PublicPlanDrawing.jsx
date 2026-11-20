import React, { useState } from 'react';
import { decodePlanPayload } from './planUrls.js';

export default function PublicPlanDrawing({ render, render3D }) {
  const [view, setView] = useState('plan');
  const interactive = new URLSearchParams(window.location.search).get('interactive') === '1';
  let plan;
  try {
    plan = decodePlanPayload(window.location.hash.slice(1));
  } catch {
    return <p>Plan drawing unavailable.</p>;
  }
  const drawing = <div className="public-plan-drawing" aria-label="Closet plan view">{render(plan)}</div>;
  if (!interactive) return drawing;

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex shrink-0 justify-end bg-white p-2">
        <div role="group" aria-label="Drawing view" className="flex rounded border border-stone-300 bg-white p-0.5 text-xs font-bold">
          {[['plan', 'Plan'], ['3d', '3D']].map(([mode, label]) => (
            <button key={mode} type="button" aria-pressed={view === mode} onClick={() => setView(mode)}
              className={`rounded px-3 py-1.5 ${view === mode ? 'bg-brand-orange text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto">
        {view === '3d' ? render3D(plan) : drawing}
      </div>
    </div>
  );
}
