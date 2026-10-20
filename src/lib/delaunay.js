/* Bowyer-Watson Delaunay triangulation. points: [[x, y], ...] -> [[i, j, k], ...]
   O(n^2), fine for the ~1,500 points of the low poly portrait. Self check: node src/lib/delaunay.js */
export function delaunay(points) {
  const n = points.length;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const d = Math.max(maxX - minX, maxY - minY) * 20, mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
  const P = [...points, [mx - d, my - d], [mx + d, my - d], [mx, my + d]];
  const circ = (a, b, c) => {
    const [ax, ay] = P[a], [bx, by] = P[b], [cx, cy] = P[c];
    const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D;
    return { a, b, c, x: ux, y: uy, r: (ax - ux) ** 2 + (ay - uy) ** 2 };
  };
  let tris = [circ(n, n + 1, n + 2)];
  for (let i = 0; i < n; i++) {
    const [px, py] = P[i];
    const edges = new Map();
    const keep = [];
    for (const t of tris) {
      if ((px - t.x) ** 2 + (py - t.y) ** 2 < t.r) {
        for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
          const k = u < v ? `${u},${v}` : `${v},${u}`;
          edges.set(k, edges.has(k) ? null : [u, v]);   // shared edges cancel out
        }
      } else keep.push(t);
    }
    for (const e of edges.values()) if (e) keep.push(circ(e[0], e[1], i));
    tris = keep;
  }
  return tris.filter((t) => t.a < n && t.b < n && t.c < n).map((t) => [t.a, t.b, t.c]);
}

if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("delaunay.js")) {
  const sq = delaunay([[0, 0], [1, 0], [1, 1], [0, 1]]);
  console.assert(sq.length === 2, "a square makes two triangles");
  const pts = Array.from({ length: 300 }, () => [Math.random() * 100, Math.random() * 100]);
  const t = delaunay(pts);
  // Euler: a triangulation of n points with h on the hull has 2n - 2 - h triangles, so between n and 2n.
  console.assert(t.length > 300 && t.length < 600, `triangle count ${t.length}`);
  const area = t.reduce((a, [i, j, k]) => a + Math.abs((pts[j][0] - pts[i][0]) * (pts[k][1] - pts[i][1]) - (pts[k][0] - pts[i][0]) * (pts[j][1] - pts[i][1])) / 2, 0);
  console.assert(area > 9000 && area <= 10000.01, `covers the hull, area ${area}`);
  console.log("delaunay ok:", t.length, "triangles, area", area.toFixed(0));
}
