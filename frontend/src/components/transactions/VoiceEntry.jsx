import { lazy, Suspense, useRef } from 'react';

// La tarjeta (con framer-motion, ~41 KB gzip) baja la primera vez que se abre, no con la página
// (auditoría H4). La usan la barra rápida y Anotar.
const VoiceEntryPanel = lazy(() => import('./VoiceEntryPanel'));

/**
 * Tarjeta para dictar o confirmar un movimiento. Misma interfaz que `VoiceEntryPanel`, que es quien
 * la dibuja. Una vez abierta se queda montada: así conserva su animación de cierre.
 * @param {{ open: boolean } & Record<string, any>} props
 */
export default function VoiceEntry(props) {
  const opened = useRef(false);
  if (props.open) opened.current = true;
  if (!opened.current) return null;
  return (
    <Suspense fallback={null}>
      <VoiceEntryPanel {...props} />
    </Suspense>
  );
}
