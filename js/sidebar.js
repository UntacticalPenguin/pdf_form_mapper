// sidebar.js — left sidebar listing all drawn rectangles

import { getAllRects, getSelectedId, setSelectedId } from './rect-manager.js';

let _selectRectCallback = null;

/**
 * initSidebar(selectRectFn)
 * selectRectFn(id, overlay) — exported from interactions.js — selects a rect visually
 */
export function initSidebar(selectRectFn) {
  _selectRectCallback = selectRectFn;

  document.addEventListener('pdf-loaded', () => {
    document.getElementById('fields-sidebar').classList.remove('hidden');
    _render();
  });

  document.addEventListener('rect-list-changed', _render);

  document.addEventListener('rect-selected', (e) => {
    // Highlight the matching sidebar item
    document.querySelectorAll('.sidebar-item').forEach(el => {
      el.classList.toggle('active', el.dataset.rectId === e.detail.id);
    });
  });

  document.addEventListener('rect-deselected', () => {
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  });
}

function _render() {
  const list = document.getElementById('sidebar-list');
  const empty = document.getElementById('sidebar-empty');
  const allRects = getAllRects();
  const selectedId = getSelectedId();

  // Remove all existing sidebar items (keep #sidebar-empty)
  list.querySelectorAll('.sidebar-item').forEach(el => el.remove());

  let total = 0;
  // Iterate pages in order
  for (const pageNum of Object.keys(allRects).map(Number).sort((a, b) => a - b)) {
    const rects = allRects[pageNum];
    for (const rect of rects) {
      total++;
      const item = document.createElement('div');
      item.className = 'sidebar-item' + (rect.id === selectedId ? ' active' : '');
      item.dataset.rectId = rect.id;
      item.dataset.page = pageNum;

      const nameEl = document.createElement('div');
      nameEl.className = 'item-name';
      nameEl.textContent = rect.label || '(unnamed)';

      const metaEl = document.createElement('div');
      metaEl.className = 'item-meta';
      metaEl.textContent = `pg ${pageNum}${rect.type ? ' · ' + rect.type : ''}`;

      item.appendChild(nameEl);
      item.appendChild(metaEl);

      item.addEventListener('click', () => _onSidebarItemClick(rect.id, pageNum));
      list.appendChild(item);
    }
  }

  empty.style.display = total === 0 ? '' : 'none';
}

function _onSidebarItemClick(id, pageNum) {
  const overlay = document.querySelector(`.page-overlay[data-page="${pageNum}"]`);
  if (!overlay) return;
  if (_selectRectCallback) _selectRectCallback(id, overlay);

  // Scroll the PDF viewer so the rect is centred in view.
  // scrollIntoView stops at #pdf-viewer (the nearest overflow:auto ancestor);
  // outer containers are overflow:hidden so the page itself never scrolls.
  const rectEl = document.querySelector(`[data-rect-id="${id}"]`);
  rectEl?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
}
