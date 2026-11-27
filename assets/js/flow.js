// The whole flow of a project on one screen, as a 2D diagram that runs on its own.
// Every stage is a node on a rail. Units of work leave the input, go through every stage and reach
// the output; one crossing takes LOOP seconds and repeats forever. A check sends some units to a
// "rejected" tag. A second track shows the same work done manually, one unit at a time, at its real
// pace relative to the automated one. On narrow screens the rail folds into rows (snake layout).
// No inline scripts or style attributes: the page CSP is script-src 'self' / style-src 'self'.
import { FLOWS } from './flow-data.js';

const $ = (id) => document.getElementById(id);
const LOOP = 4.2;                 // seconds for one unit to cross the whole flow
const WORK_DAYS = 22;             // working days in a month, for the calculator
const MAX_RATIO = 40;             // the manual unit is at most this many times slower on screen
const R = 20, TOP = 36, PAD = 12; // node radius, room above each row, side padding (px)
const MIN_CELL = 112;             // narrowest a stage may get before the rail folds into another row
const GREEN = [22, 163, 74], NAVY = [18, 58, 90]; // brand green -> brand navy (#123A5A)
const NS = 'http://www.w3.org/2000/svg';

const state = { lang: 'en', flow: 0, step: 0, items: FLOWS[0].items, manualMin: FLOWS[0].manualMin, visible: true, t0: 0 };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const tr = (o) => (o && typeof o === 'object' && 'en' in o ? o[state.lang] : o);
const flow = () => FLOWS[state.flow];
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x) => x * x * (3 - 2 * x);
const mix = (t) => 'rgb(' + GREEN.map((g, i) => Math.round(g + (NAVY[i] - g) * t)).join(',') + ')';
const fmt = (n, d) => n.toLocaleString(state.lang === 'es' ? 'es-CO' : 'en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function svgEl(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
function fmtDur(sec) {
  if (sec < 60) return fmt(sec, sec < 10 && sec % 1 ? 1 : 0) + ' s';
  const m = Math.floor(sec / 60), r = Math.round(sec % 60);
  if (m >= 60) { const h = Math.floor(m / 60), mm = m % 60; return fmt(h) + ' h' + (mm ? ' ' + mm + ' min' : ''); }
  return m + ' min' + (r ? ' ' + r + ' s' : '');
}
// Seconds one unit takes: manually (the slider scales every stage in proportion) and automated.
const handU = () => state.manualMin * 60;
const autoU = () => flow().autoMin * 60 / flow().items;
const handSec = (st) => st.handMin * 60 * state.manualMin / flow().manualMin;

// ---------- the 2D flow ----------
let S = 0, M = 12, total = 1, raf = 0, settle = 0;
let nodes = [], dots = [], queue = [], pts = [], cum = [0], nodeAt = [];
let tag = null, handL = null, handR = null, handDot = null;
const g = {}, rejectTo = [0, 0], hand = [0, 0, 0], P = [0, 0];

function buildFlow() {
  const f = flow(), box = $('nodes'), svg = $('wire');
  S = f.stations.length; M = S * 3; state.t0 = performance.now() / 1000;
  box.textContent = ''; svg.textContent = ''; nodes = []; dots = []; queue = [];
  const mk = (cls, onClick) => {
    const n = el(onClick ? 'button' : 'div', 'nd ' + cls), c = el('span', 'c'), t = el('span', 't');
    if (onClick) { n.type = 'button'; n.addEventListener('click', onClick); }
    n.append(c, t); box.appendChild(n);
    const o = { el: n, c, t, x: 0, y: 0 }; nodes.push(o); return o;
  };
  mk('end in').c.textContent = '→';
  f.stations.forEach((s, k) => {
    const o = mk('st', () => setStep(k)), col = mix(S > 1 ? k / (S - 1) : 0);
    o.c.textContent = String(k + 1); o.c.style.borderColor = col; o.c.style.color = col;
  });
  mk('end out').c.textContent = '✓';
  tag = el('div', 'rtag'); handL = el('div', 'hl'); handR = el('div', 'hr'); box.append(tag, handL, handR);
  g.rail = svgEl('polyline', { class: 'rail' }); g.flow = svgEl('polyline', { class: 'rail-flow' });
  g.rej = svgEl('line', { class: 'rej-line' }); g.hand = svgEl('line', { class: 'hand-line' });
  svg.append(g.rail, g.flow, g.rej, g.hand);
  for (let j = 0; j < 5; j++) { const c = svgEl('circle', { r: 4.5, class: 'hq' }); queue.push(c); svg.appendChild(c); }
  handDot = svgEl('circle', { r: 6.5, class: 'hd' }); svg.appendChild(handDot);
  for (let i = 0; i < M; i++) { const c = svgEl('circle', { r: 5.5, class: 'dot' }); dots.push(c); svg.appendChild(c); }
}
// Texts of every node. Heights change with the language, so the layout is computed again.
function renderNodes() {
  const f = flow(); if (!nodes.length) return;
  const fill = (o, name, sub, time, mono) => {
    o.t.textContent = ''; o.t.append(el('b', '', name), el('span', mono ? 'mono' : '', sub));
    if (time) o.t.appendChild(el('small', '', time));
  };
  fill(nodes[0], tr(T.inL), tr(f.input.title), '', true);
  f.stations.forEach((st, k) => fill(nodes[k + 1], tr(st.name), tr(st.short), fmtDur(handSec(st)) + ' → ' + fmtDur(st.autoSec)));
  fill(nodes[S + 1], tr(T.outL), tr(f.output.title), '');
  tag.textContent = tr(f.rejectName);
  handL.textContent = tr(T.hand) + ' · ' + tr(T.handNote);
  const r = handU() / autoU(); handR.textContent = r >= 2 ? '≈ ' + fmt(r) + '× ' + tr(T.slower) : '';
  markStep(); layout();
}
function markStep() { nodes.forEach((o, i) => o.el.classList.toggle('on', i - 1 === state.step)); }
// Places the nodes on a rail that folds into as many rows as the width needs, then the manual track.
function layout() {
  const area = $('area'), W = area.clientWidth; if (!W || !nodes.length) return;
  const n = S + 2, maxCols = Math.max(2, Math.floor((W - PAD * 2) / MIN_CELL));
  const rows = Math.ceil(n / Math.min(n, maxCols)), cols = Math.ceil(n / rows);
  const x0 = PAD + (rows > 1 ? 16 : 0), cw = (W - 2 * x0) / cols;
  nodes.forEach((o) => { o.el.style.width = (cw - 12).toFixed(1) + 'px'; });
  const railY = []; let y = 0;
  for (let r = 0; r < rows; r++) {
    let h = 0; for (let i = r * cols; i < Math.min(n, (r + 1) * cols); i++) h = Math.max(h, nodes[i].el.offsetHeight);
    railY.push(y + TOP + R); y += TOP + h + 14;
  }
  pts = []; cum = [0]; nodeAt = [];
  const push = (x, yy) => {
    if (pts.length) { const p = pts[pts.length - 1]; cum.push(cum[cum.length - 1] + Math.hypot(x - p[0], yy - p[1])); }
    pts.push([x, yy]);
  };
  nodes.forEach((o, i) => {
    const r = Math.floor(i / cols), ci = i % cols, c = r % 2 ? cols - 1 - ci : ci, cx = x0 + (c + 0.5) * cw;
    if (i && ci === 0) { const bx = (r - 1) % 2 === 0 ? x0 + cols * cw + 6 : x0 - 6; push(bx, railY[r - 1]); push(bx, railY[r]); }
    push(cx, railY[r]); nodeAt[i] = cum[cum.length - 1]; o.x = cx; o.y = railY[r];
    o.el.style.left = (cx - cw / 2 + 6).toFixed(1) + 'px'; o.el.style.top = (railY[r] - R) + 'px';
  });
  total = cum[cum.length - 1] || 1;
  const line = pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  g.rail.setAttribute('points', line); g.flow.setAttribute('points', line);
  // the tag where rejected units end up, just above the stage that runs the check
  const rn = nodes[flow().rejectAt + 1], tl = Math.max(4, Math.min(rn.x + 18, W - tag.offsetWidth - 4)), tt = rn.y - R - 34;
  tag.style.left = tl.toFixed(1) + 'px'; tag.style.top = tt + 'px';
  rejectTo[0] = tl + 11; rejectTo[1] = tt + tag.offsetHeight / 2;
  g.rej.setAttribute('x1', rn.x); g.rej.setAttribute('y1', rn.y - R); g.rej.setAttribute('x2', rejectTo[0]); g.rej.setAttribute('y2', rejectTo[1]);
  // manual track
  const hy = y + 38;
  handL.style.left = PAD + 'px'; handL.style.top = (y + 6) + 'px';
  handR.style.left = (W - PAD - handR.offsetWidth) + 'px'; handR.style.top = (y + 6) + 'px';
  hand[0] = PAD + 6 + 5 * 13 + 8; hand[1] = W - PAD - 8; hand[2] = hy;
  g.hand.setAttribute('x1', PAD + 2); g.hand.setAttribute('y1', hy); g.hand.setAttribute('x2', W - PAD - 2); g.hand.setAttribute('y2', hy);
  queue.forEach((c, j) => { c.setAttribute('cx', PAD + 6 + j * 13); c.setAttribute('cy', hy); });
  const H = hy + 20, svg = $('wire');
  area.style.height = H + 'px';
  svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  settle = 3; kick();
}
function at(d) {
  let k = 1; while (k < cum.length - 1 && cum[k] < d) k++;
  const a = pts[k - 1], b = pts[k], t = (d - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1);
  P[0] = a[0] + (b[0] - a[0]) * t; P[1] = a[1] + (b[1] - a[1]) * t;
}
// Every unit is a pure function of the elapsed time: where it is and what colour.
function draw(time) {
  if (pts.length < 2) return;
  const rj = flow().rejectAt + 1, rn = nodes[rj], dRej = nodeAt[rj];
  for (let i = 0; i < M; i++) {
    const u = (time / LOOP + i / M) % 1, d = u * total, c = dots[i];
    if (i % 6 === 5 && d >= dRej) { // this one fails the check: it leaves the rail
      const e = (d - dRej) / 70, s = smooth(clamp01(e));
      c.setAttribute('cx', (rn.x + (rejectTo[0] - rn.x) * s).toFixed(1)); c.setAttribute('cy', (rn.y - R + (rejectTo[1] - rn.y + R) * s).toFixed(1));
      c.setAttribute('fill', '#ef4444'); c.setAttribute('opacity', e < 1.8 ? 1 : Math.max(0, 2.8 - e).toFixed(2));
      continue;
    }
    at(d);
    c.setAttribute('cx', P[0].toFixed(1)); c.setAttribute('cy', P[1].toFixed(1));
    c.setAttribute('fill', mix(u)); c.setAttribute('opacity', Math.min(1, u / 0.03, (1 - u) / 0.03).toFixed(2));
  }
  // each node gives a small pulse when a unit reaches it
  for (let k = 1; k <= S; k++) {
    const ph = ((((time / LOOP - nodeAt[k] / total) * M) % 1) + 1) % 1;
    nodes[k].c.style.transform = 'scale(' + (1 + Math.exp(-ph * 5) * 0.14).toFixed(3) + ')';
  }
  // manual: the same unit, at its real pace next to the automated one (capped so it still moves)
  const ratio = Math.min(MAX_RATIO, Math.max(1, handU() / autoU())), uh = (time / (LOOP * ratio)) % 1;
  handDot.setAttribute('cx', (hand[0] + (hand[1] - hand[0]) * uh).toFixed(1)); handDot.setAttribute('cy', hand[2]);
}

// ---------- loop ----------
function kick() { if (!raf) raf = requestAnimationFrame(frame); }
function frame(now) {
  raf = 0;
  const time = reduceMotion ? 2.2 : now / 1000 - state.t0;
  draw(time); updateCounters(time);
  if (settle > 0) settle--;
  if (state.visible && (!reduceMotion || settle > 0)) raf = requestAnimationFrame(frame);
}

// ---------- texts ----------
const T = {
  inL: { en: 'Input', es: 'Entrada' }, outL: { en: 'Output', es: 'Salida' }, of: { en: 'of', es: 'de' },
  hand: { en: 'Manual process', es: 'Proceso manual' }, handNote: { en: 'one unit at a time', es: 'una unidad a la vez' },
  slower: { en: 'slower', es: 'más lento' },
  perDay: { en: 'of manual work per day', es: 'de trabajo manual al día' }, perMonth: { en: 'of manual work saved per month', es: 'de trabajo manual ahorradas al mes' },
  minEach: { en: 'min each', es: 'min cada uno' }, perDayUnit: { en: 'a day', es: 'al día' },
  byHand: { en: 'Manual process per unit:', es: 'Proceso manual por unidad:' },
  step: { en: 'Stage', es: 'Etapa' }, per: { en: 'per', es: 'por' },
  faster: { en: 'times faster', es: 'veces más rápido' }, same: { en: 'Similar time, with no manual intervention', es: 'Tiempo similar, sin intervención manual' },
  totTitle: { en: 'All {n} stages together', es: 'Las {n} etapas juntas' }, withN: { en: 'With {n} {u} a day', es: 'Con {n} {u} al día' },
};
const cache = {};
function setText(id, s) { if (cache[id] !== s) { cache[id] = s; $(id).textContent = s; } }
// Live counters: how many units have crossed since the flow started, and what that would have cost manually.
function updateCounters(time) {
  const n = reduceMotion ? flow().items : Math.floor(Math.max(0, time - LOOP) * M / LOOP);
  setText('cDone', fmt(n) + ' ' + tr(flow().unit));
  setText('cHand', fmtDur(n * handU())); setText('cAuto', fmtDur(n * autoU()));
  setText('cSaved', fmtDur(Math.max(0, n * (handU() - autoU()))));
}

// ---------- detail of one stage, below the flow ----------
function viewEl(v) {
  if (v.t === 'table') {
    const tb = el('table', 'dv'), h = el('tr'); v.cols.forEach((c) => h.appendChild(el('th', '', tr(c)))); tb.appendChild(h);
    v.rows.forEach((r, i) => { const row = el('tr', v.flag[i] || ''); r.forEach((c) => row.appendChild(el('td', '', tr(c) || '—'))); tb.appendChild(row); });
    return tb;
  }
  if (v.t === 'kv') {
    const dl = el('dl', 'dv-kv');
    v.items.forEach((it) => { const d = el('div'); d.append(el('dt', '', tr(it[0])), el('dd', '', tr(it[1]))); dl.appendChild(d); });
    return dl;
  }
  const b = el('div', 'dv-lines');
  v.lines.forEach((l, i) => b.appendChild(el('div', 'ln ' + (v.flag[i] || ''), tr(l))));
  return b;
}
function renderDiagram() {
  const f = flow(), d = $('diagram'); d.textContent = '';
  f.stations.forEach((st, k) => {
    if (k) d.appendChild(el('span', 'link'));
    const b = el('button', 'node' + (k === state.step ? ' on' : ''));
    b.type = 'button'; b.setAttribute('aria-current', k === state.step ? 'step' : 'false');
    b.append(el('b', '', String(k + 1)), el('span', 'nm', tr(st.name)));
    b.addEventListener('click', () => setStep(k)); d.appendChild(b);
  });
}
function renderStep() {
  const f = flow(), st = f.stations[state.step], h = handSec(st), a = st.autoSec;
  $('stK').textContent = tr(T.step) + ' ' + (state.step + 1) + ' ' + tr(T.of) + ' ' + f.stations.length;
  $('stName').textContent = tr(st.name); $('stTech').textContent = st.tech; $('stDesc').textContent = tr(st.desc);
  $('stIn').textContent = ''; $('stIn').appendChild(viewEl(st.inp));
  $('stOut').textContent = ''; $('stOut').appendChild(viewEl(st.out));
  $('stHandT').textContent = fmtDur(h); $('stHandW').textContent = tr(st.hand);
  $('stAutoT').textContent = fmtDur(a);
  $('stPer').textContent = tr(T.per) + ' ' + tr(f.unitOne);
  $('stSave').textContent = h / a >= 2 ? '≈ ' + fmt(h / a, 0) + ' ' + tr(T.faster) : tr(T.same);
  $('barAuto').style.width = Math.max(1.5, Math.min(100, a / h * 100)).toFixed(1) + '%';
  $('stControl').textContent = tr(st.control);
  $('stPrev').disabled = state.step === 0; $('stNext').disabled = state.step === f.stations.length - 1;
}
function renderTotals() {
  const f = flow(), u = tr(f.unit), hU = handU(), aU = autoU(), n = state.items;
  $('totTitle').textContent = tr(T.totTitle).replace('{n}', f.stations.length);
  $('totHandU').textContent = fmtDur(hU); $('totAutoU').textContent = fmtDur(aU);
  $('totPer').textContent = tr(T.per) + ' ' + tr(f.unitOne); $('totPer2').textContent = tr(T.per) + ' ' + tr(f.unitOne);
  $('totDayL').textContent = tr(T.withN).replace('{n}', n).replace('{u}', u);
  $('totHandD').textContent = fmtDur(hU * n); $('totAutoD').textContent = fmtDur(aU * n);
  $('totBarAuto').style.width = Math.max(1.5, Math.min(100, aU / hU * 100)).toFixed(1) + '%';
  $('totBack').textContent = fmtDur(Math.max(0, (hU - aU) * n));
}
function renderOutput() {
  const o = flow().output, root = $('output'); root.textContent = '';
  $('outTitle').textContent = tr(o.title);
  if (o.type === 'bars') {
    const k = el('div', 'kpis');
    o.kpis.forEach((x) => { const d = el('div', 'kpi'); d.append(el('b', '', fmt(x.value, x.decimals) + (x.suffix || '')), el('span', '', tr(x.label))); k.appendChild(d); });
    const chart = el('div', 'bars'); chart.setAttribute('role', 'img'); chart.setAttribute('aria-label', tr(o.series));
    const max = Math.max(...o.values);
    o.values.forEach((v, i) => {
      const col = el('div', 'bar'), track = el('div', 'track'), fill = el('i');
      fill.style.height = (v / max * 100).toFixed(1) + '%'; track.appendChild(fill);
      col.append(el('em', '', fmt(v)), track, el('span', '', tr(o.days)[i])); chart.appendChild(col);
    });
    root.append(k, el('p', 'cap', tr(o.series)), chart);
  } else if (o.type === 'checklist' || o.type === 'schedule') {
    const tb = el('table', 'mini');
    if (o.cols) { const h = el('tr'); tr(o.cols).forEach((c) => h.appendChild(el('th', '', c))); tb.appendChild(h); }
    o.rows.forEach((r) => {
      const row = el('tr'); let st, cls;
      if (o.type === 'checklist') { st = r.missing ? 'retry' : 'ok'; cls = st; row.append(el('td', 'mono', r.id), el('td', 'num', String(r.expected)), el('td', 'num', String(r.expected - r.missing))); }
      else { st = r.blocked ? 'blocked' : 'ok'; cls = r.blocked ? 'retry' : 'ok'; row.append(el('td', 'mono', r.time), el('td', '', tr(r.title))); }
      const td = el('td'); td.appendChild(el('span', 'pill ' + cls, tr(o.status[st]))); row.appendChild(td); tb.appendChild(row);
    });
    root.appendChild(tb);
  } else if (o.type === 'qa') {
    o.turns.forEach((x) => {
      root.appendChild(el('p', 'bub q', tr(x.q)));
      const a = el('p', 'bub a' + (x.source ? '' : ' idk'), tr(x.a)); if (x.source) a.appendChild(el('span', 'src', x.source)); root.appendChild(a);
    });
  } else if (o.type === 'report') {
    const k = el('div', 'kpis'), d = el('div', 'kpi'); d.append(el('b', '', fmt(o.rowsTotal)), el('span', '', tr(o.checked))); k.appendChild(d); root.appendChild(k);
    const tb = el('table', 'mini'), h = el('tr'); tr(o.head).forEach((c) => h.appendChild(el('th', '', c))); tb.appendChild(h);
    o.errors.forEach((e) => { const row = el('tr'); row.append(el('td', 'num', fmt(e.row)), el('td', 'mono', e.col), el('td', '', tr(e.why))); tb.appendChild(row); });
    root.append(tb, el('p', 'verdict', tr(o.verdict)));
  }
}
function renderTabs() {
  const tabs = $('tabs'); tabs.textContent = '';
  FLOWS.forEach((f, i) => {
    const b = el('button', 'tab' + (i === state.flow ? ' on' : ''), tr(f.name));
    b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', i === state.flow ? 'true' : 'false');
    b.addEventListener('click', () => setFlow(i)); tabs.appendChild(b);
  });
}
function renderCalc() {
  const f = flow(), u = tr(f.unit);
  $('sItems').min = f.itemsRange[0]; $('sItems').max = f.itemsRange[1]; $('sItems').value = state.items;
  $('sManual').min = f.manualRange[0]; $('sManual').max = f.manualRange[1]; $('sManual').value = state.manualMin;
  $('oItems').textContent = state.items + ' ' + u + ' ' + tr(T.perDayUnit);
  $('oManual').textContent = state.manualMin + ' ' + tr(T.minEach);
  const day = state.items * state.manualMin / 60;
  $('calcDay').textContent = fmt(day, 1) + ' h'; $('calcDayL').textContent = tr(T.perDay);
  $('calcMonth').textContent = fmt(day * WORK_DAYS, 0) + ' h'; $('calcMonthL').textContent = tr(T.perMonth);
}
function renderAll() {
  const f = flow();
  $('blurb').textContent = tr(f.blurb); $('project').textContent = f.project;
  const fl = $('facts'); fl.textContent = ''; f.facts.forEach((x) => fl.appendChild(el('li', '', tr(x))));
  $('handTask').textContent = tr(f.handTask); $('handTaskL').textContent = tr(T.byHand);
  for (const k in cache) delete cache[k];
  renderTabs(); renderNodes(); renderDiagram(); renderStep(); renderTotals(); renderOutput(); renderCalc();
}

// ---------- actions ----------
function setStep(k) {
  state.step = Math.max(0, Math.min(flow().stations.length - 1, k));
  renderDiagram(); renderStep(); markStep();
}
function setFlow(i) {
  state.flow = i; state.step = 0; state.items = flow().items; state.manualMin = flow().manualMin;
  buildFlow(); renderAll();
}
function setLang(l) {
  state.lang = l; document.documentElement.lang = l;
  document.querySelectorAll('[data-en]').forEach((e) => { const v = e.getAttribute('data-' + l); if (v !== null) e.innerHTML = v; });
  $('bEN').classList.toggle('on', l === 'en'); $('bES').classList.toggle('on', l === 'es');
  try { localStorage.setItem('lang', l); } catch (e) { /* private mode */ }
  renderAll();
}
function wire() {
  $('bEN').addEventListener('click', () => setLang('en'));
  $('bES').addEventListener('click', () => setLang('es'));
  $('stPrev').addEventListener('click', () => setStep(state.step - 1));
  $('stNext').addEventListener('click', () => setStep(state.step + 1));
  const onParam = () => {
    state.items = +$('sItems').value; state.manualMin = +$('sManual').value; state.t0 = performance.now() / 1000;
    renderCalc(); renderNodes(); renderStep(); renderTotals();
  };
  $('sItems').addEventListener('input', onParam); $('sManual').addEventListener('input', onParam);
  let lastW = 0;
  new ResizeObserver(() => { const w = $('area').clientWidth; if (w !== lastW) { lastW = w; layout(); } }).observe($('area'));
  new IntersectionObserver((es) => { state.visible = es[0].isIntersecting; if (state.visible) kick(); }, { threshold: 0.05 }).observe($('stage'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
}
function start() {
  let l = 'en'; try { l = localStorage.getItem('lang') || 'en'; } catch (e) { /* private mode */ }
  state.lang = l === 'es' ? 'es' : 'en';
  wire(); buildFlow(); setLang(state.lang);
  $('yr').textContent = new Date().getFullYear();
}
if (document.readyState === 'complete') start(); else addEventListener('load', start);
