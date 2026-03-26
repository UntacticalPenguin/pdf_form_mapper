// coord-utils.js — pure coordinate conversion and rect-to-annotation matching
//
// Coordinate systems used in this app:
//
//   PDF space   — points, origin bottom-left, Y increases upward.
//                 This is what ann.rect contains: [x1, y1, x2, y2].
//
//   CSS layout  — pixels, origin top-left, Y increases downward.
//                 Equal to (PDF points × renderScale).
//                 This is what rect x_pct/y_pct/w_pct/h_pct reference:
//                 fractions of wrapper.offsetWidth / wrapper.offsetHeight.
//                 MUST use offsetWidth/offsetHeight (layout), never
//                 getBoundingClientRect() (post-zoom viewport).

/**
 * Convert a PDF annotation rect to CSS-layout-pixel coords.
 *
 * @param {number[]} annRect  - [x1, y1, x2, y2] in PDF points, bottom-left origin
 * @param {number}   pageH    - page height in CSS layout pixels (wrapper.offsetHeight)
 * @param {number}   renderScale - CSS layout pixels per PDF point (getRenderScale())
 * @returns {{ l, t, r, b }} in CSS layout pixels, top-left origin
 */
export function annToCssRect(annRect, pageH, renderScale) {
  const [x1, y1, x2, y2] = annRect;
  const pdfPageH = pageH / renderScale;
  return {
    l: x1 * renderScale,
    t: (pdfPageH - y2) * renderScale,
    r: x2 * renderScale,
    b: (pdfPageH - y1) * renderScale,
  };
}

/**
 * Convert a stored rect (percentage-based) to CSS-layout-pixel coords.
 *
 * @param {{ x_pct, y_pct, w_pct, h_pct }} rect
 * @param {number} pageW - CSS layout width  (wrapper.offsetWidth)
 * @param {number} pageH - CSS layout height (wrapper.offsetHeight)
 * @returns {{ l, t, r, b }} in CSS layout pixels, top-left origin
 */
export function rectToCssRect(rect, pageW, pageH) {
  const l = rect.x_pct * pageW;
  const t = rect.y_pct * pageH;
  return {
    l,
    t,
    r: l + rect.w_pct * pageW,
    b: t + rect.h_pct * pageH,
  };
}

/**
 * Compute the intersection area of two axis-aligned rectangles.
 * Both must be { l, t, r, b }.
 */
export function overlapArea(a, b) {
  const dx = Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l));
  const dy = Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  return dx * dy;
}

/**
 * For each rect, find the PDF annotation with the highest overlap area.
 *
 * Uses CSS layout dimensions — pass wrapper.offsetWidth / wrapper.offsetHeight,
 * NOT getBoundingClientRect() (which is zoom-dependent).
 *
 * @param {Array}  rects       - RectData[], each with x_pct/y_pct/w_pct/h_pct
 * @param {Array}  annotations - PDF Widget annotation objects with .rect [x1,y1,x2,y2]
 * @param {number} pageW       - wrapper.offsetWidth  (CSS layout pixels, zoom-independent)
 * @param {number} pageH       - wrapper.offsetHeight (CSS layout pixels, zoom-independent)
 * @param {number} renderScale - CSS layout pixels per PDF point
 * @returns {Array<{ rect, ann }>} parallel to `rects`; ann is null when no overlap found
 */
export function matchRectsToAnnotations(rects, annotations, pageW, pageH, renderScale) {
  return rects.map(rect => {
    const rBox = rectToCssRect(rect, pageW, pageH);
    let bestAnn = null;
    let bestOverlap = 0;

    for (const ann of annotations) {
      if (!ann.rect) continue;
      const aBox = annToCssRect(ann.rect, pageH, renderScale);
      const area = overlapArea(rBox, aBox);
      if (area > bestOverlap) { bestOverlap = area; bestAnn = ann; }
    }

    return { rect, ann: bestAnn };
  });
}
