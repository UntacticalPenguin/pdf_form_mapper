// panel.js — properties panel: edit label, type; delete rect

import { getRect, updateRect, deleteRect, getSelectedId } from './rect-manager.js';
import { removeRectElById, renderRectEl } from './interactions.js';

export function initPanel() {
  const panel      = document.getElementById('properties-panel');
  const labelInput = document.getElementById('prop-label');
  const typeSelect = document.getElementById('prop-type');
  const deleteBtn  = document.getElementById('prop-delete');
  const noSel      = document.getElementById('prop-no-selection');

  function _showFields(show) {
    labelInput.style.display = show ? '' : 'none';
    typeSelect.closest('label').style.display = show ? '' : 'none';
    deleteBtn.style.display  = show ? '' : 'none';
    noSel.style.display      = show ? 'none' : '';
  }

  // Shared delete logic — used by both the button and the keyboard shortcut.
  // Removes from state AND removes ALL matching DOM nodes (handles re-render duplicates).
  function _deleteSelected() {
    const id = getSelectedId();
    if (!id) return;
    deleteRect(id);
    removeRectElById(id);
    _showFields(false);
    document.dispatchEvent(new CustomEvent('rect-deselected'));
    document.dispatchEvent(new CustomEvent('rect-list-changed'));
  }

  // Always show panel after PDF loaded; hide input fields until rect selected
  document.addEventListener('pdf-loaded', () => {
    panel.classList.remove('hidden');
    _showFields(false);
  });

  document.addEventListener('rect-selected', (e) => {
    const rect = getRect(e.detail.id);
    if (!rect) return;
    labelInput.value = rect.label || '';
    typeSelect.value = rect.type  || '';
    _showFields(true);
  });

  document.addEventListener('rect-deselected', () => _showFields(false));

  // Live-update label — also refresh sidebar so the name updates there too
  labelInput.addEventListener('input', () => {
    const id = getSelectedId();
    if (!id) return;
    updateRect(id, { label: labelInput.value });
    document.dispatchEvent(new CustomEvent('rect-list-changed'));
  });

  typeSelect.addEventListener('change', () => {
    const id = getSelectedId();
    if (id) {
      updateRect(id, { type: typeSelect.value });
      document.dispatchEvent(new CustomEvent('rect-list-changed'));
    }
  });

  // Delete button
  deleteBtn.addEventListener('click', _deleteSelected);

  // Keyboard shortcut: Delete key (also "Entf" on German keyboards — same event)
  // Guard: do not fire while the user is typing in an input or select.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Delete' && e.code !== 'Delete') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    _deleteSelected();
  });

  // Arrow key nudge: move selected rect 1 CSS-layout-pixel in the pressed direction.
  // Guard: do not fire while the user is typing in an input or select.
  document.addEventListener('keydown', (e) => {
    if (!e.key.startsWith('Arrow')) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const id = getSelectedId();
    if (!id) return;
    e.preventDefault();

    const rect = getRect(id);
    if (!rect) return;
    // Locate the rect's DOM element to find its overlay (the scroll parent)
    const el = document.querySelector(`[data-rect-id="${id}"]`);
    const overlay = el?.parentElement;
    if (!overlay) return;

    const W = overlay.offsetWidth;
    const H = overlay.offsetHeight;
    const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    const dy = e.key === 'ArrowUp'   ? -1 : e.key === 'ArrowDown'  ? 1 : 0;

    const newX = Math.max(0, Math.min(1 - rect.w_pct, rect.x_pct + dx / W));
    const newY = Math.max(0, Math.min(1 - rect.h_pct, rect.y_pct + dy / H));
    updateRect(id, { x_pct: newX, y_pct: newY });
    renderRectEl(getRect(id), overlay);
  });

  // Init: hide fields (panel itself remains hidden until PDF loads)
  _showFields(false);
}
