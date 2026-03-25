// rect-manager.js — single source of truth for rectangle state
// All other modules read/write via this API, never touching state directly.

// RectData: { id, label, type, x_pct, y_pct, w_pct, h_pct, color }
// Coordinates are fractions of page dimensions (0.0–1.0), zoom-independent.

let rects = {};        // { [pageNum]: RectData[] }
let selectedId = null;

function _uuid() {
  return crypto.randomUUID();
}

export function initRectManager() {
  rects = {};
  selectedId = null;
}

/** Add a new rect on given page. Returns the created RectData. */
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

/** Update fields on a rect by id. Returns updated rect or null if not found. */
export function updateRect(id, changes) {
  for (const page of Object.values(rects)) {
    const rect = page.find(r => r.id === id);
    if (rect) { Object.assign(rect, changes); return rect; }
  }
  return null;
}

/** Remove a rect by id. Returns true if found and removed. */
export function deleteRect(id) {
  for (const [pageNum, page] of Object.entries(rects)) {
    const idx = page.findIndex(r => r.id === id);
    if (idx !== -1) {
      page.splice(idx, 1);
      if (selectedId === id) selectedId = null;
      return true;
    }
  }
  return false;
}

/** Get a single rect by id. */
export function getRect(id) {
  for (const page of Object.values(rects)) {
    const rect = page.find(r => r.id === id);
    if (rect) return rect;
  }
  return null;
}

export function getPageRects(pageNum) { return rects[pageNum] || []; }
export function getAllRects() { return rects; }

/** Replace all rects (used when loading JSON). */
export function loadRects(newRects) { rects = newRects; selectedId = null; }

export function getSelectedId() { return selectedId; }
export function setSelectedId(id) { selectedId = id; }

/**
 * Validate all rects: every rect must have label and type.
 * Returns array of human-readable error strings. Empty array = valid.
 */
export function validate() {
  const errors = [];
  for (const [pageNum, page] of Object.entries(rects)) {
    page.forEach((r, i) => {
      if (!r.label || r.label.trim() === '')
        errors.push(`Page ${pageNum}, field #${i + 1}: missing label`);
      if (!r.type)
        errors.push(`Page ${pageNum}, field #${i + 1} (${r.label || 'unlabelled'}): missing type`);
    });
  }
  return errors;
}
