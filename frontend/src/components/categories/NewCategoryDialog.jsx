import { lazy, Suspense, useRef } from 'react';
import { t } from '@/lib/i18n';

// La ventana (con framer-motion, ~41 KB gzip) baja la primera vez que se abre, no con la página
// (auditoría H4).
const NewCategoryDialogPanel = lazy(() => import('./NewCategoryDialogPanel'));

/** Largo máximo del nombre, igual que en la API. */
export const NAME_MAX = 30;

/**
 * Categoría a la que pasan los movimientos de una propia que se elimina.
 * @param {'gasto'|'ingreso'} type
 */
export const fallbackName = (type) => (type === 'ingreso' ? t('Otros ingresos') : t('Otros'));

/**
 * Mensaje tras eliminar: cuántos movimientos cambiaron de categoría y a cuál.
 * @param {number} moved
 * @param {'gasto'|'ingreso'} type
 * @returns {string}
 */
export function deletedMessage(moved, type) {
  if (moved === 0) return t('Categoría eliminada.');
  return t('Categoría eliminada. {moved} {v2} a {type}.', { moved, v2: moved === 1 ? t('movimiento pasó') : 'movimientos pasaron', type: fallbackName(type) });
}

/**
 * Ventana para crear o editar una categoría propia. Misma interfaz que `NewCategoryDialogPanel`,
 * que es quien la dibuja. Una vez abierta se queda montada: así conserva su animación de cierre.
 * @param {{ open: boolean } & Record<string, any>} props
 */
export default function NewCategoryDialog(props) {
  const opened = useRef(false);
  if (props.open) opened.current = true;
  if (!opened.current) return null;
  return (
    <Suspense fallback={null}>
      <NewCategoryDialogPanel {...props} />
    </Suspense>
  );
}
