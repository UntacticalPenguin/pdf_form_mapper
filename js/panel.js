// panel.js — properties panel: edit label, type; delete rect

import { getRect, updateRect, deleteRect, getSelectedId } from './rect-manager.js';
import { renderRectEl } from './interactions.js';

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

  deleteBtn.addEventListener('click', () => {
    const id = getSelectedId();
    if (!id) return;
    deleteRect(id);
    document.querySelector(`[data-rect-id="${id}"]`)?.remove();
    _showFields(false);
    document.dispatchEvent(new CustomEvent('rect-deselected'));
    document.dispatchEvent(new CustomEvent('rect-list-changed'));
  });

  // Init: hide fields (panel itself remains hidden until PDF loads)
  _showFields(false);
}
