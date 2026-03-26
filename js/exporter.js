// exporter.js — JSON download, JSON upload/restore, CSV mapping download

import { getAllRects, loadRects, validate } from './rect-manager.js';
import { reRenderAllRects } from './interactions.js';
import { matchRectsToAnnotations } from './coord-utils.js';

export function initExporter(renderer) {
  document.getElementById('btn-dl-json').addEventListener('click', () => _downloadJson(renderer));
  document.getElementById('btn-dl-csv').addEventListener('click', () => _downloadCsv(renderer));

  const jsonInput = document.getElementById('json-upload');
  jsonInput.addEventListener('change', (e) => _loadJson(e, renderer));
}

function _downloadJson(renderer) {
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
      page: parseInt(pageNum, 10),
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
  _triggerDownload(json, `${renderer.getPdfBaseName()}_mapping.json`, 'application/json');
  // NOTE: PDF stays in viewer — nothing is reset here
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
    const pageAnnotations = annotations[parseInt(pageNum, 10)] || [];
    const wrapper = document.querySelector(`.page-wrapper[data-page="${pageNum}"]`);
    if (!wrapper) continue;

    // offsetWidth/offsetHeight are CSS layout dimensions (zoom-independent).
    // getBoundingClientRect() would return post-zoom viewport dimensions and break matching.
    const pageW = wrapper.offsetWidth;
    const pageH = wrapper.offsetHeight;

    const matches = matchRectsToAnnotations(rects, pageAnnotations, pageW, pageH, scale);
    for (const { rect, ann } of matches) {
      const fieldId = ann
        ? (ann.fieldName || ann.id || `unknown_p${pageNum}`)
        : `no_match_p${pageNum}`;
      rows.push([rect.label, fieldId]);
    }
  }

  // UTF-8 BOM ensures Excel opens with correct encoding for German/French characters
  const csvContent = rows
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  _triggerDownload('\uFEFF' + csvContent, `${renderer.getPdfBaseName()}_mapping.csv`, 'text/csv;charset=utf-8');
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
      if (ev.target.result.length > 5 * 1024 * 1024) {
        alert('JSON file too large (max 5 MB).');
        return;
      }
      const data = JSON.parse(ev.target.result);
      if (!data.pages || !Array.isArray(data.pages)) throw new Error('Invalid JSON structure: missing pages array');

      // Build internal rect state from JSON
      const newRects = {};
      for (const p of data.pages) {
        if (typeof p.page !== 'number') continue;
        newRects[p.page] = (p.fields || []).map(f => ({
          // Sanitize id to alphanumeric to prevent CSS selector injection
          id: String(f.id || '').replace(/[^a-zA-Z0-9-]/g, '') || crypto.randomUUID(),
          label: String(f.label || ''),
          type:  ['text', 'checkbox', 'radio'].includes(f.type) ? f.type : '',
          x_pct: Math.max(0, Math.min(1, Number(f.x_pct) || 0)),
          y_pct: Math.max(0, Math.min(1, Number(f.y_pct) || 0)),
          w_pct: Math.max(0.01, Math.min(1, Number(f.w_pct) || 0.1)),
          h_pct: Math.max(0.01, Math.min(1, Number(f.h_pct) || 0.05)),
          color: /^#[0-9a-fA-F]{6}$/.test(f.color) ? f.color : '#4a9eff',
        }));
      }

      loadRects(newRects);
      reRenderAllRects(newRects);
      // PDF stays in viewer — nothing is closed or reset
    } catch (err) {
      alert(`Failed to load JSON: ${err.message || err}`);
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
