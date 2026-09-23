import {useEffect, useRef, useState, type PointerEvent, type KeyboardEvent} from 'react';
import {companionGeometry, normalizeCompanionPosition, type CompanionPosition} from '../progress/companionPosition';

const STORAGE_KEY = 'sight-reading-companion-position-v1';
function viewport() {
  const view = window.visualViewport;
  return {width: view?.width ?? window.innerWidth, height: view?.height ?? window.innerHeight, left: view?.offsetLeft ?? 0, top: view?.offsetTop ?? 0};
}
function save(position: CompanionPosition) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(position)); } catch { /* Movement works without storage. */ }
}

export function useCompanionDrag() {
  const [position, setPosition] = useState(() => {
    try { return normalizeCompanionPosition(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); }
    catch { return normalizeCompanionPosition(null); }
  });
  const [view, setView] = useState(viewport);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{id: number; x: number; y: number; left: number; top: number; moved: boolean} | null>(null);
  const latest = useRef(position);
  const suppressClick = useRef(false);
  const geometry = companionGeometry(view, position);

  useEffect(() => {
    const resize = () => setView(viewport());
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);
    return () => {
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
    };
  }, []);

  const finish = (event: PointerEvent<HTMLButtonElement>) => {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    suppressClick.current = active.moved;
    gesture.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (active.moved) save(latest.current);
  };

  return {geometry, dragging, consumeDragClick: () => {
    const value = suppressClick.current;
    suppressClick.current = false;
    return value;
  }, handlers: {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (!event.isPrimary || event.button !== 0 || gesture.current) return;
      suppressClick.current = false;
      gesture.current = {id: event.pointerId, x: event.clientX, y: event.clientY, left: geometry.left, top: geometry.top, moved: false};
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      const active = gesture.current;
      if (!active || active.id !== event.pointerId) return;
      const dx = event.clientX - active.x, dy = event.clientY - active.y;
      if (!active.moved && Math.hypot(dx, dy) < 6) return;
      active.moved = true;
      event.preventDefault();
      const next = normalizeCompanionPosition({
        x: geometry.travelX ? (active.left + dx - view.left - 12) / geometry.travelX : 0,
        y: geometry.travelY ? (active.top + dy - view.top - 12) / geometry.travelY : 0,
      });
      latest.current = next;
      setPosition(next);
      setDragging(true);
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onLostPointerCapture: finish,
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      const vectors: Record<string, [number, number]> = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
      const direction = vectors[event.key];
      if (!direction) return;
      event.preventDefault();
      const step = event.shiftKey ? 5 : 20;
      const next = normalizeCompanionPosition({x: position.x + direction[0] * step / (geometry.travelX || 1), y: position.y + direction[1] * step / (geometry.travelY || 1)});
      latest.current = next;
      setPosition(next);
      save(next);
    },
  }};
}
