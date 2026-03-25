import { initRenderer } from './pdf-renderer.js';
import { initRectManager } from './rect-manager.js';
import { initInteractions } from './interactions.js';
import { initPanel } from './panel.js';
import { initExporter } from './exporter.js';

document.addEventListener('DOMContentLoaded', async () => {
  initRectManager();
  const renderer = await initRenderer();
  initInteractions(renderer);
  initPanel();
  initExporter(renderer);

  // Clear rectangle state whenever a new PDF is loaded (re-upload)
  document.addEventListener('pdf-loaded', () => {
    initRectManager();
    document.dispatchEvent(new CustomEvent('rect-deselected'));
  });

  // Wire color picker → CSS custom property
  const colorInput = document.getElementById('rect-color');
  colorInput.addEventListener('input', () => {
    document.documentElement.style.setProperty('--accent', colorInput.value);
  });
  // Set initial accent
  document.documentElement.style.setProperty('--accent', colorInput.value);
});