import type { Point } from '../types';

/** Distance between two points */
export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Check if a point is inside a polygon (ray-casting) */
export function pointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Check if a stroke intersects with a circle (eraser) */
export function strokeIntersectsCircle(
  points: Point[],
  cx: number,
  cy: number,
  radius: number
): boolean {
  for (const p of points) {
    if (distance(p, { x: cx, y: cy }) <= radius) return true;
  }
  return false;
}

/** Calculate bounding box of points */
export function getBoundingBox(points: { x: number; y: number }[]): {
  x: number; y: number; width: number; height: number;
} {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Detect if points form a nearly straight line */
export function isNearlyStraightLine(points: Point[], threshold = 15): boolean {
  if (points.length < 3) return true;
  const start = points[0];
  const end = points[points.length - 1];
  const lineLen = distance(start, end);
  if (lineLen < 5) return false;

  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    // Distance from point to line between start and end
    const d = Math.abs(
      (end.y - start.y) * p.x - (end.x - start.x) * p.y + end.x * start.y - end.y * start.x
    ) / lineLen;
    if (d > threshold) return false;
  }
  return true;
}

/** Snap angle to nearest 15-degree increment */
export function snapAngle(angle: number): number {
  const snap = 15;
  return Math.round(angle / snap) * snap;
}

/** Calculate angle between two points in degrees */
export function angleBetween(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
}

/** Smooth points using moving average */
export function smoothPoints(points: Point[], windowSize = 3): Point[] {
  if (points.length <= windowSize) return points;
  const result: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(points.length, i + Math.floor(windowSize / 2) + 1);
    let sx = 0, sy = 0, sp = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sx += points[j].x;
      sy += points[j].y;
      sp += points[j].pressure;
      count++;
    }
    result.push({
      x: sx / count,
      y: sy / count,
      pressure: sp / count,
      tiltX: points[i].tiltX,
      tiltY: points[i].tiltY,
      timestamp: points[i].timestamp,
    });
  }
  result.push(points[points.length - 1]);
  return result;
}

/** Convert screen coordinates to canvas coordinates */
export function screenToCanvas(
  screenX: number,
  screenY: number,
  canvasRect: DOMRect,
  zoom: number,
  panX: number,
  panY: number
): { x: number; y: number } {
  return {
    x: (screenX - canvasRect.left - panX) / zoom,
    y: (screenY - canvasRect.top - panY) / zoom,
  };
}
