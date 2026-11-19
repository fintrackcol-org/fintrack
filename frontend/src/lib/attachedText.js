
import { t } from '@/lib/i18n';/**
 * Aviso tras guardar un movimiento con soportes elegidos al anotar.
 * @param {{ uploaded: number, failed: string[] }|null|undefined} attached Lo que devolvió `uploadPending`.
 * @returns {string} Vacío si no se eligió ningún soporte.
 */
export function attachedText(attached) {
  if (!attached) return '';
  const { uploaded, failed } = attached;
  const ok = uploaded === 1 ? t('1 soporte adjunto') : t('{uploaded} soportes adjuntos', { uploaded });
  if (failed.length === 0) return `${ok}.`;
  const missing = failed.length === 1 ? t('No se subió "{v1}"', { v1: failed[0] }) : t('No se subieron {length} soportes', { length: failed.length });
  return t('{v1}{missing}: adjúntalo desde el detalle del movimiento.', { v1: uploaded > 0 ? `${ok}. ` : '', missing });
}
