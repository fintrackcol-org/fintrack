import { useEffect, useState } from 'react';
import { getAttachmentLimits } from '@/services/attachmentService';

/**
 * Límites de los soportes si el usuario los puede adjuntar; `null` mientras carga, si no los
 * tiene activos o sin conexión. Así los formularios de anotar solo ofrecen adjuntar cuando sirve.
 * @returns {{ max: number, maxBytes: number }|null}
 */
export default function useAttachmentLimits() {
  const [limits, setLimits] = useState(null);
  useEffect(() => {
    let cancelled = false;
    getAttachmentLimits()
      .then((data) => !cancelled && setLimits(data.enabled ? { max: data.max, maxBytes: data.maxBytes } : null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return limits;
}
