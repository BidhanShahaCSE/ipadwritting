import type { Stroke, Point } from '../types';


/** Render a single stroke to a canvas context */
export function renderStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  _zoom: number = 1
): void {
  if (stroke.points.length < 2) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (stroke.tool === 'highlighter') {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = stroke.opacity;
    ctx.strokeStyle = stroke.color;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = stroke.opacity;
    ctx.strokeStyle = stroke.color;
  }

  if (stroke.tool === 'line') {
    // Straight line — just connect first and last point
    const first = stroke.points[0];
    const last = stroke.points[stroke.points.length - 1];
    const avgPressure = stroke.points.reduce((sum, p) => sum + p.pressure, 0) / stroke.points.length;
    ctx.lineWidth = stroke.size * Math.max(0.3, avgPressure);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  } else {
    // Freehand stroke with variable width
    drawVariableWidthStroke(ctx, stroke.points, stroke.size, stroke.tool === 'highlighter');
  }

  ctx.restore();
}

/** Draw a stroke with pressure-sensitive variable width */
function drawVariableWidthStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  baseSize: number,
  isHighlighter: boolean
): void {
  if (points.length < 2) return;

  // For highlighter, use constant width
  if (isHighlighter) {
    ctx.lineWidth = baseSize;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
    return;
  }

  // Variable width pen stroke using filled path
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const pressure = Math.max(0.1, curr.pressure || 0.5);
    const width = baseSize * pressure;

    ctx.lineWidth = width;
    ctx.beginPath();

    if (i === 1) {
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
    } else {
      const prevPrev = points[i - 2];
      const midX1 = (prevPrev.x + prev.x) / 2;
      const midY1 = (prevPrev.y + prev.y) / 2;
      const midX2 = (prev.x + curr.x) / 2;
      const midY2 = (prev.y + curr.y) / 2;
      ctx.moveTo(midX1, midY1);
      ctx.quadraticCurveTo(prev.x, prev.y, midX2, midY2);
    }
    ctx.stroke();
  }
}

/** Render all strokes on a page */
export function renderAllStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  zoom: number = 1
): void {
  for (const stroke of strokes) {
    if (!stroke.isErased) {
      renderStroke(ctx, stroke, zoom);
    }
  }
}

/** Render page background */
export function renderBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: string,
  _isDark: boolean
): void {
  // Keep page paper color stable regardless of app UI theme.
  // Only explicit "dark" paper uses dark colors.
  const isDarkPaper = background === 'dark';
  ctx.fillStyle = isDarkPaper ? '#1C1C1E' : '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  const lineColor = isDarkPaper ? '#38383A' : '#E5E5EA';
  const dotColor = isDarkPaper ? '#48484A' : '#D1D1D6';

  ctx.strokeStyle = lineColor;
  ctx.fillStyle = dotColor;
  ctx.lineWidth = 1;

  switch (background) {
    case 'lined': {
      const spacing = 32;
      ctx.beginPath();
      for (let y = spacing; y < height; y += spacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
      break;
    }
    case 'dotted': {
      const dotSpacing = 24;
      for (let x = dotSpacing; x < width; x += dotSpacing) {
        for (let y = dotSpacing; y < height; y += dotSpacing) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'graph': {
      const gridSize = 24;
      ctx.beginPath();
      for (let x = gridSize; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = gridSize; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
      break;
    }
  }
}

/** Render active stroke being drawn */
export function renderActiveStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke
): void {
  if (stroke.points.length < 1) return;
  renderStroke(ctx, stroke);
}

/** Render eraser cursor */
export function renderEraserCursor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  isDark: boolean
): void {
  ctx.save();
  ctx.strokeStyle = isDark ? '#FFFFFF' : '#000000';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Render lasso selection path */
export function renderLassoPath(
  ctx: CanvasRenderingContext2D,
  points: Point[]
): void {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = '#007AFF';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.stroke();

  // Fill with translucent blue
  ctx.fillStyle = 'rgba(0, 122, 255, 0.08)';
  ctx.fill();
  ctx.restore();
}

/** Render selection highlight around selected strokes */
export function renderSelectionHighlight(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[]
): void {
  if (strokes.length === 0) return;

  // Get bounding box of all selected strokes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const stroke of strokes) {
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }

  const padding = 8;
  ctx.save();
  ctx.strokeStyle = '#007AFF';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(
    minX - padding,
    minY - padding,
    maxX - minX + padding * 2,
    maxY - minY + padding * 2
  );
  ctx.restore();
}

/** Render line preview while drawing */
export function renderLinePreview(
  ctx: CanvasRenderingContext2D,
  start: { x: number; y: number },
  end: { x: number; y: number },
  color: string,
  size: number,
  opacity: number = 1
): void {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.restore();
}

/** Render shape preview */
export function renderShapePreview(
  ctx: CanvasRenderingContext2D,
  shapeType: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  color: string,
  size: number,
  opacity: number = 1
): void {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);

  ctx.beginPath();
  switch (shapeType) {
    case 'rectangle':
      ctx.rect(x, y, w, h);
      break;
    case 'ellipse':
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case 'triangle':
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      break;
    case 'arrow': {
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLen = 20;
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLen * Math.cos(angle - Math.PI / 6),
        end.y - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLen * Math.cos(angle + Math.PI / 6),
        end.y - headLen * Math.sin(angle + Math.PI / 6)
      );
      break;
    }
  }
  ctx.stroke();
  ctx.restore();
}
