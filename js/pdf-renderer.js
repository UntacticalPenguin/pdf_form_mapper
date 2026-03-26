// pdf-renderer.js — handles PDF.js loading, rendering all pages, and annotation extraction

// PDF.js loaded dynamically from CDN — kept in module closure only (never written to disk/storage)

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs';

let pdfjsLib = null;
let pdfDoc = null;          // PDFDocumentProxy — kept in memory only, never persisted
let pageAnnotations = {};   // { pageNum: [annotation, ...] }
let renderScale = 1;      // css pixels per pdf point
let fieldOverlayVisible = false;

/**
 * Loads PDF.js from CDN and wires up the file input and toggle button.
 * Returns the renderer API object.
 */
export async function initRenderer() {
  const module = await import(PDFJS_CDN);
  pdfjsLib = module;
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

  document.getElementById('pdf-upload').addEventListener('change', _handleFileSelect);
  document.getElementById('btn-toggle-fields').addEventListener('click', _toggleFieldOverlay);

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
  if (!file) return;
  if (file.type !== 'application/pdf') {
    alert('Please upload a PDF file.');
    e.target.value = '';
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    alert('PDF too large (max 50 MB).');
    e.target.value = '';
    return;
  }

  revokePdf();

  try {
    // Read into ArrayBuffer — stays in JS memory only, never written to disk or storage
    const arrayBuffer = await file.arrayBuffer();
    e.target.value = '';  // allow re-uploading same file

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

    // Notify other modules
    document.dispatchEvent(new CustomEvent('pdf-loaded', { detail: { pageCount: pdfDoc.numPages } }));
  } catch (err) {
    revokePdf();
    alert(`Failed to load PDF: ${err.message || err}`);
    e.target.value = '';
  }
}

async function _renderAllPages() {
  const container = document.getElementById('pages-container');
  container.innerHTML = '';

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: renderScale });

    const wrapper = document.createElement('div');
    wrapper.className = 'page-wrapper';
    wrapper.dataset.page = pageNum;
    wrapper.style.width = `${viewport.width}px`;
    wrapper.style.height = `${viewport.height}px`;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

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
    // Filter to Widget annotations with valid rect (skip null-rect annotations)
    pageAnnotations[pageNum] = annotations.filter(a => a.subtype === 'Widget' && a.rect);
  }
}

function _toggleFieldOverlay() {
  if (!pdfDoc) return;
  fieldOverlayVisible = !fieldOverlayVisible;
  document.getElementById('btn-toggle-fields').classList.toggle('active', fieldOverlayVisible);

  // Remove existing field overlays
  document.querySelectorAll('.pdf-field-el').forEach(el => el.remove());

  if (!fieldOverlayVisible) return;

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const annots = pageAnnotations[pageNum] || [];
    const overlayEl = document.querySelector(`.page-overlay[data-page="${pageNum}"]`);
    if (!overlayEl) continue;

    const wrapper = overlayEl.parentElement;
    const canvasHeight = parseFloat(wrapper.style.height);
    const pdfPageHeight = canvasHeight / renderScale;

    annots.forEach(ann => {
      if (!ann.rect) return;
      const [x1, y1, x2, y2] = ann.rect;
      // Convert PDF coords (origin: bottom-left) → CSS pixels (origin: top-left)
      const el = document.createElement('div');
      el.className = 'pdf-field-el';
      el.style.left   = `${x1 * renderScale}px`;
      el.style.top    = `${(pdfPageHeight - y2) * renderScale}px`;
      el.style.width  = `${(x2 - x1) * renderScale}px`;
      el.style.height = `${(y2 - y1) * renderScale}px`;
      overlayEl.appendChild(el);
    });
  }
}

/** Destroy pdfDoc and clear all state — PDF bytes released from memory */
export function revokePdf() {
  if (pdfDoc) {
    pdfDoc.destroy();
    pdfDoc = null;
  }
  pageAnnotations = {};
  // Clean up overlay DOM elements and button active state
  document.querySelectorAll('.pdf-field-el').forEach(el => el.remove());
  document.getElementById('btn-toggle-fields')?.classList.remove('active');
  fieldOverlayVisible = false;
}
