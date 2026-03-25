# PDF Form Mapper — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, zero-backend GitHub Pages app that lets users draw labelled rectangles over uploaded PDF forms, then export a JSON (position-based mapping) or CSV (keyname→PDF-field-ID mapping) without ever persisting the PDF to disk.

**Architecture:** Pure vanilla HTML/CSS/ESM JavaScript — no build step, no framework. PDF.js (CDN) handles rendering and AcroForm annotation extraction. Rectangle overlays are absolutely-positioned DOM `<div>` elements layered over per-page `<canvas>` elements, so native browser events (mousedown/mousemove/mouseup) handle drag, resize, and selection. All PDF bytes live only in a module-level `ArrayBuffer` that is garbage-collected when the tab closes.

**Tech Stack:** HTML5, CSS3 (custom properties for theming), vanilla ESM JS, PDF.js 4.x (CDN), GitHub Pages (static hosting, no Jekyll via `.nojekyll`)

---

## File Structure

```
pdf_form_mapper/
├── index.html                  — single-page shell: toolbar, sidebar, viewer, info section
├── .nojekyll                   — disables Jekyll on GitHub Pages
├── css/
│   └── styles.css              — dark asphalt theme, CSS custom properties (--accent-color)
└── js/
    ├── main.js                 — app init, global event wiring, state bootstrap
    ├── pdf-renderer.js         — PDF.js load/render, annotation extraction, page-canvas registry
    ├── rect-manager.js         — rectangle state CRUD, per-page storage, validation
    ├── interactions.js         — mouse event handlers: draw-new, drag-move, corner-resize
    ├── panel.js                — properties panel: label input, type dropdown, color picker, delete
    ├── exporter.js             — JSON download, JSON upload/restore, CSV mapping download
    └── tooltip.js              — ? icon tooltip system
```

**Why this split:** each file has one job with a clear interface. `rect-manager.js` is the single source of truth for rectangle data — all other modules call its API, never mutate state directly.

---

## JSON Output Format

```json
{
  "version": "1.0",
  "pages": [
    {
      "page": 1,
      "fields": [
        {
          "id": "a1b2c3d4",
          "label": "vorname",
          "type": "text",
          "x_pct": 0.105,
          "y_pct": 0.213,
          "w_pct": 0.312,
          "h_pct": 0.042,
          "color": "#4a9eff"
        }
      ]
    }
  ]
}
```

Coordinates are fractions of PDF page dimensions (0.0–1.0), making the JSON zoom-independent.

## CSV Output Format (UTF-8 BOM for Excel/German/French chars)

```
key_name,pdf_field_id
vorname,TextField_1
nachname,TextField_2
```

---

## Task 1: Project Scaffold + GitHub Pages Setup

**Files:**
- Create: `pdf_form_mapper/index.html`
- Create: `pdf_form_mapper/.nojekyll`
- Create: `pdf_form_mapper/css/styles.css`
- Create: `pdf_form_mapper/js/main.js`

- [ ] **Step 1: Create `.nojekyll`**

```bash
touch pdf_form_mapper/.nojekyll
```

- [ ] **Step 2: Create `index.html` skeleton**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; worker-src blob:; img-src 'self' blob: data:; connect-src 'none';">
  <!-- NOTE: 'unsafe-inline' for style-src is required because accent color theming
       uses document.documentElement.style.setProperty() which is treated as inline style.
       This is an accepted trade-off for a pure-client static app with no server-side nonce. -->
  <title>PDF Form Mapper</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <!-- TOOLBAR -->
  <header id="toolbar">
    <span class="app-title">PDF Form Mapper</span>
    <div class="toolbar-controls">
      <!-- Upload PDF -->
      <label class="btn" for="pdf-upload">
        Upload PDF
        <input type="file" id="pdf-upload" accept=".pdf" hidden>
      </label>
      <!-- Load JSON -->
      <label class="btn" for="json-upload">
        Load JSON
        <input type="file" id="json-upload" accept=".json" hidden>
      </label>
      <!-- Add Rectangle -->
      <button id="btn-add-rect" class="btn" disabled>+ Add Field</button>
      <!-- Toggle PDF field borders -->
      <button id="btn-toggle-fields" class="btn" disabled>
        Toggle PDF Fields
        <span class="tooltip-anchor">?<span class="tooltip-text">PLACEHOLDER: explain what this does</span></span>
      </button>
      <!-- Color picker -->
      <label class="color-label">
        Rect Color
        <input type="color" id="rect-color" value="#4a9eff">
      </label>
      <!-- Download JSON -->
      <button id="btn-dl-json" class="btn btn-primary" disabled>Download JSON</button>
      <!-- Download CSV -->
      <button id="btn-dl-csv" class="btn btn-primary" disabled>Download CSV</button>
    </div>
  </header>

  <!-- MAIN LAYOUT -->
  <main id="main-layout">
    <!-- PDF VIEWER -->
    <div id="pdf-viewer">
      <div id="drop-hint">
        <p>Upload a PDF to get started</p>
        <p class="sub">PLACEHOLDER: add usage instructions here</p>
      </div>
      <div id="pages-container"></div>
    </div>

    <!-- PROPERTIES PANEL -->
    <aside id="properties-panel" class="hidden">
      <h3>Field Properties</h3>
      <label>
        Label (HTTP POST key)
        <span class="tooltip-anchor">?<span class="tooltip-text">PLACEHOLDER: label tooltip</span></span>
        <input type="text" id="prop-label" placeholder="e.g. first_name">
      </label>
      <label>
        Type
        <span class="tooltip-anchor">?<span class="tooltip-text">PLACEHOLDER: type tooltip</span></span>
        <select id="prop-type">
          <option value="">— select type —</option>
          <option value="text">text</option>
          <option value="checkbox">checkbox</option>
          <option value="radio">radio</option>
        </select>
      </label>
      <button id="prop-delete" class="btn btn-danger">Delete Field</button>
      <p id="prop-no-selection" class="muted">Click a rectangle to edit it.</p>
    </aside>
  </main>

  <!-- INFO SECTION -->
  <footer id="info-section">
    <h4>About</h4>
    <p>PLACEHOLDER: add general information, contact details, etc.</p>
  </footer>

  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create base `css/styles.css`**

```css
/* === CSS Custom Properties === */
:root {
  --bg-primary: #1e2124;
  --bg-secondary: #2c2f33;
  --bg-tertiary: #36393f;
  --text-primary: #ffffff;
  --text-muted: #99aab5;
  --accent: #4a9eff;          /* updated dynamically via JS */
  --danger: #e74c3c;
  --border: #40444b;
  --toolbar-height: 56px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 14px;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* TOOLBAR */
#toolbar {
  height: var(--toolbar-height);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  flex-shrink: 0;
}
.app-title { font-weight: 600; font-size: 16px; margin-right: auto; }
.toolbar-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* BUTTONS */
.btn {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
  white-space: nowrap;
}
.btn:hover:not(:disabled) { background: var(--accent); border-color: var(--accent); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn.btn-primary { border-color: var(--accent); color: var(--accent); }
.btn.btn-primary:hover:not(:disabled) { background: var(--accent); color: #fff; }
.btn.btn-danger { border-color: var(--danger); color: var(--danger); }
.btn.btn-danger:hover { background: var(--danger); color: #fff; }

/* COLOR PICKER */
.color-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; color: var(--text-muted);
}
#rect-color { width: 32px; height: 28px; border: none; padding: 0; cursor: pointer;
  border-radius: 4px; background: none; }

/* MAIN LAYOUT */
#main-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* PDF VIEWER */
#pdf-viewer {
  flex: 1;
  overflow: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
#drop-hint {
  text-align: center;
  margin-top: 80px;
  color: var(--text-muted);
}
#drop-hint p { margin-bottom: 8px; font-size: 16px; }
#drop-hint .sub { font-size: 13px; }
#pages-container { display: flex; flex-direction: column; gap: 24px; }

/* PAGE WRAPPER: stacks canvas + overlay */
.page-wrapper {
  position: relative;
  box-shadow: 0 4px 24px rgba(0,0,0,0.5);
  line-height: 0; /* remove canvas gap */
}
.page-wrapper canvas { display: block; }
.page-overlay {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none; /* enabled per-rect */
}

/* RECTANGLE */
.rect-el {
  position: absolute;
  border: 2px solid var(--accent);
  border-radius: 2px;
  cursor: move;
  pointer-events: all;
  box-sizing: border-box;
}
.rect-el.selected { outline: 2px solid white; outline-offset: 2px; }
.rect-el .rect-label {
  position: absolute;
  top: -20px; left: 0;
  font-size: 11px;
  background: var(--accent);
  color: #fff;
  padding: 1px 4px;
  border-radius: 2px;
  white-space: nowrap;
  pointer-events: none;
}
/* Corner resize handles */
.resize-handle {
  position: absolute;
  width: 8px; height: 8px;
  background: white;
  border: 1px solid var(--accent);
  border-radius: 50%;
  pointer-events: all;
  z-index: 10;
}
.resize-handle.tl { top: -4px; left: -4px; cursor: nw-resize; }
.resize-handle.tr { top: -4px; right: -4px; cursor: ne-resize; }
.resize-handle.bl { bottom: -4px; left: -4px; cursor: sw-resize; }
.resize-handle.br { bottom: -4px; right: -4px; cursor: se-resize; }

/* PDF FIELD OVERLAY (red borders, toggleable) */
.pdf-field-el {
  position: absolute;
  border: 2px solid red;
  pointer-events: none;
  box-sizing: border-box;
}

/* PROPERTIES PANEL */
#properties-panel {
  width: 240px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  flex-shrink: 0;
}
#properties-panel.hidden { display: none; }
#properties-panel h3 { font-size: 14px; color: var(--text-muted); text-transform: uppercase;
  letter-spacing: 0.05em; }
#properties-panel label {
  display: flex; flex-direction: column; gap: 4px; font-size: 13px;
}
#properties-panel input[type=text],
#properties-panel select {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 13px;
  width: 100%;
}
#properties-panel input:focus,
#properties-panel select:focus {
  outline: none; border-color: var(--accent);
}
.muted { color: var(--text-muted); font-size: 12px; }

/* TOOLTIPS */
.tooltip-anchor {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px; height: 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 50%;
  font-size: 11px;
  cursor: default;
  position: relative;
  color: var(--text-muted);
  margin-left: 4px;
  flex-shrink: 0;
}
.tooltip-text {
  display: none;
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 1000;
  width: max-content;
  max-width: 240px;
  white-space: normal;
}
.tooltip-anchor:hover .tooltip-text { display: block; }

/* INFO FOOTER */
#info-section {
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
  padding: 16px 24px;
  font-size: 13px;
  color: var(--text-muted);
}
#info-section h4 { margin-bottom: 6px; color: var(--text-primary); }
```

- [ ] **Step 4: Create stub `js/main.js`**

```js
// main.js — app entry point (STUB for Task 1)
// Other modules (pdf-renderer, rect-manager, etc.) are created in Tasks 2-6.
// Until those tasks are done, opening index.html will show console module-not-found errors —
// that is expected at this stage. Task 1 verification only checks the HTML/CSS shell loads.
// Import order matters: renderer first, then rect-manager, interactions, panel, exporter

import { initRenderer } from './pdf-renderer.js';
import { initRectManager } from './rect-manager.js';
import { initInteractions } from './interactions.js';
import { initPanel } from './panel.js';
import { initExporter } from './exporter.js';

document.addEventListener('DOMContentLoaded', () => {
  initRectManager();
  const renderer = initRenderer();
  initInteractions(renderer);
  initPanel();
  initExporter(renderer);

  // Wire color picker → CSS custom property + rect-manager accent
  const colorInput = document.getElementById('rect-color');
  colorInput.addEventListener('input', () => {
    document.documentElement.style.setProperty('--accent', colorInput.value);
  });
  // Set initial accent
  document.documentElement.style.setProperty('--accent', colorInput.value);
});
```

- [ ] **Step 5: Verify in browser**

Open `index.html` directly in browser (or via Live Server). Expected: dark page loads, toolbar visible, "Upload a PDF to get started" shown. **Note:** Module-not-found errors for `pdf-renderer.js`, `rect-manager.js` etc. are expected at this stage — those modules are created in Tasks 2–6. Verify only that the HTML/CSS shell renders correctly.

- [ ] **Step 6: Commit**

```bash
cd pdf_form_mapper
git init
git add index.html .nojekyll css/styles.css js/main.js
git commit -m "feat: project scaffold, dark-mode shell, GitHub Pages ready"
```

---

## Task 2: PDF.js Integration — Upload and Render

**Files:**
- Create: `pdf_form_mapper/js/pdf-renderer.js`

- [ ] **Step 1: Write `pdf-renderer.js`**

```js
// pdf-renderer.js — handles PDF.js loading, rendering all pages, and annotation extraction

// PDF.js loaded via CDN in index.html — we access it as pdfjsLib on globalThis
// We do NOT store PDF bytes anywhere persistent; pdfDoc lives only in this module closure.

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs';

let pdfjsLib = null;
let pdfDoc = null;          // PDFDocumentProxy — kept in memory only
let pageAnnotations = {};   // { pageNum: [annotation, ...] }
let renderScale = 1.5;      // css pixels per pdf point
let fieldOverlayVisible = false;

/**
 * Load PDF.js dynamically, then return the renderer API.
 */
export async function initRenderer() {
  const module = await import(PDFJS_CDN);
  pdfjsLib = module;
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

  const pdfInput = document.getElementById('pdf-upload');
  pdfInput.addEventListener('change', (e) => _handleFileSelect(e));

  const toggleBtn = document.getElementById('btn-toggle-fields');
  toggleBtn.addEventListener('click', () => _toggleFieldOverlay());

  return {
    getPdfDoc: () => pdfDoc,
    getPageAnnotations: () => pageAnnotations,
    getRenderScale: () => renderScale,
    getPageCount: () => pdfDoc ? pdfDoc.numPages : 0,
    revokePdf,
  };
}

async function _handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file || file.type !== 'application/pdf') return;

  // Revoke previous PDF from memory
  revokePdf();

  // Read into ArrayBuffer — stays in JS memory only, never written to disk
  const arrayBuffer = await file.arrayBuffer();

  // Reset file input so same file can be re-uploaded
  e.target.value = '';

  pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  pageAnnotations = {};

  await _renderAllPages();
  await _extractAllAnnotations();

  // Enable toolbar buttons
  document.getElementById('btn-add-rect').disabled = false;
  document.getElementById('btn-toggle-fields').disabled = false;
  document.getElementById('btn-dl-json').disabled = false;
  document.getElementById('btn-dl-csv').disabled = false;

  // Hide drop hint
  document.getElementById('drop-hint').style.display = 'none';

  // Dispatch event so other modules know PDF is ready
  document.dispatchEvent(new CustomEvent('pdf-loaded', { detail: { pageCount: pdfDoc.numPages } }));
}

async function _renderAllPages() {
  const container = document.getElementById('pages-container');
  container.innerHTML = '';  // clear previous

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: renderScale });

    // Wrapper div
    const wrapper = document.createElement('div');
    wrapper.className = 'page-wrapper';
    wrapper.dataset.page = pageNum;
    wrapper.style.width = `${viewport.width}px`;
    wrapper.style.height = `${viewport.height}px`;

    // Canvas
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport }).promise;

    // Overlay div (receives rectangle DOM elements)
    const overlay = document.createElement('div');
    overlay.className = 'page-overlay';
    overlay.dataset.page = pageNum;

    wrapper.appendChild(canvas);
    wrapper.appendChild(overlay);
    container.appendChild(wrapper);
  }
}

async function _extractAllAnnotations() {
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const annotations = await page.getAnnotations();
    // Only keep widget annotations (form fields)
    pageAnnotations[pageNum] = annotations.filter(a => a.subtype === 'Widget');
  }
}

function _toggleFieldOverlay() {
  fieldOverlayVisible = !fieldOverlayVisible;
  const btn = document.getElementById('btn-toggle-fields');
  btn.classList.toggle('active', fieldOverlayVisible);

  // Remove existing field overlays
  document.querySelectorAll('.pdf-field-el').forEach(el => el.remove());

  if (!fieldOverlayVisible) return;

  // Render red-border overlays for each annotation
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page_annotations = pageAnnotations[pageNum] || [];
    const overlayEl = document.querySelector(`.page-overlay[data-page="${pageNum}"]`);
    if (!overlayEl) continue;

    const wrapper = overlayEl.parentElement;
    const canvasWidth = parseFloat(wrapper.style.width);
    const canvasHeight = parseFloat(wrapper.style.height);

    page_annotations.forEach(ann => {
      if (!ann.rect) return;
      // PDF coords: [x1, y1, x2, y2] with origin bottom-left
      // Canvas coords: origin top-left
      const [x1, y1, x2, y2] = ann.rect;
      // We need page height in PDF units; viewport height / renderScale gives it
      const pdfPageHeight = canvasHeight / renderScale;
      const cssX = x1 * renderScale;
      const cssY = (pdfPageHeight - y2) * renderScale;  // flip Y axis
      const cssW = (x2 - x1) * renderScale;
      const cssH = (y2 - y1) * renderScale;

      const el = document.createElement('div');
      el.className = 'pdf-field-el';
      el.style.left = `${cssX}px`;
      el.style.top = `${cssY}px`;
      el.style.width = `${cssW}px`;
      el.style.height = `${cssH}px`;
      overlayEl.appendChild(el);
    });
  }
}

/** Clear pdfDoc from memory */
export function revokePdf() {
  if (pdfDoc) {
    pdfDoc.destroy();
    pdfDoc = null;
  }
  pageAnnotations = {};
  fieldOverlayVisible = false;
}
```

- [ ] **Step 2: Add PDF.js script tag to `index.html`**

In `index.html`, the PDF.js module is imported dynamically inside `pdf-renderer.js` — no extra script tag needed. But add the `type="module"` check: verify that `<script type="module" src="js/main.js"></script>` is present (it was added in Task 1).

- [ ] **Step 3: Verify PDF rendering**

Open `index.html` in browser. Upload any PDF. Expected:
- All pages render in the viewer, stacked vertically
- No console errors
- "Toggle PDF Fields" button becomes enabled
- Clicking "Toggle PDF Fields" draws red borders over AcroForm fields

- [ ] **Step 4: Commit**

```bash
git add js/pdf-renderer.js index.html
git commit -m "feat: PDF.js integration, multi-page render, AcroForm field overlay"
```

---

## Task 3: Rectangle State Manager

**Files:**
- Create: `pdf_form_mapper/js/rect-manager.js`

The rect-manager is the single source of truth. All state lives here. Other modules call its API.

- [ ] **Step 1: Write `rect-manager.js`**

```js
// rect-manager.js — rectangle CRUD, validation, per-page storage

// State: { [pageNum]: [RectData, ...] }
// RectData: { id, label, type, x_pct, y_pct, w_pct, h_pct, color }

let rects = {};           // { pageNum: [RectData] }
let selectedId = null;    // currently selected rect id

function _uuid() {
  return Math.random().toString(36).slice(2, 10);
}

export function initRectManager() {
  rects = {};
  selectedId = null;
}

/** Create a new rect on given page with percentage coords */
export function addRect(pageNum, { x_pct, y_pct, w_pct, h_pct, color }) {
  const rect = {
    id: _uuid(),
    label: '',
    type: '',
    x_pct, y_pct, w_pct, h_pct,
    color: color || getComputedStyle(document.documentElement)
                      .getPropertyValue('--accent').trim(),
  };
  if (!rects[pageNum]) rects[pageNum] = [];
  rects[pageNum].push(rect);
  return rect;
}

export function updateRect(id, changes) {
  for (const page of Object.values(rects)) {
    const rect = page.find(r => r.id === id);
    if (rect) {
      Object.assign(rect, changes);
      return rect;
    }
  }
  return null;
}

export function deleteRect(id) {
  for (const [pageNum, page] of Object.entries(rects)) {
    const idx = page.findIndex(r => r.id === id);
    if (idx !== -1) {
      page.splice(idx, 1);
      return true;
    }
  }
  return false;
}

export function getRect(id) {
  for (const page of Object.values(rects)) {
    const rect = page.find(r => r.id === id);
    if (rect) return rect;
  }
  return null;
}

export function getPageRects(pageNum) {
  return rects[pageNum] || [];
}

export function getAllRects() {
  return rects;
}

/** Replace all rects (used when loading JSON) */
export function loadRects(newRects) {
  rects = newRects;
  selectedId = null;
}

export function getSelectedId() { return selectedId; }
export function setSelectedId(id) { selectedId = id; }

/**
 * Validate all rects: every rect must have label and type.
 * Returns array of error strings (empty = valid).
 */
export function validate() {
  const errors = [];
  for (const [pageNum, page] of Object.entries(rects)) {
    page.forEach((r, i) => {
      if (!r.label || r.label.trim() === '') {
        errors.push(`Page ${pageNum}, field #${i + 1}: missing label`);
      }
      if (!r.type) {
        errors.push(`Page ${pageNum}, field #${i + 1} (${r.label || 'unlabelled'}): missing type`);
      }
    });
  }
  return errors;
}
```

- [ ] **Step 2: Verify in browser console**

Open browser console and manually import + test:
```js
// In console (after app loads):
// These are ESM modules so you can't call them directly from console,
// but the pattern is verified by the next task's integration.
```

No errors expected when the module loads.

- [ ] **Step 3: Commit**

```bash
git add js/rect-manager.js
git commit -m "feat: rectangle state manager with CRUD and validation"
```

---

## Task 4: Rectangle Drawing (Click-Drag to Create)

**Files:**
- Create: `pdf_form_mapper/js/interactions.js`

This module handles three mouse interaction modes:
1. **Draw mode** (active when "Add Field" mode is on): click-drag on overlay creates a new rect
2. **Move mode**: drag an existing rect to reposition
3. **Resize mode**: drag a corner handle to resize

- [ ] **Step 1: Write `interactions.js`**

```js
// interactions.js — mouse event handling for draw/move/resize

import {
  addRect, updateRect, deleteRect, getRect,
  getPageRects, getSelectedId, setSelectedId,
} from './rect-manager.js';

let renderer = null;
let drawMode = false;

// Drag state
let dragState = null;
// dragState shape:
//   { type: 'draw', pageNum, overlay, startX, startY, el }
//   { type: 'move', rectId, overlay, startMouseX, startMouseY, origX_pct, origY_pct }
//   { type: 'resize', rectId, overlay, handle, startMouseX, startMouseY, origRect }

export function initInteractions(rendererRef) {
  renderer = rendererRef;

  document.getElementById('btn-add-rect').addEventListener('click', () => {
    drawMode = !drawMode;
    document.getElementById('btn-add-rect').classList.toggle('active', drawMode);
    document.getElementById('btn-add-rect').textContent = drawMode ? '✕ Cancel' : '+ Add Field';
  });

  document.addEventListener('pdf-loaded', () => {
    _attachOverlayListeners();
  });

  document.addEventListener('mousemove', _onMouseMove);
  document.addEventListener('mouseup', _onMouseUp);
}

function _attachOverlayListeners() {
  document.querySelectorAll('.page-overlay').forEach(overlay => {
    overlay.addEventListener('mousedown', _onOverlayMouseDown);
  });
}

function _onOverlayMouseDown(e) {
  const overlay = e.currentTarget;
  const pageNum = parseInt(overlay.dataset.page);

  if (drawMode) {
    e.stopPropagation();
    const { x, y } = _overlayCoords(overlay, e.clientX, e.clientY);
    // Create a temporary DOM element for live preview
    const el = document.createElement('div');
    el.className = 'rect-el drawing-preview';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = '0px';
    el.style.height = '0px';
    el.style.borderColor = getComputedStyle(document.documentElement)
                              .getPropertyValue('--accent').trim();
    overlay.appendChild(el);

    dragState = { type: 'draw', pageNum, overlay, startX: x, startY: y, el };
    return;
  }

  // If click on overlay background (not a rect), deselect
  if (e.target === overlay) {
    _deselectAll();
    document.dispatchEvent(new CustomEvent('rect-deselected'));
  }
}

function _onMouseMove(e) {
  if (!dragState) return;

  if (dragState.type === 'draw') {
    const { overlay, startX, startY, el } = dragState;
    const { x, y } = _overlayCoords(overlay, e.clientX, e.clientY);
    const left = Math.min(x, startX);
    const top = Math.min(y, startY);
    const width = Math.abs(x - startX);
    const height = Math.abs(y - startY);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    return;
  }

  if (dragState.type === 'move') {
    const { rectId, overlay, startMouseX, startMouseY, origX_pct, origY_pct } = dragState;
    const wrapper = overlay.parentElement;
    const W = wrapper.offsetWidth;
    const H = wrapper.offsetHeight;
    const dx = (e.clientX - startMouseX) / W;
    const dy = (e.clientY - startMouseY) / H;
    const rect = getRect(rectId);
    if (!rect) return;
    const newX = Math.max(0, Math.min(1 - rect.w_pct, origX_pct + dx));
    const newY = Math.max(0, Math.min(1 - rect.h_pct, origY_pct + dy));
    updateRect(rectId, { x_pct: newX, y_pct: newY });
    _rerenderRect(rectId, overlay);
    return;
  }

  if (dragState.type === 'resize') {
    const { rectId, overlay, handle, startMouseX, startMouseY, origRect } = dragState;
    const wrapper = overlay.parentElement;
    const W = wrapper.offsetWidth;
    const H = wrapper.offsetHeight;
    const dx = (e.clientX - startMouseX) / W;
    const dy = (e.clientY - startMouseY) / H;
    let { x_pct, y_pct, w_pct, h_pct } = origRect;

    if (handle === 'br') { w_pct = Math.max(0.01, w_pct + dx); h_pct = Math.max(0.01, h_pct + dy); }
    if (handle === 'bl') { x_pct = Math.min(origRect.x_pct + origRect.w_pct - 0.01, x_pct + dx); w_pct = Math.max(0.01, w_pct - dx); h_pct = Math.max(0.01, h_pct + dy); }
    if (handle === 'tr') { y_pct = Math.min(origRect.y_pct + origRect.h_pct - 0.01, y_pct + dy); w_pct = Math.max(0.01, w_pct + dx); h_pct = Math.max(0.01, h_pct - dy); }
    if (handle === 'tl') { x_pct += dx; y_pct += dy; w_pct = Math.max(0.01, w_pct - dx); h_pct = Math.max(0.01, h_pct - dy); }

    // Clamp to page bounds
    x_pct = Math.max(0, x_pct); y_pct = Math.max(0, y_pct);
    w_pct = Math.min(1 - x_pct, w_pct); h_pct = Math.min(1 - y_pct, h_pct);

    updateRect(rectId, { x_pct, y_pct, w_pct, h_pct });
    _rerenderRect(rectId, overlay);
    return;
  }
}

function _onMouseUp(e) {
  if (!dragState) return;

  if (dragState.type === 'draw') {
    const { pageNum, overlay, startX, startY, el } = dragState;
    overlay.removeChild(el);

    const { x, y } = _overlayCoords(overlay, e.clientX, e.clientY);
    const left = Math.min(x, startX);
    const top = Math.min(y, startY);
    const width = Math.abs(x - startX);
    const height = Math.abs(y - startY);

    if (width > 5 && height > 5) {  // ignore tiny accidental clicks
      const wrapper = overlay.parentElement;
      const W = wrapper.offsetWidth;
      const H = wrapper.offsetHeight;
      const color = getComputedStyle(document.documentElement)
                      .getPropertyValue('--accent').trim();
      const rect = addRect(pageNum, {
        x_pct: left / W,
        y_pct: top / H,
        w_pct: width / W,
        h_pct: height / H,
        color,
      });
      _renderRectEl(rect, overlay);
      _selectRect(rect.id, overlay);
    }

    // Exit draw mode after one rect
    drawMode = false;
    document.getElementById('btn-add-rect').classList.remove('active');
    document.getElementById('btn-add-rect').textContent = '+ Add Field';
  }

  dragState = null;
}

/** Render a rectangle DOM element from RectData */
export function renderRectEl(rect, overlay) {
  return _renderRectEl(rect, overlay);
}

function _renderRectEl(rect, overlay) {
  // Remove existing DOM element for this rect if any
  const existing = overlay.querySelector(`[data-rect-id="${rect.id}"]`);
  if (existing) existing.remove();

  const wrapper = overlay.parentElement;
  const W = wrapper.offsetWidth;
  const H = wrapper.offsetHeight;

  const el = document.createElement('div');
  el.className = 'rect-el';
  el.dataset.rectId = rect.id;
  el.style.left = `${rect.x_pct * W}px`;
  el.style.top = `${rect.y_pct * H}px`;
  el.style.width = `${rect.w_pct * W}px`;
  el.style.height = `${rect.h_pct * H}px`;
  el.style.borderColor = rect.color;

  // Label tag
  if (rect.label) {
    const labelEl = document.createElement('span');
    labelEl.className = 'rect-label';
    labelEl.textContent = rect.label;
    labelEl.style.background = rect.color;
    el.appendChild(labelEl);
  }

  // Corner resize handles
  ['tl', 'tr', 'bl', 'br'].forEach(pos => {
    const handle = document.createElement('div');
    handle.className = `resize-handle ${pos}`;
    handle.dataset.handle = pos;
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const r = getRect(rect.id);
      if (!r) return;
      dragState = {
        type: 'resize',
        rectId: rect.id,
        overlay,
        handle: pos,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        origRect: { ...r },
      };
    });
    el.appendChild(handle);
  });

  // Click: select
  el.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('resize-handle')) return;
    e.stopPropagation();
    _selectRect(rect.id, overlay);
    dragState = {
      type: 'move',
      rectId: rect.id,
      overlay,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      origX_pct: rect.x_pct,
      origY_pct: rect.y_pct,
    };
  });

  overlay.appendChild(el);
  return el;
}

function _rerenderRect(rectId, overlay) {
  const rect = getRect(rectId);
  if (rect) _renderRectEl(rect, overlay);
}

function _selectRect(id, overlay) {
  _deselectAll();
  setSelectedId(id);
  const el = overlay.querySelector(`[data-rect-id="${id}"]`);
  if (el) el.classList.add('selected');
  document.dispatchEvent(new CustomEvent('rect-selected', { detail: { id } }));
}

function _deselectAll() {
  document.querySelectorAll('.rect-el.selected').forEach(el => el.classList.remove('selected'));
  setSelectedId(null);
}

/** Called by exporter/panel to re-render all rects after JSON load */
export function reRenderAllRects(allRects) {
  // Clear all existing rect DOM elements
  document.querySelectorAll('.rect-el').forEach(el => el.remove());
  for (const [pageNum, pageRects] of Object.entries(allRects)) {
    const overlay = document.querySelector(`.page-overlay[data-page="${pageNum}"]`);
    if (!overlay) continue;
    pageRects.forEach(rect => _renderRectEl(rect, overlay));
  }
}

function _overlayCoords(overlay, clientX, clientY) {
  const bbox = overlay.getBoundingClientRect();
  return { x: clientX - bbox.left, y: clientY - bbox.top };
}
```

- [ ] **Step 2: Verify draw interaction**

Load a PDF. Click "+ Add Field". Click-drag on the PDF — a coloured rectangle appears. Click it — it gets a white outline (selected). Drag the rectangle — it moves. Drag a corner dot — it resizes. Click overlay background — deselected.

- [ ] **Step 3: Commit**

```bash
git add js/interactions.js
git commit -m "feat: rectangle draw, drag-move, corner-resize interactions"
```

---

## Task 5: Properties Panel

**Files:**
- Create: `pdf_form_mapper/js/panel.js`

- [ ] **Step 1: Write `panel.js`**

```js
// panel.js — properties panel: label, type, delete

import { getRect, updateRect, deleteRect, getSelectedId } from './rect-manager.js';
import { reRenderAllRects } from './interactions.js';
import { getAllRects } from './rect-manager.js';

export function initPanel() {
  const panel = document.getElementById('properties-panel');
  const labelInput = document.getElementById('prop-label');
  const typeSelect = document.getElementById('prop-type');
  const deleteBtn = document.getElementById('prop-delete');
  const noSelection = document.getElementById('prop-no-selection');

  function showPanel(id) {
    const rect = getRect(id);
    if (!rect) return;
    panel.classList.remove('hidden');
    labelInput.value = rect.label || '';
    typeSelect.value = rect.type || '';
    noSelection.style.display = 'none';
    labelInput.style.display = '';
    typeSelect.style.display = '';
    deleteBtn.style.display = '';
  }

  function hidePanel() {
    panel.classList.remove('hidden');
    labelInput.value = '';
    typeSelect.value = '';
    labelInput.style.display = 'none';
    typeSelect.style.display = 'none';
    deleteBtn.style.display = 'none';
    noSelection.style.display = '';
  }

  document.addEventListener('rect-selected', (e) => {
    showPanel(e.detail.id);
  });

  document.addEventListener('rect-deselected', () => {
    hidePanel();
  });

  document.addEventListener('pdf-loaded', () => {
    panel.classList.remove('hidden');
    hidePanel();
  });

  labelInput.addEventListener('input', () => {
    const id = getSelectedId();
    if (!id) return;
    updateRect(id, { label: labelInput.value });
    // Re-render just this rect's label
    const el = document.querySelector(`[data-rect-id="${id}"] .rect-label`);
    if (el) {
      el.textContent = labelInput.value;
    } else {
      // Label didn't exist yet — re-render the whole rect
      reRenderAllRects(getAllRects());
    }
  });

  typeSelect.addEventListener('change', () => {
    const id = getSelectedId();
    if (!id) return;
    updateRect(id, { type: typeSelect.value });
  });

  deleteBtn.addEventListener('click', () => {
    const id = getSelectedId();
    if (!id) return;
    deleteRect(id);
    const el = document.querySelector(`[data-rect-id="${id}"]`);
    if (el) el.remove();
    hidePanel();
  });

  // Hide inputs initially
  hidePanel();
}
```

- [ ] **Step 2: Verify properties panel**

Load PDF, draw rect. Click rect — panel shows label input, type dropdown, delete button. Type a label — label tag updates on the rect. Select type. Click Delete — rect disappears, panel clears.

- [ ] **Step 3: Commit**

```bash
git add js/panel.js
git commit -m "feat: properties panel with label, type, delete"
```

---

## Task 6: JSON Export and Import

**Files:**
- Create: `pdf_form_mapper/js/exporter.js`

- [ ] **Step 1: Write `exporter.js`**

```js
// exporter.js — JSON download, JSON upload/restore, CSV mapping download

import { getAllRects, loadRects, validate, getPageRects } from './rect-manager.js';
import { reRenderAllRects } from './interactions.js';

export function initExporter(renderer) {
  document.getElementById('btn-dl-json').addEventListener('click', () => _downloadJson());
  document.getElementById('btn-dl-csv').addEventListener('click', () => _downloadCsv(renderer));

  const jsonInput = document.getElementById('json-upload');
  jsonInput.addEventListener('change', (e) => _loadJson(e, renderer));
}

function _downloadJson() {
  const errors = validate();
  if (errors.length > 0) {
    alert('Cannot export JSON — fix these issues first:\n\n' + errors.join('\n'));
    return;
  }

  const allRects = getAllRects();
  const pages = [];

  for (const [pageNum, rects] of Object.entries(allRects)) {
    if (rects.length === 0) continue;
    pages.push({
      page: parseInt(pageNum),
      fields: rects.map(r => ({
        id: r.id,
        label: r.label,
        type: r.type,
        x_pct: r.x_pct,
        y_pct: r.y_pct,
        w_pct: r.w_pct,
        h_pct: r.h_pct,
        color: r.color,
      })),
    });
  }
  pages.sort((a, b) => a.page - b.page);

  const json = JSON.stringify({ version: '1.0', pages }, null, 2);
  _triggerDownload(json, 'mapping.json', 'application/json');
  // NOTE: PDF stays in viewer — we do NOT reset anything here
}

async function _downloadCsv(renderer) {
  if (!renderer.getPdfDoc()) {
    alert('Please load a PDF before exporting CSV.\nThe PDF is needed to match rectangles to actual field IDs.');
    return;
  }
  const errors = validate();
  if (errors.length > 0) {
    alert('Cannot export CSV — fix these issues first:\n\n' + errors.join('\n'));
    return;
  }

  const allRects = getAllRects();
  const annotations = renderer.getPageAnnotations();
  const scale = renderer.getRenderScale();

  const rows = [['key_name', 'pdf_field_id']];

  for (const [pageNum, rects] of Object.entries(allRects)) {
    const pageAnnotations = annotations[parseInt(pageNum)] || [];
    const wrapper = document.querySelector(`.page-wrapper[data-page="${pageNum}"]`);
    if (!wrapper) continue;
    const W = wrapper.offsetWidth;
    const H = wrapper.offsetHeight;

    rects.forEach(rect => {
      // Convert rect % coords to canvas pixels
      const rLeft = rect.x_pct * W;
      const rTop = rect.y_pct * H;
      const rRight = rLeft + rect.w_pct * W;
      const rBottom = rTop + rect.h_pct * H;

      // Find best-overlapping annotation
      let bestAnn = null;
      let bestOverlap = 0;

      const pdfPageHeight = H / scale;

      pageAnnotations.forEach(ann => {
        if (!ann.rect) return;
        const [x1, y1, x2, y2] = ann.rect;
        // Convert PDF coords to canvas pixels (flip Y)
        const aLeft = x1 * scale;
        const aTop = (pdfPageHeight - y2) * scale;
        const aRight = x2 * scale;
        const aBottom = (pdfPageHeight - y1) * scale;

        const overlapX = Math.max(0, Math.min(rRight, aRight) - Math.max(rLeft, aLeft));
        const overlapY = Math.max(0, Math.min(rBottom, aBottom) - Math.max(rTop, aTop));
        const overlap = overlapX * overlapY;
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestAnn = ann;
        }
      });

      const fieldId = bestAnn
        ? (bestAnn.fieldName || bestAnn.id || `unknown_${pageNum}`)
        : `no_match_${pageNum}`;
      rows.push([rect.label, fieldId]);
    });
  }

  // Build CSV with UTF-8 BOM (required for Excel to handle German/French chars correctly)
  const csvContent = rows
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const BOM = '\uFEFF';
  _triggerDownload(BOM + csvContent, 'mapping.csv', 'text/csv;charset=utf-8');
}

function _loadJson(e, renderer) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';  // allow re-uploading same file

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      if (!renderer.getPdfDoc()) {
        alert('Please load a PDF first before importing a JSON mapping.\nThe PDF must be rendered so rectangles can be displayed.');
        return;
      }
      const data = JSON.parse(ev.target.result);
      if (!data.pages || !Array.isArray(data.pages)) throw new Error('Invalid JSON structure');

      // Convert to internal format: { [pageNum]: [RectData] }
      const newRects = {};
      data.pages.forEach(p => {
        newRects[p.page] = (p.fields || []).map(f => ({
          id: f.id,
          label: f.label || '',
          type: f.type || '',
          x_pct: f.x_pct,
          y_pct: f.y_pct,
          w_pct: f.w_pct,
          h_pct: f.h_pct,
          color: f.color || '#4a9eff',
        }));
      });

      loadRects(newRects);
      reRenderAllRects(newRects);
      // PDF stays in viewer
    } catch (err) {
      alert('Failed to load JSON: ' + err.message);
    }
  };
  reader.readAsText(file, 'UTF-8');
}

function _triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Revoke immediately after download triggered
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

- [ ] **Step 2: Verify JSON export**

Load PDF, draw a rect, label it "test_field", set type "text". Click "Download JSON". Expected: downloads `mapping.json` with the correct percentage coords, label, type, page. PDF stays in viewer.

- [ ] **Step 3: Verify JSON import**

Click "Load JSON", upload the downloaded `mapping.json`. Expected: rectangles re-render in correct positions, PDF stays in viewer. Verify in panel by clicking a rect — label and type are populated.

- [ ] **Step 4: Verify CSV export**

Draw rects over known PDF form fields. Click "Download CSV". Expected: `mapping.csv` with `key_name,pdf_field_id` pairs, file opens correctly in Excel without character distortion.

- [ ] **Step 5: Verify validation blocking**

Draw a rect but leave label/type empty. Try Download JSON and Download CSV — both should show an alert listing the unlabelled field.

- [ ] **Step 6: Commit**

```bash
git add js/exporter.js
git commit -m "feat: JSON and CSV export/import with UTF-8 BOM and validation"
```

---

## Task 7: UI Polish — Accent Color Sync, Active States, Responsive Adjustments

**Files:**
- Modify: `pdf_form_mapper/css/styles.css`
- Modify: `pdf_form_mapper/index.html`

- [ ] **Step 1: Add active/toggle states for toolbar buttons**

In `styles.css`, add:
```css
/* Active/toggle state for toolbar buttons */
.btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

/* PDF field overlay button when active */
#btn-toggle-fields.active {
  border-color: #e74c3c;
  color: #e74c3c;
}
#btn-toggle-fields.active:hover {
  background: #e74c3c;
  color: #fff;
}
```

- [ ] **Step 2: Update rect color when accent changes**

In `main.js`, the color picker already sets `--accent`. But existing rects need their `borderColor` updated too. Update the color input handler:

```js
colorInput.addEventListener('input', () => {
  const color = colorInput.value;
  document.documentElement.style.setProperty('--accent', color);
  // Update all future rects — existing rects keep their original color
  // (by design: they were drawn with a specific color)
});
```

(Existing rects intentionally keep their color since they were drawn with it — the chosen color applies to newly drawn rects.)

- [ ] **Step 3: Add help text to tooltip placeholders**

In `index.html`, fill in the tooltip text for each `?` button:

```html
<!-- Toggle PDF Fields button tooltip -->
<span class="tooltip-anchor">?<span class="tooltip-text">
  Shows the actual form field boundaries embedded in the PDF (red outlines).
  Use this to verify your drawn rectangles align with the real fields.
</span></span>

<!-- Label tooltip in panel -->
<span class="tooltip-anchor">?<span class="tooltip-text">
  Enter the HTTP POST key name (e.g. "first_name") that this PDF field
  corresponds to. This is the key from the incoming POST request.
</span></span>

<!-- Type tooltip in panel -->
<span class="tooltip-anchor">?<span class="tooltip-text">
  text: a regular text input field<br>
  checkbox: a single on/off checkbox<br>
  radio: one of a group of radio buttons
</span></span>
```

(These are starter texts — the user said they will fill them in themselves.)

- [ ] **Step 4: Fill info section placeholder**

In `index.html`, update the footer:

```html
<footer id="info-section">
  <h4>About</h4>
  <p>
    This tool helps you create position-based JSON mappings for PDF forms
    without needing to track internal field IDs. PDFs are never stored —
    they exist only in your browser's memory and are cleared when you close the tab.
  </p>
  <p style="margin-top: 8px;">
    Questions or issues? <a href="mailto:PLACEHOLDER@example.com"
    style="color: var(--accent);">Contact PLACEHOLDER</a>
  </p>
</footer>
```

- [ ] **Step 5: Verify full flow end-to-end**

1. Upload PDF → renders all pages
2. Change rect color → picker updates CSS accent
3. Draw rects on multiple pages
4. Label each, set type
5. Toggle PDF field overlay → red borders appear/disappear
6. Download JSON → file downloads, PDF stays
7. Reload page, upload same PDF + JSON → rects restore correctly
8. Download CSV → opens in Excel without encoding errors
9. Enable "Toggle PDF Fields" (red borders) and compare with drawn rects — CSV fieldIds should correspond to visually overlapping red-bordered fields; confirm no `no_match_<pageNum>` entries for correctly drawn rects
10. Try importing JSON without a PDF loaded → should show "Please load a PDF first" alert

- [ ] **Step 6: Commit**

```bash
git add css/styles.css index.html js/main.js
git commit -m "feat: UI polish, active states, tooltip copy, info section"
```

---

## Task 8: Security Hardening

**Files:**
- Modify: `pdf_form_mapper/index.html`
- Modify: `pdf_form_mapper/js/pdf-renderer.js`

- [ ] **Step 1: Verify CSP meta tag is present and correct**

The CSP meta tag in `index.html` was set in Task 1 and already includes `connect-src 'none'`. Verify the meta tag in `index.html` matches exactly:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; worker-src blob:; img-src 'self' blob: data:; connect-src 'none';">
```

Notes:
- `connect-src 'none'` blocks all outbound fetches — prevents data exfiltration
- `'unsafe-inline'` for styles is required for dynamic accent color via `style.setProperty()` — this is an accepted trade-off; a server-side nonce could harden it further but is impossible on GitHub Pages static hosting
- `worker-src blob:` is required for PDF.js web worker (dynamically loaded via blob URL)

- [ ] **Step 2: Validate file inputs before processing**

In `pdf-renderer.js`, the `_handleFileSelect` function already checks `file.type === 'application/pdf'`. Also add a size limit:

```js
async function _handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.type !== 'application/pdf') {
    alert('Please upload a PDF file.');
    e.target.value = '';
    return;
  }
  if (file.size > 50 * 1024 * 1024) { // 50 MB limit
    alert('PDF too large (max 50 MB).');
    e.target.value = '';
    return;
  }
  // ... rest of handler
}
```

- [ ] **Step 3: Validate JSON input before processing**

In `exporter.js`, the `_loadJson` function already wraps parsing in try/catch. Also add size limit:

```js
reader.onload = (ev) => {
  if (ev.target.result.length > 5 * 1024 * 1024) { // 5 MB limit for JSON
    alert('JSON file too large.');
    return;
  }
  // ... rest of handler
};
```

- [ ] **Step 4: Sanitize label input to prevent XSS**

In `panel.js`, the `labelInput.value` is used as `textContent` (not `innerHTML`) in the label span — this is already safe. Confirm all rect label rendering uses `textContent`, not `innerHTML`. Grep for `innerHTML` in all JS files and ensure none set HTML from user input.

- [ ] **Step 5: Verify no localStorage usage**

Run in browser console:
```js
localStorage.length  // should be 0
sessionStorage.length  // should be 0
```

Open DevTools → Application → Local Storage → confirm empty.

- [ ] **Step 6: Commit**

```bash
git add index.html js/pdf-renderer.js js/exporter.js
git commit -m "security: CSP, file size limits, no localStorage, XSS prevention"
```

---

## Task 9: GitHub Pages Deployment

**Files:**
- Confirm: `pdf_form_mapper/.nojekyll` exists

- [ ] **Step 1: Create GitHub repo**

On GitHub.com:
- Create a new repository named `<your-username>.github.io` (for a personal page) OR any name (for a project page at `<username>.github.io/<reponame>`)
- Make it public

- [ ] **Step 2: Push code**

```bash
cd pdf_form_mapper
git remote add origin https://github.com/<username>/<reponame>.git
git branch -M main
git push -u origin main
```

- [ ] **Step 3: Enable GitHub Pages**

GitHub repo → Settings → Pages → Source: "Deploy from branch" → Branch: `main` → Folder: `/ (root)` → Save.

- [ ] **Step 4: Verify deployment**

Wait 1-2 minutes. Visit `https://<username>.github.io/<reponame>/`. Expected: app loads correctly, all features work in production. Check browser console for errors (especially CSP violations or CORS issues with PDF.js CDN).

- [ ] **Step 5: Final commit if adjustments needed**

```bash
git add -A
git commit -m "fix: production adjustments for GitHub Pages"
git push
```

---

## Security Notes Summary

| Risk | Mitigation |
|------|-----------|
| PDF stored on server | No server — purely client-side |
| PDF stored in localStorage | Never written — only in `ArrayBuffer` in closure |
| XSS via label input | All user content set via `textContent`, never `innerHTML` |
| Malicious JS in uploaded JSON | JSON.parse only reads data, never evals |
| Network data exfiltration | `connect-src 'none'` in CSP |
| Oversized file attacks | 50 MB PDF / 5 MB JSON size limits |
| External script injection | CSP restricts scripts to `self` + `cdnjs.cloudflare.com` only |

---

## Coordinate System Reference

PDF.js uses PDF coordinate space (origin: bottom-left, units: points). Canvas uses CSS pixels (origin: top-left).

**PDF → Canvas pixel conversion:**
```
canvasX = pdfX * renderScale
canvasY = (pdfPageHeight_in_points - pdfY) * renderScale
```

**Canvas pixel → percentage (for storage):**
```
x_pct = canvasX / canvasWidth
y_pct = canvasY / canvasHeight
```

**Percentage → Canvas pixel (for display):**
```
canvasX = x_pct * canvasWidth
canvasY = y_pct * canvasHeight
```
