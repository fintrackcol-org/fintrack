import { lazy, Suspense, useRef } from 'react';

// framer-motion (~41 KB gzip) baja la primera vez que se abre una hoja, no con la página
// (auditoría H4). Todas las hojas de la app pasan por aquí.
const SheetPanel = lazy(() => import('./SheetPanel'));

/**
 * Hoja inferior (celular) o ventana centrada (escritorio). Misma interfaz que `SheetPanel`, que es
 * quien la dibuja. Una vez abierta se queda montada: así conserva su animación de cierre.
 * @param {{ open: boolean, title: string, description?: string, onClose: () => void, children: import('react').ReactNode }} props
 */
export default function Sheet(props) {
  const opened = useRef(false);
  if (props.open) opened.current = true;
  if (!opened.current) return null;
  return (
    <Suspense fallback={null}>
      <SheetPanel {...props} />
    </Suspense>
  );
}
