import React from 'react';
import { decodePlanPayload } from './planUrls.js';

export default function PublicPlanDrawing({ render }) {
  let plan;
  try {
    plan = decodePlanPayload(window.location.hash.slice(1));
  } catch {
    return <p>Plan drawing unavailable.</p>;
  }
  return (
    <div className="public-plan-drawing" aria-label="Closet planner SVG plan view">
      {render(plan)}
    </div>
  );
}
