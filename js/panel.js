// panel.js — properties panel: edit label, type; delete rect

import { getRect, updateRect, deleteRect, getSelectedId } from './rect-manager.js';
import { reRenderAllRects, renderRectEl } from './interactions.js';
import { getAllRects } from './rect-manager.js';

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

  // Live-update label text on the rect element
  labelInput.addEventListener('input', () => {
    const id = getSelectedId();
    if (!id) return;
    updateRect(id, { label: labelInput.value });

    // Try to update existing label span first; if absent, re-render the whole rect
    const rectEl = document.querySelector(`[data-rect-id="${id}"]`);
    if (!rectEl) return;
    let lbl = rectEl.querySelector('.rect-label');
    if (lbl) {
      lbl.textContent = labelInput.value;  // safe: textContent, not innerHTML
    } else if (labelInput.value) {
      // Label tag didn't exist — re-render rect to add it
      const overlay = rectEl.closest('.page-overlay');
      if (overlay) renderRectEl(getRect(id), overlay);
    }
  });

  typeSelect.addEventListener('change', () => {
    const id = getSelectedId();
    if (id) updateRect(id, { type: typeSelect.value });
  });

  deleteBtn.addEventListener('click', () => {
    const id = getSelectedId();
    if (!id) return;
    deleteRect(id);
    document.querySelector(`[data-rect-id="${id}"]`)?.remove();
    _showFields(false);
  });

  // Init: hide fields (panel itself remains hidden until PDF loads)
  _showFields(false);
}
