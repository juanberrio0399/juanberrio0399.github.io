// Data playground: DuckDB-WASM runs SQL over static Arrow IPC files, entirely in the browser.
//
// Nothing heavy loads with the page. The engine (~7 MB compressed) is only fetched when the visitor
// runs the first query: the worker script and the .wasm binary come from jsDelivr, are checked
// against the SHA-384 hashes below (fetch() with Subresource Integrity), and are started from blob:
// URLs. The small JS API is self-hosted under assets/vendor (see scripts/playground/vendor_duckdb.sh).

const ENGINE_VERSION = '1.32.0';
const ENGINE_BASE = `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${ENGINE_VERSION}/dist/`;
const SRI = {
  'duckdb-eh.wasm': 'sha384-hw3GjeJZY5QapQ8mwqMHXBPVmTLO+jKm5dlDwkGsEfjyu/HcXx1d0Rwlr/ZAShjq',
  'duckdb-mvp.wasm': 'sha384-aPxDmtovNQyMTy8S7zolNUiHoQNvtkLGOWJdPtQpW1T52DQuqeGutmEdb0ycBoNs',
  'duckdb-browser-eh.worker.js': 'sha384-a2Q5wPfMJHriw96D3xhtkym83ST11xUIm6e27q9d3v4ykPqSzeY7WCXK6CTlJFwb',
  'duckdb-browser-mvp.worker.js': 'sha384-ABB4QFgUoQqfiMRv4Eme20RCo+rO//OBEOJfiUbiZFBRH/4T4xy8Vcu4hLXgPxQ0',
};
const DATA_BASE = new URL('../data/playground/', import.meta.url);
const TABLES = ['repos', 'languages', 'commits_daily', 'pull_requests', 'snapshot'];

const PRESETS = [
  {
    en: 'Repositories', es: 'Repositorios',
    sql: `SELECT name, language, stars, size_kb,
       CAST(created_at AS DATE) AS created,
       CAST(pushed_at AS DATE)  AS last_push
FROM repos
ORDER BY pushed_at DESC;`,
  },
  {
    en: 'Language mix', es: 'Mezcla de lenguajes',
    sql: `SELECT language,
       round(sum(bytes) / 1024, 1) AS kib,
       round(100 * sum(bytes) / sum(sum(bytes)) OVER (), 1) AS pct
FROM languages
GROUP BY language
ORDER BY kib DESC;`,
  },
  {
    en: 'Commits per week', es: 'Commits por semana',
    sql: `SELECT date_trunc('week', day) AS week,
       sum(commits) AS commits,
       bar(sum(commits), 0, max(sum(commits)) OVER (), 30) AS chart
FROM commits_daily
GROUP BY week
ORDER BY week;`,
  },
  {
    en: 'PR lead time', es: 'Tiempo de merge de PRs',
    sql: `SELECT repo,
       count(*)         AS pull_requests,
       count(merged_at) AS merged,
       round(median(date_diff('minute', created_at, merged_at)) / 60, 1) AS median_hours_to_merge
FROM pull_requests
GROUP BY repo
ORDER BY pull_requests DESC;`,
  },
  {
    en: 'Busiest weekdays', es: 'Días más activos',
    sql: `SELECT dayname(day) AS weekday,
       sum(commits) AS commits
FROM commits_daily
GROUP BY weekday, isodow(day)
ORDER BY isodow(day);`,
  },
  {
    en: 'Table schema', es: 'Esquema de tablas',
    sql: `SELECT table_name, column_name, data_type
FROM information_schema.columns
ORDER BY table_name, ordinal_position;`,
  },
];

const MESSAGES = {
  en: {
    loading: 'Downloading and verifying the DuckDB-WASM engine (about 7 MB)…',
    starting: 'Starting the engine and loading the data…',
    running: 'Running…',
    snapshot: (snap) => `Data snapshot: ${snap} UTC · GitHub REST API`,
    rows: (shown, total, ms) => total > shown
      ? `Showing ${shown} of ${total} rows · ${ms} ms`
      : `${total} ${total === 1 ? 'row' : 'rows'} · ${ms} ms`,
    noRows: (ms) => `The query ran and returned no rows · ${ms} ms`,
    emptySql: 'Write a query first.',
    engineFailed: 'The engine could not be downloaded or did not pass its integrity check. Check your connection and try again.',
    noWasm: 'This browser does not support WebAssembly, which the playground needs.',
    failed: 'The query failed.',
  },
  es: {
    loading: 'Descargando y verificando el motor DuckDB-WASM (unos 7 MB)…',
    starting: 'Arrancando el motor y cargando los datos…',
    running: 'Ejecutando…',
    snapshot: (snap) => `Foto de los datos: ${snap} UTC · API REST de GitHub`,
    rows: (shown, total, ms) => total > shown
      ? `Mostrando ${shown} de ${total} filas · ${ms} ms`
      : `${total} ${total === 1 ? 'fila' : 'filas'} · ${ms} ms`,
    noRows: (ms) => `La consulta corrió y no devolvió filas · ${ms} ms`,
    emptySql: 'Primero escribe una consulta.',
    engineFailed: 'No se pudo descargar el motor o no pasó la verificación de integridad. Revisa tu conexión e inténtalo de nuevo.',
    noWasm: 'Este navegador no soporta WebAssembly, que el playground necesita.',
    failed: 'La consulta falló.',
  },
};

const $ = (id) => document.getElementById(id);
const editor = $('sql');
const runBtn = $('run');
const limitSel = $('limit');
const statusEl = $('status');
const errorEl = $('error');
const snapshotEl = $('snapshot');
const wrap = $('results-wrap');
const thead = $('results').querySelector('thead');
const tbody = $('results').querySelector('tbody');

let lang = 'en';
let lastStatus = null; // [key, ...args] so the message can be re-rendered when the language changes
let connectionPromise = null;
let snapshotLabel = '';
let running = false;

class EngineError extends Error {
  constructor(key, cause) { super(key, { cause }); this.key = key; }
}

// ---------- language ----------
function setLang(l) {
  lang = l;
  document.documentElement.lang = l;
  document.querySelectorAll('[data-en]').forEach((el) => {
    const v = el.getAttribute(`data-${l}`);
    if (v) el.innerHTML = v;
  });
  $('bEN').classList.toggle('on', l === 'en');
  $('bES').classList.toggle('on', l === 'es');
  document.querySelectorAll('#presets .tab').forEach((b, i) => { b.textContent = PRESETS[i][l]; });
  $('presets').setAttribute('aria-label', l === 'es' ? 'Consultas de ejemplo' : 'Example queries');
  if (lastStatus) setStatus(...lastStatus);
  renderSnapshot();
  try { localStorage.setItem('lang', l); } catch (e) { /* storage may be blocked */ }
}

function setStatus(key, ...args) {
  lastStatus = [key, ...args];
  const msg = MESSAGES[lang][key];
  statusEl.textContent = typeof msg === 'function' ? msg(...args) : msg;
}

function renderSnapshot() {
  if (!snapshotLabel) return;
  snapshotEl.textContent = MESSAGES[lang].snapshot(snapshotLabel);
  snapshotEl.hidden = false;
}

function showError(text) {
  errorEl.textContent = text;
  errorEl.hidden = false;
}

// ---------- engine ----------
async function fetchAsBlobUrl(url, type) {
  const file = url.slice(url.lastIndexOf('/') + 1);
  const res = await fetch(url, { integrity: SRI[file], mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return URL.createObjectURL(new Blob([await res.arrayBuffer()], { type }));
}

async function boot() {
  if (typeof WebAssembly !== 'object') throw new EngineError('noWasm');
  setStatus('loading');
  let duckdb, workerUrl, wasmUrl;
  try {
    duckdb = await import('../vendor/duckdb-wasm/duckdb-api.js');
    const bundle = await duckdb.selectBundle({
      mvp: { mainModule: `${ENGINE_BASE}duckdb-mvp.wasm`, mainWorker: `${ENGINE_BASE}duckdb-browser-mvp.worker.js` },
      eh: { mainModule: `${ENGINE_BASE}duckdb-eh.wasm`, mainWorker: `${ENGINE_BASE}duckdb-browser-eh.worker.js` },
    });
    [workerUrl, wasmUrl] = await Promise.all([
      fetchAsBlobUrl(bundle.mainWorker, 'text/javascript'),
      fetchAsBlobUrl(bundle.mainModule, 'application/wasm'),
    ]);
  } catch (e) {
    throw new EngineError('engineFailed', e);
  }

  setStatus('starting');
  const worker = new Worker(workerUrl);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  try {
    await db.instantiate(wasmUrl);
  } finally {
    URL.revokeObjectURL(workerUrl);
    URL.revokeObjectURL(wasmUrl);
  }
  await db.open({ query: { castBigIntToDouble: true, castDecimalToDouble: true, castTimestampToDate: true } });

  const buffers = await Promise.all(TABLES.map(async (t) => {
    const res = await fetch(new URL(`${t}.arrow`, DATA_BASE));
    if (!res.ok) throw new Error(`${t}.arrow: HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }));
  const conn = await db.connect();
  // Everything the playground needs is built into the engine; never download extensions at runtime.
  await conn.query('SET autoinstall_known_extensions = false; SET autoload_known_extensions = false;');
  for (let i = 0; i < TABLES.length; i++) {
    await conn.insertArrowFromIPCStream(buffers[i], { name: TABLES[i], create: true });
  }
  const snap = await conn.query(`SELECT strftime(taken_at, '%Y-%m-%d %H:%M') AS taken FROM snapshot`);
  snapshotLabel = String(snap.getChildAt(0).get(0));
  return conn;
}

function getConnection() {
  if (!connectionPromise) {
    connectionPromise = boot().catch((e) => { connectionPromise = null; throw e; });
  }
  return connectionPromise;
}

// ---------- results ----------
function pad(n) { return String(n).padStart(2, '0'); }

function formatTime(ms, dateOnly) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(ms);
  const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return dateOnly ? day : `${day} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function formatCell(value, type) {
  if (value === null || value === undefined) return { text: 'NULL', cls: 'null' };
  const typeName = String(type);
  if (typeName.startsWith('Date') || typeName.startsWith('Timestamp')) {
    const ms = value instanceof Date ? value.getTime() : Number(value);
    return { text: formatTime(ms, typeName.includes('DAY')) };
  }
  if (typeof value === 'number') return { text: String(value), cls: 'num' };
  if (typeof value === 'bigint') return { text: value.toString(), cls: 'num' };
  if (typeof value === 'object') {
    let v = typeof value.toJSON === 'function' ? value.toJSON() : value;
    if (ArrayBuffer.isView(v)) v = Array.from(v);
    return { text: JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : x)) };
  }
  return { text: String(value) };
}

function render(table, ms) {
  const fields = table.schema.fields;
  const total = table.numRows;
  const shown = Math.min(total, Number(limitSel.value));
  const columns = fields.map((f, i) => table.getChildAt(i));

  const headRow = document.createElement('tr');
  fields.forEach((f) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = f.name;
    headRow.appendChild(th);
  });
  const body = document.createDocumentFragment();
  for (let r = 0; r < shown; r++) {
    const tr = document.createElement('tr');
    columns.forEach((col, c) => {
      const td = document.createElement('td');
      const cell = formatCell(col ? col.get(r) : null, fields[c].type);
      td.textContent = cell.text;
      if (cell.cls) td.className = cell.cls;
      tr.appendChild(td);
    });
    body.appendChild(tr);
  }
  thead.replaceChildren(headRow);
  tbody.replaceChildren(body);
  wrap.hidden = fields.length === 0;
  if (total === 0) setStatus('noRows', ms);
  else setStatus('rows', shown, total, ms);
}

async function run() {
  if (running) return;
  const sql = editor.value.trim();
  errorEl.hidden = true;
  if (!sql) { setStatus('emptySql'); editor.focus(); return; }

  running = true;
  runBtn.disabled = true;
  runBtn.setAttribute('aria-busy', 'true');
  try {
    const conn = await getConnection();
    renderSnapshot();
    setStatus('running');
    const t0 = performance.now();
    const table = await conn.query(sql);
    render(table, Math.round(performance.now() - t0));
  } catch (e) {
    wrap.hidden = true;
    if (e instanceof EngineError) {
      setStatus(e.key);
    } else {
      setStatus('failed');
      showError(e && e.message ? e.message : String(e));
    }
  } finally {
    running = false;
    runBtn.disabled = false;
    runBtn.removeAttribute('aria-busy');
  }
}

// ---------- wiring ----------
PRESETS.forEach((p, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tab';
  b.textContent = p.en;
  b.setAttribute('aria-pressed', String(i === 0));
  b.addEventListener('click', () => {
    document.querySelectorAll('#presets .tab').forEach((x, j) => {
      x.classList.toggle('on', j === i);
      x.setAttribute('aria-pressed', String(j === i));
    });
    editor.value = p.sql;
    if (connectionPromise) run();
  });
  if (i === 0) b.classList.add('on');
  $('presets').appendChild(b);
});
editor.value = PRESETS[0].sql;

runBtn.addEventListener('click', run);
editor.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
});
limitSel.addEventListener('change', () => { if (connectionPromise && !wrap.hidden) run(); });
$('bEN').addEventListener('click', () => setLang('en'));
$('bES').addEventListener('click', () => setLang('es'));
$('yr').textContent = new Date().getFullYear();

let saved = 'en';
try { saved = localStorage.getItem('lang') || 'en'; } catch (e) { /* storage may be blocked */ }
if (saved !== 'en') setLang(saved);
