import { initRenderer } from './pdf-renderer.js';
import { initRectManager } from './rect-manager.js';
import { initInteractions, selectRectById } from './interactions.js';
import { initPanel } from './panel.js';
import { initExporter } from './exporter.js';
import { initSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
  initRectManager();
  const renderer = await initRenderer();
  initInteractions(renderer);
  initPanel();
  initExporter(renderer);
  initSidebar(selectRectById);

  // Clear rectangle state whenever a new PDF is loaded (re-upload)
  document.addEventListener('pdf-loaded', () => {
    initRectManager();
    document.dispatchEvent(new CustomEvent('rect-deselected'));
    document.dispatchEvent(new CustomEvent('rect-list-changed'));
    _resetZoom();
  });

  // Color picker → rect border color only (not --accent, which is now a fixed sky blue)
  // The value is read directly in interactions.js via document.getElementById('rect-color').value
  // No --accent wiring needed here.

  // ── LIGHT / DARK MODE TOGGLE ──────────────────────────────────────────────
  const btnTheme = document.getElementById('btn-theme');
  btnTheme.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-mode');
    btnTheme.textContent = isLight ? 'Dark Mode' : 'Light Mode';
  });

  // ── GLOBAL TOOLTIP (position:fixed, escapes all overflow clipping) ─────────
  const tooltip = document.getElementById('global-tooltip');
  document.querySelectorAll('.tooltip-anchor[data-tooltip]').forEach(anchor => {
    anchor.addEventListener('mouseenter', () => {
      tooltip.textContent = anchor.dataset.tooltip;
      // Measure first (hidden but block-formatted)
      tooltip.style.visibility = 'hidden';
      tooltip.classList.add('visible');
      const anchorRect = anchor.getBoundingClientRect();
      const tipW = tooltip.offsetWidth;
      const tipH = tooltip.offsetHeight;
      // Default: above the anchor, horizontally centered
      let left = anchorRect.left + anchorRect.width / 2 - tipW / 2;
      let top  = anchorRect.top - tipH - 6;
      // If above would clip at top, show below instead
      if (top < 4) top = anchorRect.bottom + 6;
      // Clamp horizontally within viewport
      left = Math.max(4, Math.min(window.innerWidth - tipW - 4, left));
      tooltip.style.left = `${left}px`;
      tooltip.style.top  = `${top}px`;
      tooltip.style.visibility = '';
    });
    anchor.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
    });
  });

  // ── PDF-AREA ZOOM (wheel inside #pdf-viewer only) ─────────────────────────
  const pdfViewer    = document.getElementById('pdf-viewer');
  const pagesContainer = document.getElementById('pages-container');
  const zoomContainer  = document.getElementById('zoom-container');
  let currentZoom = 1.0;
  const MIN_ZOOM  = 0.25;
  const MAX_ZOOM  = 4.0;
  const ZOOM_STEP = 0.1;

  pdfViewer.addEventListener('wheel', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const direction = e.deltaY < 0 ? 1 : -1;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + direction * ZOOM_STEP));
    if (Math.abs(newZoom - currentZoom) < 0.001) return;
    currentZoom = newZoom;
    _applyZoom();
  }, { passive: false });

  function _applyZoom() {
    pagesContainer.style.transform = currentZoom === 1 ? '' : `scale(${currentZoom})`;
    // offsetWidth/Height are layout (pre-transform) dimensions — multiply by zoom
    // to give the scroll container the correct scrollable area.
    const natW = pagesContainer.offsetWidth;
    const natH = pagesContainer.offsetHeight;
    zoomContainer.style.width  = currentZoom === 1 ? '' : `${natW * currentZoom}px`;
    zoomContainer.style.height = currentZoom === 1 ? '' : `${natH * currentZoom}px`;
  }

  function _resetZoom() {
    currentZoom = 1.0;
    pagesContainer.style.transform = '';
    zoomContainer.style.width  = '';
    zoomContainer.style.height = '';
  }
});
