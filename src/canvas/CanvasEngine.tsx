import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useNoteStore } from '../store/useNoteStore';
import { useAppStore } from '../store/useAppStore';
import {
  renderBackground, renderAllStrokes, renderActiveStroke,
  renderLassoPath, renderSelectionHighlight,
  renderLinePreview, renderShapePreview,
} from './StrokeRenderer';
import { screenToCanvas, isNearlyStraightLine, pointInPolygon, strokeIntersectsCircle } from '../utils/geometry';
import type { Point, Stroke, TextBox } from '../types';
import { PAGE_SIZES } from '../types';
import { v4 as uuid } from 'uuid';
import { renderPdfPageToCanvas } from '../pdf/PdfEngine';
import AudioWidget from '../components/AudioWidget';

const CanvasEngine: React.FC = () => {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const strokeCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [lassoPoints, setLassoPoints] = useState<Point[]>([]);
  const [lineStart, setLineStart] = useState<{x:number;y:number}|null>(null);
  const [lineEnd, setLineEnd] = useState<{x:number;y:number}|null>(null);
  const [shapeStart, setShapeStart] = useState<{x:number;y:number}|null>(null);
  const [shapeEnd, setShapeEnd] = useState<{x:number;y:number}|null>(null);
  const [gestureState, setGestureState] = useState<{active:boolean; initialDist:number; initialZoom:number; initialPanX:number; initialPanY:number; midX:number; midY:number}>({active:false,initialDist:0,initialZoom:1,initialPanX:0,initialPanY:0,midX:0,midY:0});
  const touchesRef = useRef<Map<number, PointerEvent>>(new Map());
  const [pdfRenderTick] = useState(0);
  const [eraserPos, setEraserPos] = useState<{x:number;y:number}|null>(null);
  const [dragImg, setDragImg] = useState<{id:string;startX:number;startY:number;origX:number;origY:number}|null>(null);
  const [resizeImg, setResizeImg] = useState<{id:string;startX:number;startY:number;origW:number;origH:number}|null>(null);
  const [dragTb, setDragTb] = useState<{id:string;startX:number;startY:number;origX:number;origY:number}|null>(null);

  const {
    activeNote, activePageIndex, activeTool, activeShape,
    strokeColor, strokeSize, highlighterColor, highlighterSize,
    strokeOpacity, highlighterOpacity,
    eraserSize, zoom, panX, panY,
    isDrawing, activeStroke, selectedStrokeIds,
    setZoom, setPan, setIsDrawing, setActiveStroke,
    addStrokeToActivePage, removeStrokesFromActivePage,
    setSelectedStrokeIds, pushHistory,
    setSelectedTextBoxId, setSelectedImageId,
    selectedTextBoxId, selectedImageId,
    updateTextBoxOnActivePage, updateImageOnActivePage, removeImageFromActivePage,
  } = useNoteStore();
  const { darkMode } = useAppStore();

  const activePage = activeNote?.pages[activePageIndex];
  const pageSize = activePage 
    ? (activePage.pageSize === 'custom' && activePage.customWidth && activePage.customHeight
        ? { width: activePage.customWidth, height: activePage.customHeight }
        : PAGE_SIZES[activePage.pageSize])
    : PAGE_SIZES.a4;

  // Get canvas coordinates from pointer event
  const getCanvasPos = useCallback((e: PointerEvent | React.PointerEvent): {x:number;y:number} => {
    const rect = activeCanvasRef.current?.getBoundingClientRect();
    if (!rect) return {x:0,y:0};
    return screenToCanvas(e.clientX, e.clientY, rect, zoom, 0, 0);
  }, [zoom]);

  // ─── Render background ──────────────────────────────────
  const renderBg = useCallback(async () => {
    const canvas = bgCanvasRef.current;
    if (!canvas || !activePage) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = pageSize.width;
    canvas.height = pageSize.height;

    if (activeNote?.pdfId && activePage.pdfPageIndex !== undefined) {
      // Find the actual PDF data from app store
      const pdfData = useAppStore.getState().pdfs.find(p => p.id === activeNote.pdfId)?.data;
      const pdfCanvas = await renderPdfPageToCanvas(activeNote.pdfId, activePage.pdfPageIndex, pdfData);
      if (pdfCanvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(pdfCanvas, 0, 0, canvas.width, canvas.height);
      } else {
        renderBackground(ctx, pageSize.width, pageSize.height, activePage.background, darkMode);
      }
    } else {
      renderBackground(ctx, pageSize.width, pageSize.height, activePage.background, darkMode);
    }
  }, [activePage, darkMode, pageSize, activeNote?.pdfId, pdfRenderTick]);

  // ─── Render strokes ─────────────────────────────────────
  const renderStrokes = useCallback(() => {
    const canvas = strokeCanvasRef.current;
    if (!canvas || !activePage) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = pageSize.width;
    canvas.height = pageSize.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderAllStrokes(ctx, activePage.strokes, zoom);

    // Render selection highlight
    if (selectedStrokeIds.length > 0) {
      const selected = activePage.strokes.filter(s => selectedStrokeIds.includes(s.id));
      renderSelectionHighlight(ctx, selected);
    }
  }, [activePage, zoom, selectedStrokeIds, pageSize]);

  // ─── Render active layer ────────────────────────────────
  const renderActive = useCallback(() => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = pageSize.width;
    canvas.height = pageSize.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (activeStroke) {
      renderActiveStroke(ctx, activeStroke);
    }
    if (lassoPoints.length > 1) {
      renderLassoPath(ctx, lassoPoints);
    }
    if (lineStart && lineEnd && activeTool === 'line') {
      renderLinePreview(ctx, lineStart, lineEnd, strokeColor, strokeSize, strokeOpacity);
    }
    if (shapeStart && shapeEnd && activeTool === 'shape') {
      renderShapePreview(ctx, activeShape, shapeStart, shapeEnd, strokeColor, strokeSize, strokeOpacity);
    }
  }, [activeStroke, lassoPoints, lineStart, lineEnd, shapeStart, shapeEnd, activeTool, activeShape, strokeColor, strokeSize, strokeOpacity, pageSize]);

  // ─── Animation loop ─────────────────────────────────────
  useEffect(() => {
    renderBg();
    renderStrokes();
    renderActive();
  }, [renderBg, renderStrokes, renderActive]);

  // ─── Pointer handlers ───────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Track touches for gestures
    touchesRef.current.set(e.pointerId, e.nativeEvent);

    // Two-finger gesture detection
    if (touchesRef.current.size === 2 && e.pointerType === 'touch') {
      const touches = Array.from(touchesRef.current.values());
      const dx = touches[1].clientX - touches[0].clientX;
      const dy = touches[1].clientY - touches[0].clientY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      setGestureState({
        active: true,
        initialDist: dist,
        initialZoom: zoom,
        initialPanX: panX,
        initialPanY: panY,
        midX: (touches[0].clientX + touches[1].clientX) / 2,
        midY: (touches[0].clientY + touches[1].clientY) / 2,
      });
      setIsDrawing(false);
      setActiveStroke(null);
      return;
    }

    // Palm rejection: touch only for gestures
    if (e.pointerType === 'touch' && activeTool !== 'hand') return;

    const pos = getCanvasPos(e);

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      const color = activeTool === 'highlighter' ? highlighterColor : strokeColor;
      const size = activeTool === 'highlighter' ? highlighterSize : strokeSize;
      const opacity = activeTool === 'highlighter' ? highlighterOpacity : strokeOpacity;
      const newStroke: Stroke = {
        id: uuid(),
        points: [{ x: pos.x, y: pos.y, pressure: e.pressure || 0.5, tiltX: e.tiltX, tiltY: e.tiltY, timestamp: Date.now() }],
        color, size, opacity,
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
    } else if (activeTool === 'hand') {
      setIsDrawing(true);
    }

    setSelectedTextBoxId(null);
    setSelectedImageId(null);
  }, [activeTool, strokeColor, strokeSize, strokeOpacity, highlighterColor, highlighterSize, highlighterOpacity, zoom, panX, panY, getCanvasPos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    touchesRef.current.set(e.pointerId, e.nativeEvent);

    // Track eraser cursor position
    if (activeTool === 'eraser') {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) setEraserPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    // Image drag
    if (dragImg) {
      const pos = getCanvasPos(e);
      const dx = pos.x - dragImg.startX;
      const dy = pos.y - dragImg.startY;
      updateImageOnActivePage(dragImg.id, { x: dragImg.origX + dx, y: dragImg.origY + dy });
      return;
    }
    // Image resize
    if (resizeImg) {
      const pos = getCanvasPos(e);
      const dw = pos.x - resizeImg.startX;
      const dh = pos.y - resizeImg.startY;
      updateImageOnActivePage(resizeImg.id, { width: Math.max(30, resizeImg.origW + dw), height: Math.max(30, resizeImg.origH + dh) });
      return;
    }
    // Text box drag
    if (dragTb) {
      const pos = getCanvasPos(e);
      const dx = pos.x - dragTb.startX;
      const dy = pos.y - dragTb.startY;
      updateTextBoxOnActivePage(dragTb.id, { x: dragTb.origX + dx, y: dragTb.origY + dy });
      return;
    }

    // Two-finger gesture
    if (gestureState.active && touchesRef.current.size === 2) {
      const touches = Array.from(touchesRef.current.values());
      const dx = touches[1].clientX - touches[0].clientX;
      const dy = touches[1].clientY - touches[0].clientY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const scale = dist / gestureState.initialDist;
      const newZoom = Math.max(0.25, Math.min(5, gestureState.initialZoom * scale));
      setZoom(newZoom);

      const midX = (touches[0].clientX + touches[1].clientX) / 2;
      const midY = (touches[0].clientY + touches[1].clientY) / 2;
      setPan(
        gestureState.initialPanX + (midX - gestureState.midX),
        gestureState.initialPanY + (midY - gestureState.midY)
      );
      return;
    }

    if (!isDrawing) return;
    if (e.pointerType === 'touch' && activeTool !== 'hand') return;

    const pos = getCanvasPos(e);

    if ((activeTool === 'pen' || activeTool === 'highlighter') && activeStroke) {
      const newPoint: Point = { x: pos.x, y: pos.y, pressure: e.pressure || 0.5, tiltX: e.tiltX, tiltY: e.tiltY, timestamp: Date.now() };
      setActiveStroke({ ...activeStroke, points: [...activeStroke.points, newPoint] });
    } else if (activeTool === 'eraser') {
      handleErase(pos.x, pos.y);
    } else if (activeTool === 'lasso') {
      setLassoPoints(prev => [...prev, { x: pos.x, y: pos.y, pressure: 0, timestamp: Date.now() }]);
    } else if (activeTool === 'line') {
      setLineEnd(pos);
    } else if (activeTool === 'shape') {
      setShapeEnd(pos);
    } else if (activeTool === 'hand') {
      setPan(panX + e.movementX, panY + e.movementY);
    }
  }, [isDrawing, activeTool, activeStroke, gestureState, zoom, panX, panY, getCanvasPos, dragImg, resizeImg, dragTb]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    touchesRef.current.delete(e.pointerId);

    // Clean up drag/resize
    if (dragImg) { setDragImg(null); return; }
    if (resizeImg) { setResizeImg(null); return; }
    if (dragTb) { setDragTb(null); return; }

    if (activeTool === 'eraser') setEraserPos(null);

    if (gestureState.active && touchesRef.current.size < 2) {
      setGestureState(g => ({...g, active: false}));
      return;
    }

    if (!isDrawing) return;

    if ((activeTool === 'pen' || activeTool === 'highlighter') && activeStroke) {
      let finalStroke = activeStroke;
      // Auto-straighten if nearly straight
      if (activeTool === 'pen' && isNearlyStraightLine(activeStroke.points)) {
        finalStroke = {
          ...activeStroke,
          tool: 'line',
          points: [activeStroke.points[0], activeStroke.points[activeStroke.points.length - 1]],
        };
      }
      addStrokeToActivePage(finalStroke);
      pushHistory({ type: 'stroke_add', pageIndex: activePageIndex, data: finalStroke, inverse: null });
    } else if (activeTool === 'lasso' && lassoPoints.length > 2) {
      // Find strokes inside lasso
      if (activePage) {
        const selectedIds = activePage.strokes.filter(s => {
          return s.points.some(p => pointInPolygon(p, lassoPoints));
        }).map(s => s.id);
        setSelectedStrokeIds(selectedIds);
      }
      setLassoPoints([]);
    } else if (activeTool === 'line' && lineStart && lineEnd) {
      const lineStroke: Stroke = {
        id: uuid(), tool: 'line', color: strokeColor, size: strokeSize, opacity: strokeOpacity,
        points: [
          { x: lineStart.x, y: lineStart.y, pressure: 0.5, timestamp: Date.now() },
          { x: lineEnd.x, y: lineEnd.y, pressure: 0.5, timestamp: Date.now() },
        ],
      };
      addStrokeToActivePage(lineStroke);
      pushHistory({ type: 'stroke_add', pageIndex: activePageIndex, data: lineStroke, inverse: null });
      setLineStart(null);
      setLineEnd(null);
    } else if (activeTool === 'shape' && shapeStart && shapeEnd) {
      const shapePoints = generateShapePoints(activeShape, shapeStart, shapeEnd);
      const shapeStroke: Stroke = {
        id: uuid(), tool: 'pen', color: strokeColor, size: strokeSize, opacity: strokeOpacity, points: shapePoints,
      };
      addStrokeToActivePage(shapeStroke);
      pushHistory({ type: 'stroke_add', pageIndex: activePageIndex, data: shapeStroke, inverse: null });
      setShapeStart(null);
      setShapeEnd(null);
    }

    setActiveStroke(null);
    setIsDrawing(false);
  }, [isDrawing, activeTool, activeStroke, lassoPoints, lineStart, lineEnd, shapeStart, shapeEnd, activeShape, strokeColor, strokeSize, strokeOpacity, activePageIndex, activePage, gestureState]);

  // ─── Eraser logic ───────────────────────────────────────
  const handleErase = useCallback((x: number, y: number) => {
    if (!activePage) return;
    const toRemove = activePage.strokes.filter(s =>
      strokeIntersectsCircle(s.points, x, y, eraserSize / 2)
    );
    if (toRemove.length > 0) {
      removeStrokesFromActivePage(toRemove.map(s => s.id));
      pushHistory({ type: 'stroke_remove', pageIndex: activePageIndex, data: toRemove, inverse: null });
    }
  }, [activePage, eraserSize, activePageIndex]);

  // ─── Text creation ──────────────────────────────────────
  const handleTextCreate = useCallback((x: number, y: number) => {
    const tb: TextBox = {
      id: uuid(), x, y, width: 200, height: 40,
      content: '', fontSize: 16, fontFamily: 'Inter',
      color: strokeColor, bold: false, italic: false, underline: false, strikethrough: false,
    };
    useNoteStore.getState().addTextBoxToActivePage(tb);
    pushHistory({ type: 'text_add', pageIndex: activePageIndex, data: tb, inverse: null });
    useNoteStore.getState().setSelectedTextBoxId(tb.id);
    useNoteStore.getState().setActiveTool('hand');
  }, [strokeColor, activePageIndex]);

  // ─── Shape points generation ────────────────────────────
  const generateShapePoints = (shape: string, start: {x:number;y:number}, end: {x:number;y:number}): Point[] => {
    const mkPt = (x:number, y:number): Point => ({x,y,pressure:0.5,timestamp:Date.now()});
    const x = Math.min(start.x, end.x), y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x), h = Math.abs(end.y - start.y);

    switch (shape) {
      case 'rectangle':
        return [mkPt(x,y), mkPt(x+w,y), mkPt(x+w,y+h), mkPt(x,y+h), mkPt(x,y)];
      case 'ellipse': {
        const pts: Point[] = [];
        for (let a = 0; a <= Math.PI * 2; a += 0.1) {
          pts.push(mkPt(x + w/2 + (w/2)*Math.cos(a), y + h/2 + (h/2)*Math.sin(a)));
        }
        return pts;
      }
      case 'triangle':
        return [mkPt(x+w/2,y), mkPt(x+w,y+h), mkPt(x,y+h), mkPt(x+w/2,y)];
      default:
        return [mkPt(start.x,start.y), mkPt(end.x,end.y)];
    }
  };

  // ─── Wheel zoom ─────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(zoom * delta);
    } else {
      setPan(panX - e.deltaX, panY - e.deltaY);
    }
  }, [zoom, panX, panY]);

  if (!activePage) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{background: 'var(--color-bg)'}}>
        <div className="text-center" style={{color: 'var(--color-text-secondary)'}}>
          <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
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
      className="canvas-container"
      onWheel={handleWheel}
      style={{
        cursor: activeTool === 'hand' ? 'grab' : activeTool === 'eraser' ? 'none' : 'crosshair',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: 'center center',
          position: 'relative',
          width: pageSize.width,
          height: pageSize.height,
          boxShadow: '0 4px 32px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
          borderRadius: '4px',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {/* Background layer */}
        <canvas
          ref={bgCanvasRef}
          width={pageSize.width}
          height={pageSize.height}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        />
        {/* Strokes layer */}
        <canvas
          ref={strokeCanvasRef}
          width={pageSize.width}
          height={pageSize.height}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        />
        {/* Active drawing layer */}
        <canvas
          ref={activeCanvasRef}
          width={pageSize.width}
          height={pageSize.height}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />

        {/* Text boxes — draggable, editable */}
        {activePage.textBoxes.map(tb => (
          <div
            key={tb.id}
            className={`canvas-textbox ${selectedTextBoxId === tb.id ? 'selected' : ''}`}
            contentEditable
            suppressContentEditableWarning
            style={{
              left: tb.x, top: tb.y, width: tb.width, minHeight: tb.height,
              fontSize: tb.fontSize, fontFamily: tb.fontFamily, color: tb.color,
              fontWeight: tb.bold ? 'bold' : 'normal',
              fontStyle: tb.italic ? 'italic' : 'normal',
              textDecoration: [tb.underline ? 'underline' : '', tb.strikethrough ? 'line-through' : ''].join(' ').trim() || 'none',
            }}
            onClick={(e) => { e.stopPropagation(); setSelectedTextBoxId(tb.id); }}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) {
                e.stopPropagation();
                const pos = getCanvasPos(e);
                setDragTb({ id: tb.id, startX: pos.x, startY: pos.y, origX: tb.x, origY: tb.y });
                setSelectedTextBoxId(tb.id);
              }
            }}
            onInput={(e) => {
              updateTextBoxOnActivePage(tb.id, { content: (e.target as HTMLElement).textContent || '' });
            }}
          >
            {tb.content}
          </div>
        ))}

        {/* Images — draggable, resizable with handles */}
        {activePage.images.map(img => (
          <div
            key={img.id}
            className={`canvas-image ${selectedImageId === img.id ? 'selected' : ''}`}
            style={{ left: img.x, top: img.y, width: img.width, height: img.height }}
            onPointerDown={(e) => {
              e.stopPropagation();
              setSelectedImageId(img.id);
              const pos = getCanvasPos(e);
              setDragImg({ id: img.id, startX: pos.x, startY: pos.y, origX: img.x, origY: img.y });
            }}
          >
            <img src={img.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} draggable={false} />
            {/* Resize handle */}
            <div
              className="resize-handle"
              style={{ bottom: -5, right: -5 }}
              onPointerDown={(e) => {
                e.stopPropagation();
                const pos = getCanvasPos(e);
                setResizeImg({ id: img.id, startX: pos.x, startY: pos.y, origW: img.width, origH: img.height });
              }}
            />
            {/* Delete button */}
            <div
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                const removed = activePage.images.find(i => i.id === img.id);
                removeImageFromActivePage(img.id);
                if (removed) pushHistory({ type: 'image_remove', pageIndex: activePageIndex, data: removed, inverse: null });
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12"/></svg>
            </div>
          </div>
        ))}

        {/* Audio Widgets */}
        {activePage.audioIds.map(audioId => (
          <AudioWidget
            key={audioId}
            audioId={audioId}
            onDelete={() => {
              useNoteStore.getState().removeAudioIdFromActivePage(audioId);
            }}
          />
        ))}
      </div>

      {/* Eraser cursor overlay */}
      {activeTool === 'eraser' && eraserPos && (
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

export default CanvasEngine;
