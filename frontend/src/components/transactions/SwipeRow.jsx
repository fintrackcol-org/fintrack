import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Ancho de las dos acciones (Editar y Eliminar), en px. */
const ACTIONS = 144;
/** Cuánto hay que mover el dedo antes de decidir si es un deslizamiento o un scroll. */
const SLOP = 8;

/**
 * Fila que se desliza a la izquierda para mostrar Editar y Eliminar (Rinde v2, Movimientos). Solo
 * se mueve con `transform` y se decide por distancia o velocidad: un deslizamiento corto y rápido
 * también abre. El scroll vertical sigue funcionando (`touch-action: pan-y`) y, si el dedo se movió,
 * soltarlo no abre el detalle. Con teclado o lector de pantalla las acciones están en el detalle.
 * `children` son los `<li>` de la fila (va dentro de una lista); `listClassName` le da forma a esa lista.
 * @param {{ children: import('react').ReactNode, editTo: string, editState?: object, onDelete: () => void, label: string, listClassName?: string }} props
 */
export default function SwipeRow({ children, editTo, editState, onDelete, label, listClassName }) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef(null);
  const moved = useRef(false);
  const open = offset !== 0 && !dragging;

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    moved.current = false;
    gesture.current = { x: event.clientX, y: event.clientY, base: offset, axis: null, t: event.timeStamp, last: event.clientX };
  };

  const onPointerMove = (event) => {
    const g = gesture.current;
    if (!g) return;
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    if (!g.axis) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (g.axis === 'x') {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }
    }
    if (g.axis !== 'x') return;
    moved.current = true;
    g.velocity = (event.clientX - g.last) / Math.max(event.timeStamp - g.t, 1);
    g.last = event.clientX;
    g.t = event.timeStamp;
    // Más allá del borde se frena (como en iOS), para que se sienta que hay un límite.
    const next = g.base + dx;
    setOffset(next > 0 ? 0 : next < -ACTIONS ? -ACTIONS + (next + ACTIONS) / 4 : next);
  };

  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.axis !== 'x') return;
    setDragging(false);
    const fling = g.velocity ?? 0;
    const shouldOpen = fling < -0.4 || (fling < 0.4 && offset < -ACTIONS / 2);
    setOffset(shouldOpen ? -ACTIONS : 0);
  };

  return (
    <li className="relative overflow-hidden rounded-2xl">
      {/* Cerrada, las acciones no se pintan: así no asoman por las esquinas redondeadas. */}
      <div className={cn('absolute inset-y-0 right-0 flex', offset === 0 && !dragging && 'invisible')} aria-hidden={!open}>
        <Link
          to={editTo}
          state={editState}
          tabIndex={open ? 0 : -1}
          aria-label={`Editar ${label}`}
          className="flex w-[72px] flex-col items-center justify-center gap-1 bg-brand text-xs font-semibold text-white focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
        >
          <Pencil className="size-5" aria-hidden="true" />
          Editar
        </Link>
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          onClick={() => (setOffset(0), onDelete())}
          aria-label={`Eliminar ${label}`}
          className="flex w-[72px] flex-col items-center justify-center gap-1 bg-negative text-xs font-semibold text-white focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
        >
          <Trash2 className="size-5" aria-hidden="true" />
          Eliminar
        </button>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // Si el dedo se movió, soltarlo no abre el detalle; con la fila abierta, tocarla la cierra.
        onClickCapture={(event) => {
          if (moved.current || open) {
            event.preventDefault();
            event.stopPropagation();
            if (open && !moved.current) setOffset(0);
          }
          moved.current = false;
        }}
        className={cn(
          'relative touch-pan-y select-none bg-surface',
          !dragging && 'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
        )}
        style={{ transform: `translate3d(${offset}px, 0, 0)` }}
      >
        <ul className={cn('m-0', listClassName)}>{children}</ul>
      </div>
    </li>
  );
}
