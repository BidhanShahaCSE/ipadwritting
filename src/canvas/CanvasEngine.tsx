import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useNoteStore } from '../store/useNoteStore';
import { useAppStore } from '../store/useAppStore';
import {
  renderBackground,
  renderAllStrokes,
  renderActiveStroke,
  renderLassoPath,
  renderSelectionHighlight,
  renderLinePreview,
  renderShapePreview,
} from './StrokeRenderer';
import { screenToCanvas, isNearlyStraightLine, pointInPolygon, strokeIntersectsCircle } from '../utils/geometry';
import type { Page, Point, Stroke, TextBox } from '../types';
import { PAGE_SIZES } from '../types';
import { v4 as uuid } from 'uuid';
import { renderPdfPageToCanvas } from '../pdf/PdfEngine';
import AudioWidget from '../components/AudioWidget';

type GestureState = {
  active: boolean;
  initialDist: number;
  initialZoom: number;
  midX: number;
  midY: number;
};

type CanvasPageProps = {
  page: Page;
  pageIndex: number;
  pdfId?: string;
  isActive: boolean;
  onPageRef?: (element: HTMLDivElement | null) => void;
};

const CanvasPage: React.FC<CanvasPageProps> = ({ page, pageIndex, pdfId, isActive, onPageRef }) => {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const strokeCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement>(null);
  const pageWrapRef = useRef<HTMLDivElement>(null);

  const [lassoPoints, setLassoPoints] = useState<Point[]>([]);
  const [lineStart, setLineStart] = useState<{ x: number; y: number } | null>(null);
  const [lineEnd, setLineEnd] = useState<{ x: number; y: number } | null>(null);
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [shapeEnd, setShapeEnd] = useState<{ x: number; y: number } | null>(null);
  const [gestureState, setGestureState] = useState<GestureState>({
    active: false,
    initialDist: 0,
    initialZoom: 1,
    midX: 0,
    midY: 0,
  });
  const touchesRef = useRef<Map<number, PointerEvent>>(new Map());
  const pinchZoomRafRef = useRef<number | null>(null);
  const pinchZoomPendingRef = useRef<number | null>(null);
  const [eraserPos, setEraserPos] = useState<{ x: number; y: number } | null>(null);
  const [dragImg, setDragImg] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [resizeImg, setResizeImg] = useState<{ id: string; startX: number; startY: number; origW: number; origH: number } | null>(null);
  const [dragTb, setDragTb] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const {
    activeTool,
    activeShape,
    activePageIndex,
    strokeColor,
    strokeSize,
    highlighterColor,
    highlighterSize,
    strokeOpacity,
    highlighterOpacity,
    eraserSize,
    zoom,
    isDrawing,
    activeStroke,
    selectedStrokeIds,
    selectedTextBoxId,
    selectedImageId,
    setZoom,
    setIsDrawing,
    setActiveStroke,
    setActivePageIndex,
    addStrokeToActivePage,
    removeStrokesFromActivePage,
    setSelectedStrokeIds,
    pushHistory,
    setSelectedTextBoxId,
    setSelectedImageId,
    updateTextBoxOnActivePage,
    updateImageOnActivePage,
    removeImageFromActivePage,
  } = useNoteStore();
  const { darkMode } = useAppStore();

  const pageSize =
    page.pageSize === 'custom' && page.customWidth && page.customHeight
      ? {
          // Fractional CSS sizes can make canvas/PDF content look soft on iPad/Safari.
          width: Math.max(1, Math.round(page.customWidth)),
          height: Math.max(1, Math.round(page.customHeight)),
        }
      : PAGE_SIZES[page.pageSize];

  const outerW = pageSize.width * zoom;
  const outerH = pageSize.height * zoom;
  const pixelRatio = typeof window === 'undefined' ? 1 : Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  // Match the actual device pixel ratio closely so PDF text and strokes stay crisp.
  // We still cap the bitmap size to avoid very large allocations at high zoom.
  const canvasRenderScale = Math.max(1, Math.min(4, pixelRatio * zoom));

  const prepareCanvas = useCallback(
    (canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null => {
      if (!canvas) return null;

      const pixelWidth = Math.max(1, Math.round(pageSize.width * canvasRenderScale));
      const pixelHeight = Math.max(1, Math.round(pageSize.height * canvasRenderScale));

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      canvas.style.width = `${pageSize.width}px`;
      canvas.style.height = `${pageSize.height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(canvasRenderScale, canvasRenderScale);
      return ctx;
    },
    [pageSize.width, pageSize.height, canvasRenderScale]
  );

  const setPageWrap = useCallback(
    (element: HTMLDivElement | null) => {
      pageWrapRef.current = element;
      onPageRef?.(element);
    },
    [onPageRef]
  );

  const getCanvasPos = useCallback(
    (e: PointerEvent | React.PointerEvent): { x: number; y: number } => {
      const rect = activeCanvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return screenToCanvas(e.clientX, e.clientY, rect, zoom, 0, 0);
    },
    [zoom]
  );

  const renderBg = useCallback(async () => {
    const ctx = prepareCanvas(bgCanvasRef.current);
    if (!ctx) return;

    if (pdfId && page.pdfPageIndex !== undefined) {
      const pdfData = useAppStore.getState().pdfs.find((p) => p.id === pdfId)?.data;
      const pdfScale = canvasRenderScale;
      const pdfCanvas = await renderPdfPageToCanvas(pdfId, page.pdfPageIndex, pdfData, pdfScale);
      if (pdfCanvas) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(pdfCanvas, 0, 0, pageSize.width, pageSize.height);
        return;
      }
    }

    renderBackground(ctx, pageSize.width, pageSize.height, page.background, darkMode);
  }, [prepareCanvas, pdfId, page.pdfPageIndex, page.background, pageSize.width, pageSize.height, darkMode, canvasRenderScale]);

  const renderStrokes = useCallback(() => {
    const ctx = prepareCanvas(strokeCanvasRef.current);
    if (!ctx) return;
    renderAllStrokes(ctx, page.strokes, 1);

    if (isActive && selectedStrokeIds.length > 0) {
      const selected = page.strokes.filter((s) => selectedStrokeIds.includes(s.id));
      renderSelectionHighlight(ctx, selected);
    }
  }, [prepareCanvas, page.strokes, selectedStrokeIds, isActive]);

  const renderActive = useCallback(() => {
    const ctx = prepareCanvas(activeCanvasRef.current);
    if (!ctx) return;

    if (isActive && activeStroke) {
      renderActiveStroke(ctx, activeStroke);
    }
    if (isActive && lassoPoints.length > 1) {
      renderLassoPath(ctx, lassoPoints);
    }
    if (isActive && lineStart && lineEnd && activeTool === 'line') {
      renderLinePreview(ctx, lineStart, lineEnd, strokeColor, strokeSize, strokeOpacity);
    }
    if (isActive && shapeStart && shapeEnd && activeTool === 'shape') {
      renderShapePreview(ctx, activeShape, shapeStart, shapeEnd, strokeColor, strokeSize, strokeOpacity);
    }
  }, [
    prepareCanvas,
    isActive,
    activeStroke,
    lassoPoints,
    lineStart,
    lineEnd,
    shapeStart,
    shapeEnd,
    activeTool,
    activeShape,
    strokeColor,
    strokeSize,
    strokeOpacity,
  ]);

  useEffect(() => {
    renderBg();
  }, [renderBg]);

  useEffect(() => {
    renderStrokes();
  }, [renderStrokes]);

  useEffect(() => {
    renderActive();
  }, [renderActive]);

  const schedulePinchZoom = useCallback(
    (nextZoom: number) => {
      pinchZoomPendingRef.current = nextZoom;

      if (typeof window === 'undefined') {
        setZoom(nextZoom);
        return;
      }

      if (pinchZoomRafRef.current !== null) return;
      pinchZoomRafRef.current = window.requestAnimationFrame(() => {
        pinchZoomRafRef.current = null;
        const pending = pinchZoomPendingRef.current;
        if (pending !== null) {
          setZoom(pending);
        }
      });
    },
    [setZoom]
  );

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && pinchZoomRafRef.current !== null) {
        window.cancelAnimationFrame(pinchZoomRafRef.current);
      }
    };
  }, []);

  const handleErase = useCallback(
    (x: number, y: number) => {
      const toRemove = page.strokes.filter((s) => strokeIntersectsCircle(s.points, x, y, eraserSize / 2));
      if (toRemove.length > 0) {
        removeStrokesFromActivePage(toRemove.map((s) => s.id));
        pushHistory({ type: 'stroke_remove', pageIndex, data: toRemove, inverse: null });
      }
    },
    [page.strokes, eraserSize, pageIndex, removeStrokesFromActivePage, pushHistory]
  );

  const handleTextCreate = useCallback(
    (x: number, y: number) => {
      const tb: TextBox = {
        id: uuid(),
        x,
        y,
        width: 200,
        height: 40,
        content: '',
        fontSize: 16,
        fontFamily: 'Inter',
        color: strokeColor,
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
      };
      useNoteStore.getState().addTextBoxToActivePage(tb);
      pushHistory({ type: 'text_add', pageIndex, data: tb, inverse: null });
      useNoteStore.getState().setSelectedTextBoxId(tb.id);
      useNoteStore.getState().setActiveTool('hand');
    },
    [strokeColor, pageIndex, pushHistory]
  );

  const generateShapePoints = (shape: string, start: { x: number; y: number }, end: { x: number; y: number }): Point[] => {
    const mkPt = (x: number, y: number): Point => ({ x, y, pressure: 0.5, timestamp: Date.now() });
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);

    switch (shape) {
      case 'rectangle':
        return [mkPt(x, y), mkPt(x + w, y), mkPt(x + w, y + h), mkPt(x, y + h), mkPt(x, y)];
      case 'ellipse': {
        const pts: Point[] = [];
        for (let a = 0; a <= Math.PI * 2; a += 0.1) {
          pts.push(mkPt(x + w / 2 + (w / 2) * Math.cos(a), y + h / 2 + (h / 2) * Math.sin(a)));
        }
        return pts;
      }
      case 'triangle':
        return [mkPt(x + w / 2, y), mkPt(x + w, y + h), mkPt(x, y + h), mkPt(x + w / 2, y)];
      default:
        return [mkPt(start.x, start.y), mkPt(end.x, end.y)];
    }
  };

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (activePageIndex !== pageIndex) setActivePageIndex(pageIndex);

      const isTouch = e.pointerType === 'touch';

      if (isTouch) {
        touchesRef.current.set(e.pointerId, e.nativeEvent);

        if (touchesRef.current.size === 2) {
          const touches = Array.from(touchesRef.current.values());
          const dx = touches[1].clientX - touches[0].clientX;
          const dy = touches[1].clientY - touches[0].clientY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          setGestureState({
            active: true,
            initialDist: dist,
            initialZoom: zoom,
            midX: (touches[0].clientX + touches[1].clientX) / 2,
            midY: (touches[0].clientY + touches[1].clientY) / 2,
          });
          setIsDrawing(false);
          setActiveStroke(null);
          return;
        }

        // Keep single-finger touch for scrolling and avoid accidental finger/palm strokes.
        return;
      }

      const pos = getCanvasPos(e);

      if (activeTool === 'pen' || activeTool === 'highlighter') {
        const color = activeTool === 'highlighter' ? highlighterColor : strokeColor;
        const size = activeTool === 'highlighter' ? highlighterSize : strokeSize;
        const opacity = activeTool === 'highlighter' ? highlighterOpacity : strokeOpacity;
        const newStroke: Stroke = {
          id: uuid(),
          points: [
            {
              x: pos.x,
              y: pos.y,
              pressure: e.pressure || 0.5,
              tiltX: e.tiltX,
              tiltY: e.tiltY,
              timestamp: Date.now(),
            },
          ],
          color,
          size,
          opacity,
          tool: activeTool === 'highlighter' ? 'highlighter' : 'pen',
        };
        setActiveStroke(newStroke);
        setIsDrawing(true);
      } else if (activeTool === 'eraser') {
        setIsDrawing(true);
        handleErase(pos.x, pos.y);
      } else if (activeTool === 'lasso') {
        setLassoPoints([{ x: pos.x, y: pos.y, pressure: 0, timestamp: Date.now() }]);
        setIsDrawing(true);
        setSelectedStrokeIds([]);
      } else if (activeTool === 'line') {
        setLineStart(pos);
        setLineEnd(pos);
        setIsDrawing(true);
      } else if (activeTool === 'shape') {
        setShapeStart(pos);
        setShapeEnd(pos);
        setIsDrawing(true);
      } else if (activeTool === 'text') {
        handleTextCreate(pos.x, pos.y);
      }

      setSelectedTextBoxId(null);
      setSelectedImageId(null);
    },
    [
      activePageIndex,
      pageIndex,
      activeTool,
      zoom,
      strokeColor,
      strokeSize,
      strokeOpacity,
      highlighterColor,
      highlighterSize,
      highlighterOpacity,
      getCanvasPos,
      handleErase,
      handleTextCreate,
      setActivePageIndex,
      setIsDrawing,
      setActiveStroke,
      setSelectedStrokeIds,
      setSelectedTextBoxId,
      setSelectedImageId,
    ]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const isTouch = e.pointerType === 'touch';

      if (isTouch) {
        touchesRef.current.set(e.pointerId, e.nativeEvent);
      }

      if (activeTool === 'eraser' && pageWrapRef.current) {
        const rect = pageWrapRef.current.getBoundingClientRect();
        setEraserPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }

      if (dragImg) {
        const pos = getCanvasPos(e);
        const dx = pos.x - dragImg.startX;
        const dy = pos.y - dragImg.startY;
        updateImageOnActivePage(dragImg.id, { x: dragImg.origX + dx, y: dragImg.origY + dy });
        return;
      }

      if (resizeImg) {
        const pos = getCanvasPos(e);
        const dw = pos.x - resizeImg.startX;
        const dh = pos.y - resizeImg.startY;
        updateImageOnActivePage(resizeImg.id, {
          width: Math.max(30, resizeImg.origW + dw),
          height: Math.max(30, resizeImg.origH + dh),
        });
        return;
      }

      if (dragTb) {
        const pos = getCanvasPos(e);
        const dx = pos.x - dragTb.startX;
        const dy = pos.y - dragTb.startY;
        updateTextBoxOnActivePage(dragTb.id, { x: dragTb.origX + dx, y: dragTb.origY + dy });
        return;
      }

      if (gestureState.active && touchesRef.current.size === 2) {
        const touches = Array.from(touchesRef.current.values());
        const dx = touches[1].clientX - touches[0].clientX;
        const dy = touches[1].clientY - touches[0].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const scale = dist / gestureState.initialDist;
        const newZoom = Math.max(0.25, Math.min(5, gestureState.initialZoom * scale));
        schedulePinchZoom(newZoom);
        return;
      }
      if (isTouch) return;

      if (!isDrawing) return;

      const pos = getCanvasPos(e);

      if ((activeTool === 'pen' || activeTool === 'highlighter') && activeStroke) {
        const newPoint: Point = {
          x: pos.x,
          y: pos.y,
          pressure: e.pressure || 0.5,
          tiltX: e.tiltX,
          tiltY: e.tiltY,
          timestamp: Date.now(),
        };
        setActiveStroke({ ...activeStroke, points: [...activeStroke.points, newPoint] });
      } else if (activeTool === 'eraser') {
        handleErase(pos.x, pos.y);
      } else if (activeTool === 'lasso') {
        setLassoPoints((prev) => [...prev, { x: pos.x, y: pos.y, pressure: 0, timestamp: Date.now() }]);
      } else if (activeTool === 'line') {
        setLineEnd(pos);
      } else if (activeTool === 'shape') {
        setShapeEnd(pos);
      }
    },
    [
      activeTool,
      dragImg,
      resizeImg,
      dragTb,
      getCanvasPos,
      gestureState,
      isDrawing,
      activeStroke,
      handleErase,
      schedulePinchZoom,
      setActiveStroke,
      updateImageOnActivePage,
      updateTextBoxOnActivePage,
    ]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      touchesRef.current.delete(e.pointerId);

      if (dragImg) {
        setDragImg(null);
        return;
      }
      if (resizeImg) {
        setResizeImg(null);
        return;
      }
      if (dragTb) {
        setDragTb(null);
        return;
      }

      if (activeTool === 'eraser') setEraserPos(null);

      if (gestureState.active && touchesRef.current.size < 2) {
        setGestureState((g) => ({ ...g, active: false }));
        return;
      }
      if (!isDrawing) return;

      if ((activeTool === 'pen' || activeTool === 'highlighter') && activeStroke) {
        let finalStroke = activeStroke;
        if (activeTool === 'pen' && isNearlyStraightLine(activeStroke.points)) {
          finalStroke = {
            ...activeStroke,
            tool: 'line',
            points: [activeStroke.points[0], activeStroke.points[activeStroke.points.length - 1]],
          };
        }
        addStrokeToActivePage(finalStroke);
        pushHistory({ type: 'stroke_add', pageIndex, data: finalStroke, inverse: null });
      } else if (activeTool === 'lasso' && lassoPoints.length > 2) {
        const selectedIds = page.strokes
          .filter((s) => s.points.some((p) => pointInPolygon(p, lassoPoints)))
          .map((s) => s.id);
        setSelectedStrokeIds(selectedIds);
        setLassoPoints([]);
      } else if (activeTool === 'line' && lineStart && lineEnd) {
        const lineStroke: Stroke = {
          id: uuid(),
          tool: 'line',
          color: strokeColor,
          size: strokeSize,
          opacity: strokeOpacity,
          points: [
            { x: lineStart.x, y: lineStart.y, pressure: 0.5, timestamp: Date.now() },
            { x: lineEnd.x, y: lineEnd.y, pressure: 0.5, timestamp: Date.now() },
          ],
        };
        addStrokeToActivePage(lineStroke);
        pushHistory({ type: 'stroke_add', pageIndex, data: lineStroke, inverse: null });
        setLineStart(null);
        setLineEnd(null);
      } else if (activeTool === 'shape' && shapeStart && shapeEnd) {
        const shapePoints = generateShapePoints(activeShape, shapeStart, shapeEnd);
        const shapeStroke: Stroke = {
          id: uuid(),
          tool: 'pen',
          color: strokeColor,
          size: strokeSize,
          opacity: strokeOpacity,
          points: shapePoints,
        };
        addStrokeToActivePage(shapeStroke);
        pushHistory({ type: 'stroke_add', pageIndex, data: shapeStroke, inverse: null });
        setShapeStart(null);
        setShapeEnd(null);
      }

      setActiveStroke(null);
      setIsDrawing(false);
    },
    [
      dragImg,
      resizeImg,
      dragTb,
      activeTool,
      gestureState,
      isDrawing,
      activeStroke,
      lassoPoints,
      lineStart,
      lineEnd,
      shapeStart,
      shapeEnd,
      activeShape,
      strokeColor,
      strokeSize,
      strokeOpacity,
      page.strokes,
      pageIndex,
      addStrokeToActivePage,
      pushHistory,
      setSelectedStrokeIds,
      setActiveStroke,
      setIsDrawing,
    ]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(zoom * delta);
      }
    },
    [zoom, setZoom]
  );

  return (
    <div ref={setPageWrap} data-page-index={pageIndex} className="relative" style={{ width: outerW, height: outerH, flexShrink: 0 }}>
      <div
        onWheel={handleWheel}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: pageSize.width,
          height: pageSize.height,
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          borderRadius: '4px',
          overflow: 'hidden',
          boxShadow: '0 4px 32px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
          background: 'transparent',
        }}
      >
        <canvas
          ref={bgCanvasRef}
          width={pageSize.width}
          height={pageSize.height}
          style={{ position: 'absolute', top: 0, left: 0, width: pageSize.width, height: pageSize.height }}
        />
        <canvas
          ref={strokeCanvasRef}
          width={pageSize.width}
          height={pageSize.height}
          style={{ position: 'absolute', top: 0, left: 0, width: pageSize.width, height: pageSize.height }}
        />
        <canvas
          ref={activeCanvasRef}
          width={pageSize.width}
          height={pageSize.height}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: pageSize.width,
            height: pageSize.height,
            touchAction: activeTool === 'hand' ? 'pan-y' : 'none',
            cursor: activeTool === 'eraser' ? 'none' : activeTool === 'hand' ? 'grab' : 'crosshair',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />

        {page.textBoxes.map((tb) => (
          <div
            key={tb.id}
            className={`canvas-textbox ${selectedTextBoxId === tb.id && isActive ? 'selected' : ''}`}
            contentEditable
            suppressContentEditableWarning
            style={{
              left: tb.x,
              top: tb.y,
              width: tb.width,
              minHeight: tb.height,
              fontSize: tb.fontSize,
              fontFamily: tb.fontFamily,
              color: tb.color,
              fontWeight: tb.bold ? 'bold' : 'normal',
              fontStyle: tb.italic ? 'italic' : 'normal',
              textDecoration: [tb.underline ? 'underline' : '', tb.strikethrough ? 'line-through' : ''].join(' ').trim() || 'none',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setActivePageIndex(pageIndex);
              setSelectedTextBoxId(tb.id);
            }}
            onPointerDown={(e) => {
              if (e.pointerType === 'touch') return;
              if (e.target === e.currentTarget) {
                e.stopPropagation();
                setActivePageIndex(pageIndex);
                const pos = getCanvasPos(e);
                setDragTb({ id: tb.id, startX: pos.x, startY: pos.y, origX: tb.x, origY: tb.y });
                setSelectedTextBoxId(tb.id);
              }
            }}
            onInput={(e) => {
              setActivePageIndex(pageIndex);
              updateTextBoxOnActivePage(tb.id, { content: (e.target as HTMLElement).textContent || '' });
            }}
          >
            {tb.content}
          </div>
        ))}

        {page.images.map((img) => (
          <div
            key={img.id}
            className={`canvas-image ${selectedImageId === img.id && isActive ? 'selected' : ''}`}
            style={{ left: img.x, top: img.y, width: img.width, height: img.height }}
            onPointerDown={(e) => {
              if (e.pointerType === 'touch') return;
              e.stopPropagation();
              setActivePageIndex(pageIndex);
              setSelectedImageId(img.id);
              const pos = getCanvasPos(e);
              setDragImg({ id: img.id, startX: pos.x, startY: pos.y, origX: img.x, origY: img.y });
            }}
          >
            <img src={img.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} draggable={false} />
            <div
              className="resize-handle"
              style={{ bottom: -5, right: -5 }}
              onPointerDown={(e) => {
                if (e.pointerType === 'touch') return;
                e.stopPropagation();
                setActivePageIndex(pageIndex);
                const pos = getCanvasPos(e);
                setResizeImg({ id: img.id, startX: pos.x, startY: pos.y, origW: img.width, origH: img.height });
              }}
            />
            <div
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                setActivePageIndex(pageIndex);
                const removed = page.images.find((i) => i.id === img.id);
                removeImageFromActivePage(img.id);
                if (removed) pushHistory({ type: 'image_remove', pageIndex, data: removed, inverse: null });
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
        ))}

        {page.audioIds.map((audioId) => (
          <AudioWidget
            key={audioId}
            audioId={audioId}
            onDelete={() => {
              setActivePageIndex(pageIndex);
              useNoteStore.getState().removeAudioIdFromActivePage(audioId);
            }}
          />
        ))}
      </div>

      {isActive && activeTool === 'eraser' && eraserPos && (
        <div
          className="eraser-cursor"
          style={{
            left: eraserPos.x,
            top: eraserPos.y,
            width: eraserSize * zoom,
            height: eraserSize * zoom,
          }}
        />
      )}
    </div>
  );
};

const CanvasEngine: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { activeNote, activePageIndex, setActivePageIndex } = useNoteStore();

  const registerPageRef = useCallback((index: number, element: HTMLDivElement | null) => {
    pageRefs.current[index] = element;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !activeNote) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestIndex = -1;
        let bestRatio = 0;

        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const target = entry.target as HTMLElement;
          const index = Number(target.dataset.pageIndex);
          if (Number.isNaN(index)) return;

          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestIndex = index;
          }
        });

        if (bestIndex === -1) return;
        if (bestIndex !== useNoteStore.getState().activePageIndex) {
          setActivePageIndex(bestIndex);
        }
      },
      {
        root: container,
        threshold: [0.25, 0.5, 0.75],
      }
    );

    pageRefs.current.forEach((element) => {
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [activeNote?.id, activeNote?.pages.length, setActivePageIndex]);

  if (!activeNote) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="text-center" style={{ color: 'var(--color-text-secondary)' }}>
          <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <p className="text-lg font-medium">Select or create a note</p>
          <p className="text-sm mt-1">Your canvas awaits</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="canvas-container canvas-scroll"
      style={{
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '16px 0',
      }}
    >
      <div className="flex flex-col items-center" style={{ gap: 12 }}>
        {activeNote.pages.map((p, idx) => (
          <CanvasPage
            key={p.id}
            page={p}
            pageIndex={idx}
            pdfId={activeNote.pdfId}
            isActive={idx === activePageIndex}
            onPageRef={(element) => registerPageRef(idx, element)}
          />
        ))}
      </div>
    </div>
  );
};

export default CanvasEngine;
