import React from 'react';
import { createRoot } from 'react-dom/client';
import App, { ReachIn3DPreview, ReachInPlanView } from './App.jsx';
import PlannerSiteLayout from './PlannerSiteLayout.jsx';
import './styles.css';
import { initAnalytics } from './analytics.js';
import PublicPlanDrawing from './PublicPlanDrawing.jsx';

const root = createRoot(document.getElementById('root'));
if (new URLSearchParams(window.location.search).get('publicDrawing') === '1') {
  root.render(<PublicPlanDrawing
    render={(plan) => <ReachInPlanView modules={plan.modules} {...plan.planDetails} />}
    render3D={(plan, thumbnail) => <ReachIn3DPreview {...plan} thumbnail={thumbnail} />}
  />);
} else {
  initAnalytics();
  root.render(<React.StrictMode>
    <PlannerSiteLayout>
      <App />
    </PlannerSiteLayout>
  </React.StrictMode>);
}
