// interactions.js — mouse interactions: draw new rect, move, corner-resize, select

import {
  addRect, updateRect, getRect, setSelectedId, getSelectedId,
} from './rect-manager.js';

let drawMode = false;
let dragState = null;
// dragState shapes:
//   draw:   { type:'draw',   pageNum, overlay, startX, startY, previewEl }
//   move:   { type:'move',   rectId, overlay, startMX, startMY, origX, origY }
//   resize: { type:'resize', rectId, overlay, handle, startMX, startMY, origRect }

export function initInteractions(renderer) {
  // "Add Field" button toggles draw mode
  document.getElementById('btn-add-rect').addEventListener('click', () => {
    drawMode = !drawMode;
    const btn = document.getElementById('btn-add-rect');
    btn.classList.toggle('active', drawMode);
    btn.textContent = drawMode ? '✕ Cancel' : '+ Add Field';
    _updateOverlayCursors();
  });

  // Reset draw mode and re-attach overlay listeners after each PDF load
  document.addEventListener('pdf-loaded', () => {
    drawMode = false;
    document.getElementById('btn-add-rect').classList.remove('active');
    document.getElementById('btn-add-rect').textContent = '+ Add Field';
    _attachOverlayListeners();
    _updateOverlayCursors();
  });

  // Global move/up handlers (must be on document to handle fast mouse moves)
  document.addEventListener('mousemove', _onMouseMove);
  document.addEventListener('mouseup', _onMouseUp);

  // Cancel any in-progress drag if the window loses focus (e.g. Alt+Tab)
  window.addEventListener('blur', _cancelDrag);
  document.addEventListener('pointercancel', _cancelDrag);
}

function _attachOverlayListeners() {
  document.querySelectorAll('.page-overlay').forEach(overlay => {
    overlay.removeEventListener('mousedown', _onOverlayMouseDown);
    overlay.addEventListener('mousedown', _onOverlayMouseDown);
  });
}

function _updateOverlayCursors() {
  document.querySelectorAll('.page-overlay').forEach(overlay => {
    overlay.classList.toggle('draw-mode', drawMode);
  });
}

function _onOverlayMouseDown(e) {
  const overlay = e.currentTarget;
  const pageNum = parseInt(overlay.dataset.page, 10);

  if (drawMode) {
    e.stopPropagation();
    const { x, y } = _relCoords(overlay, e.clientX, e.clientY);
    const previewEl = document.createElement('div');
    previewEl.className = 'rect-el';
    previewEl.style.borderColor = document.getElementById('rect-color').value;
    previewEl.style.left = `${x}px`;
    previewEl.style.top  = `${y}px`;
    previewEl.style.width  = '0px';
    previewEl.style.height = '0px';
    overlay.appendChild(previewEl);
    dragState = { type: 'draw', pageNum, overlay, startX: x, startY: y, previewEl };
    return;
  }

  // Click on overlay background — deselect
  if (e.target === overlay) {
    _deselectAll();
    document.dispatchEvent(new CustomEvent('rect-deselected'));
  }
}

function _onMouseMove(e) {
  if (!dragState) return;

  if (dragState.type === 'draw') {
    const { overlay, startX, startY, previewEl } = dragState;
    const { x, y } = _relCoords(overlay, e.clientX, e.clientY);
    previewEl.style.left   = `${Math.min(x, startX)}px`;
    previewEl.style.top    = `${Math.min(y, startY)}px`;
    previewEl.style.width  = `${Math.abs(x - startX)}px`;
    previewEl.style.height = `${Math.abs(y - startY)}px`;
    return;
  }

  if (dragState.type === 'move') {
    const { rectId, overlay, startMX, startMY, origX, origY } = dragState;
    const { W, H } = _overlaySize(overlay);
    const rect = getRect(rectId);
    if (!rect) return;
    const newX = Math.max(0, Math.min(1 - rect.w_pct, origX + (e.clientX - startMX) / W));
    const newY = Math.max(0, Math.min(1 - rect.h_pct, origY + (e.clientY - startMY) / H));
    updateRect(rectId, { x_pct: newX, y_pct: newY });
    _rerenderRect(rectId, overlay);
    return;
  }

  if (dragState.type === 'resize') {
    const { rectId, overlay, handle, startMX, startMY, origRect } = dragState;
    const { W, H } = _overlaySize(overlay);
    const dx = (e.clientX - startMX) / W;
    const dy = (e.clientY - startMY) / H;
    let { x_pct, y_pct, w_pct, h_pct } = origRect;

    if (handle === 'br') { w_pct = Math.max(0.01, w_pct + dx); h_pct = Math.max(0.01, h_pct + dy); }
    if (handle === 'bl') { x_pct += dx; w_pct = Math.max(0.01, w_pct - dx); h_pct = Math.max(0.01, h_pct + dy); }
    if (handle === 'tr') { y_pct += dy; w_pct = Math.max(0.01, w_pct + dx); h_pct = Math.max(0.01, h_pct - dy); }
    if (handle === 'tl') { x_pct += dx; y_pct += dy; w_pct = Math.max(0.01, w_pct - dx); h_pct = Math.max(0.01, h_pct - dy); }

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
    const { pageNum, overlay, startX, startY, previewEl } = dragState;
    previewEl.remove();

    const { x, y } = _relCoords(overlay, e.clientX, e.clientY);
    const left = Math.min(x, startX), top = Math.min(y, startY);
    const width = Math.abs(x - startX), height = Math.abs(y - startY);

    if (width > 5 && height > 5) {
      const { W, H } = _overlaySize(overlay);
      const color = document.getElementById('rect-color').value;
      const rect = addRect(pageNum, {
        x_pct: left / W, y_pct: top / H,
        w_pct: width / W, h_pct: height / H,
        color,
      });
      renderRectEl(rect, overlay);
      _selectRect(rect.id, overlay);
      document.dispatchEvent(new CustomEvent('rect-list-changed'));
    }

    // Exit draw mode
    drawMode = false;
    document.getElementById('btn-add-rect').classList.remove('active');
    document.getElementById('btn-add-rect').textContent = '+ Add Field';
    _updateOverlayCursors();
  }

  dragState = null;
}

/** Build and insert a rect DOM element. Exported for use by panel and exporter. */
export function renderRectEl(rect, overlay) {
  // Remove stale element if re-rendering
  overlay.querySelector(`[data-rect-id="${rect.id}"]`)?.remove();

  const { W, H } = _overlaySize(overlay);
  const el = document.createElement('div');
  el.className = 'rect-el';
  // Preserve selected state when re-rendering during drag
  if (rect.id === getSelectedId()) el.classList.add('selected');
  el.dataset.rectId = rect.id;
  el.style.left   = `${rect.x_pct * W}px`;
  el.style.top    = `${rect.y_pct * H}px`;
  el.style.width  = `${rect.w_pct * W}px`;
  el.style.height = `${rect.h_pct * H}px`;
  el.style.borderColor = rect.color;

  // Four corner resize handles
  for (const pos of ['tl', 'tr', 'bl', 'br']) {
    const h = document.createElement('div');
    h.className = `resize-handle ${pos}`;
    h.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const r = getRect(rect.id);
      if (!r) return;
      dragState = {
        type: 'resize', rectId: rect.id, overlay, handle: pos,
        startMX: e.clientX, startMY: e.clientY, origRect: { ...r },
      };
    });
    el.appendChild(h);
  }

  // First click → select only. Second click (already selected) → start move drag.
  el.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('resize-handle')) return;
    e.stopPropagation();
    const alreadySelected = rect.id === getSelectedId();
    _selectRect(rect.id, overlay);
    if (alreadySelected) {
      const r = getRect(rect.id);
      if (!r) return;
      dragState = {
        type: 'move', rectId: rect.id, overlay,
        startMX: e.clientX, startMY: e.clientY,
        origX: r.x_pct, origY: r.y_pct,
      };
    }
  });

  overlay.appendChild(el);
  return el;
}

/** Re-render all rects from allRects state. Used after JSON load. */
export function reRenderAllRects(allRects) {
  document.querySelectorAll('.rect-el').forEach(el => el.remove());
  for (const [pageNum, pageRects] of Object.entries(allRects)) {
    const overlay = document.querySelector(`.page-overlay[data-page="${pageNum}"]`);
    if (!overlay) continue;
    for (const rect of pageRects) renderRectEl(rect, overlay);
  }
  document.dispatchEvent(new CustomEvent('rect-list-changed'));
}

/**
 * Programmatically select a rect by id — used by the sidebar.
 * Exported so sidebar.js can call it without coupling to dragState.
 */
export function selectRectById(id, overlay) {
  _selectRect(id, overlay);
}

function _rerenderRect(rectId, overlay) {
  const rect = getRect(rectId);
  if (rect) renderRectEl(rect, overlay);
}

function _selectRect(id, overlay) {
  _deselectAll();
  setSelectedId(id);
  overlay.querySelector(`[data-rect-id="${id}"]`)?.classList.add('selected');
  document.dispatchEvent(new CustomEvent('rect-selected', { detail: { id } }));
}

function _deselectAll() {
  document.querySelectorAll('.rect-el.selected').forEach(el => el.classList.remove('selected'));
  setSelectedId(null);
}

function _relCoords(overlay, clientX, clientY) {
  const bbox = overlay.getBoundingClientRect();
  return { x: clientX - bbox.left, y: clientY - bbox.top };
}

function _overlaySize(overlay) {
  const r = overlay.getBoundingClientRect();
  return { W: r.width, H: r.height };
}

function _cancelDrag() {
  if (!dragState) return;
  if (dragState.type === 'draw') dragState.previewEl?.remove();
  dragState = null;
}
