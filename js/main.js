// main.js — app entry point (STUB for Task 1)
// Other modules (pdf-renderer, rect-manager, etc.) are created in Tasks 2-6.
// Until those tasks are done, opening index.html will show console module-not-found errors —
// that is expected at this stage. Task 1 verification only checks the HTML/CSS shell loads.
// Import order matters: renderer first, then rect-manager, interactions, panel, exporter

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

  // Wire color picker → CSS custom property
  const colorInput = document.getElementById('rect-color');
  colorInput.addEventListener('input', () => {
    document.documentElement.style.setProperty('--accent', colorInput.value);
  });
  // Set initial accent
  document.documentElement.style.setProperty('--accent', colorInput.value);
});