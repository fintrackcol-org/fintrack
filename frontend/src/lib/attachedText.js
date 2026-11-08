/**
 * Aviso tras guardar un movimiento con soportes elegidos al anotar.
 * @param {{ uploaded: number, failed: string[] }|null|undefined} attached Lo que devolvió `uploadPending`.
 * @returns {string} Vacío si no se eligió ningún soporte.
 */
export function attachedText(attached) {
  if (!attached) return '';
  const { uploaded, failed } = attached;
  const ok = uploaded === 1 ? '1 soporte adjunto' : `${uploaded} soportes adjuntos`;
  if (failed.length === 0) return `${ok}.`;
  const missing = failed.length === 1 ? `No se subió "${failed[0]}"` : `No se subieron ${failed.length} soportes`;
  return `${uploaded > 0 ? `${ok}. ` : ''}${missing}: adjúntalo desde el detalle del movimiento.`;
}
