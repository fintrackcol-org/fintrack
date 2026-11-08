import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, FileText, Loader2, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatSize } from '@/components/transactions/AttachmentsPanel';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { prepareUpload } from '@/lib/compressImage';

/**
 * @typedef {object} PendingFile Soporte elegido antes de guardar el movimiento.
 * @property {string} id Solo para la lista en pantalla.
 * @property {Blob} blob Archivo listo para subir (la foto ya comprimida).
 * @property {string} name
 */

/**
 * Elegir soportes (foto o PDF) mientras se anota un gasto o un ingreso, antes de que el movimiento
 * exista: quedan en la lista y se suben al guardar con `uploadPending`. Si el usuario no tiene los
 * soportes activos (`limits` en `null`), no se muestra nada.
 *
 * @param {object} props
 * @param {PendingFile[]} props.files
 * @param {(files: PendingFile[]) => void} props.onChange
 * @param {{ max: number, maxBytes: number }|null} props.limits De `useAttachmentLimits`.
 * @param {string} [props.className]
 */
export default function AttachmentPicker({ files, onChange, limits, className }) {
  const online = useOnlineStatus();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const cameraInput = useRef(null);
  const fileInput = useRef(null);

  // Miniaturas de las fotos: se crean al mostrarlas y se liberan al quitarlas o al salir.
  const previews = useMemo(
    () => Object.fromEntries(files.filter((f) => f.blob.type.startsWith('image/')).map((f) => [f.id, URL.createObjectURL(f.blob)])),
    [files],
  );
  useEffect(() => () => Object.values(previews).forEach((url) => URL.revokeObjectURL(url)), [previews]);

  if (!limits) return null;

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // permite elegir el mismo archivo otra vez
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const { blob, name } = await prepareUpload(file);
      if (blob.size > limits.maxBytes) throw new Error('El archivo pesa más de 5 MB.');
      onChange([...files, { id: crypto.randomUUID(), blob, name }]);
    } catch (err) {
      setMessage(err.message || 'No pudimos leer el archivo.');
    } finally {
      setBusy(false);
    }
  };

  const full = files.length >= limits.max;

  return (
    <section aria-labelledby="adjuntar-soportes" className={className}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 id="adjuntar-soportes" className="flex items-center gap-2 text-sm font-medium">
          <Paperclip className="size-4 text-brand" aria-hidden="true" /> Soportes{' '}
          <span className="font-normal text-ink/50">(opcional)</span>
        </h3>
        {files.length > 0 && (
          <span className="text-sm text-ink/60">
            {files.length} de {limits.max}
          </span>
        )}
      </div>

      {files.length > 0 && (
        <ul className="mb-2 flex flex-col gap-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-xl bg-ink/5 p-2">
              {previews[f.id] ? (
                <img src={previews[f.id]} alt="" className="size-10 flex-none rounded-lg object-cover" />
              ) : (
                <span className="grid size-10 flex-none place-items-center rounded-lg bg-brand-soft text-brand">
                  <FileText className="size-5" aria-hidden="true" />
                </span>
              )}
              <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate font-medium">{f.name}</span>
                <span className="text-xs text-ink/60">{formatSize(f.blob.size)} · Se sube al guardar</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Quitar ${f.name}`}
                onClick={() => onChange(files.filter((other) => other.id !== f.id))}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {!online ? (
        <p className="text-sm text-ink/60">Sin conexión no se pueden adjuntar soportes. Podrás hacerlo desde el movimiento.</p>
      ) : (
        !full && (
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => cameraInput.current?.click()}>
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Camera aria-hidden="true" />}
              Tomar foto
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>
              <FileText aria-hidden="true" /> Subir archivo
            </Button>
          </div>
        )
      )}
      {/* `capture`: en el celular abre la cámara directo. */}
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={fileInput} type="file" accept="image/*,application/pdf" hidden onChange={pick} />

      {message && (
        <p role="alert" className="mt-2 text-sm text-negative">
          {message}
        </p>
      )}
      {files.length === 0 && online && (
        <p className="mt-2 text-xs text-ink/50">Foto de la factura o PDF, hasta {limits.max} y de 5 MB cada uno.</p>
      )}
    </section>
  );
}
