// panel.js — properties panel: edit label, type; delete rect

import { getRect, updateRect, deleteRect, getSelectedId } from './rect-manager.js';

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
    document.querySelectorAll(`[data-rect-id="${id}"]`).forEach(el => el.remove());
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
    if (e.key !== 'Delete') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    _deleteSelected();
  });

  // Init: hide fields (panel itself remains hidden until PDF loads)
  _showFields(false);
}
