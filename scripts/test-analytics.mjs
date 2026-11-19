import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../src/analytics.js', import.meta.url), 'utf8');
function setup(host = 'closetswarehouse-builder.vercel.app', production = true, search = '') {
  const scripts = [];
  const listeners = {};
  const window = { location: { hostname: host, pathname: '/walkin.html', search, href: `https://${host}/walkin.html${search}` } };
  const document = {
    referrer: 'https://closetswarehouse.com/pages/planner?email=private@example.com',
    createElement: () => ({}), head: { appendChild: (script) => scripts.push(script) },
    addEventListener: (name, callback) => { listeners[name] = callback; },
  };
  const context = vm.createContext({ window, document, URL, URLSearchParams });
  vm.runInContext(source.replaceAll('export ', '').replace('import.meta.env.PROD', String(production)), context);
  return { context, window, scripts, listeners, run: (code) => vm.runInContext(code, context) };
}

test('local, preview, renderer and capture sessions never load GA', () => {
  for (const args of [['localhost', false], ['preview.vercel.app', true], ['closetswarehouse-builder.vercel.app', false], ['closetswarehouse-builder.vercel.app', true, '?capture=1'], ['closetswarehouse-builder.vercel.app', true, '?mode=renderer']]) {
    const app = setup(...args);
    app.run('initAnalytics(); trackPlannerEvent("plan_saved")');
    assert.equal(app.scripts.length, 0);
    assert.equal(app.window.dataLayer, undefined);
  }
});

test('initializes once and strips private URL data from manual events', () => {
  const app = setup(undefined, true, '?email=private@example.com&quote=secret&plan=encoded#private');
  app.run('initAnalytics(); initAnalytics(); trackPlannerEvent("plan_saved"); trackPlannerEvent("verification_requested"); trackPlannerEvent("purchase")');
  const commands = app.window.dataLayer.map((args) => Array.from(args));
  assert.equal(app.scripts.length, 1);
  assert.equal(app.scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=GT-TNH4QL3Q');
  assert.equal(commands.filter((args) => args[1] === 'page_view').length, 1);
  assert.equal(commands.filter((args) => args[1] === 'plan_saved').length, 1);
  assert.equal(commands.filter((args) => args[1] === 'verification_requested').length, 1);
  assert.equal(commands.filter((args) => args[1] === 'purchase').length, 0);
  assert.equal(commands[0][2].ad_storage, 'denied');
  assert.equal(commands[2][2].send_page_view, false);
  assert.equal(commands[2][1], 'GT-TNH4QL3Q');
  for (const command of commands.filter(([type]) => type === 'event')) {
    assert.equal(command[2].send_to, 'G-5Z476V32S6');
  }
  assert.equal(commands[3][2].planner_type, 'walk-in');
  assert.doesNotMatch(JSON.stringify(commands), /private|secret|encoded/);
});

test('configuration event uses the requested GA4 name and fires once for both planners', () => {
  for (const [pathname, plannerType] of [['/', 'reach-in'], ['/walkin.html', 'walk-in']]) {
    const app = setup();
    app.window.location.pathname = pathname;
    app.run('initAnalytics(); trackPlannerEvent("reach_configration"); trackPlannerEvent("reach_configration"); trackPlannerEvent("reach_configuration"); trackPlannerEvent("reach-configuration")');
    const events = app.window.dataLayer.map((args) => Array.from(args)).filter((args) => args[0] === 'event');
    assert.equal(events.filter((args) => args[1] === 'reach_configration').length, 1);
    assert.equal(events.filter((args) => args[1] === 'reach_configuration').length, 0);
    assert.equal(events.filter((args) => args[1] === 'reach-configuration').length, 0);
    assert.equal(events.find((args) => args[1] === 'reach_configration')[2].planner_type, plannerType);
  }
});

test('only storefront product links emit product click events', () => {
  const app = setup();
  app.run('initAnalytics()');
  for (const href of ['https://example.com/products/a', 'https://closetswarehouse.com/pages/contact', 'https://closetswarehouse.com/products/tower?email=private']) {
    app.listeners.click({ target: { closest: () => ({ href }) } });
  }
  assert.equal(app.window.dataLayer.filter((args) => args[1] === 'product_link_clicked').length, 1);
  assert.doesNotMatch(JSON.stringify(app.window.dataLayer), /private/);
});
