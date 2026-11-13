import { useId, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { saveTransactionChanges } from '@/offline/saveTransactionChanges';
import { emotionOf } from './reflection';
import { EmotionPicker } from './ReflectionPickers';

/**
 * "¿Cómo te sentiste?" en la pantalla de gasto guardado (FT-0070). Es opcional: se cierra con un
 * toque en "Ahora no" y nunca frena el registro. Al elegir una cara se guarda de una vez; tocarla
 * otra vez la quita. Va sobre el fondo violeta, por eso usa el tono claro.
 * @param {{ transaction: object, className?: string }} props El gasto recién guardado (con `id`).
 */
export default function FeelingPrompt({ transaction, className }) {
  const titleId = useId();
  const [current, setCurrent] = useState(transaction);
  const [closed, setClosed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (closed) return null;

  const pick = async (emotion) => {
    const before = current;
    setError('');
    setSaving(true);
    setCurrent({ ...current, emotion }); // se ve elegida al instante
    try {
      const { transaction: saved } = await saveTransactionChanges(before, {
        emotion,
      });
      setCurrent(saved);
    } catch (err) {
      setCurrent(before);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const chosen = emotionOf(current.emotion);
  return (
    <section
      aria-labelledby={titleId}
      className={cn('rounded-2xl bg-white/15 p-4 motion-safe:animate-done-in', className)}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-[17px] font-semibold">
          ¿Cómo te sentiste?
        </h2>
        <button
          type="button"
          onClick={() => setClosed(true)}
          className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-[15px] text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
        >
          <X className="size-4" aria-hidden="true" />
          Ahora no
        </button>
      </div>
      <EmotionPicker
        tone="light"
        value={current.emotion ?? null}
        onChange={pick}
        disabled={saving}
        labelledBy={titleId}
      />
      <p role={error ? 'alert' : 'status'} className="mt-3 min-h-5 text-[13px] text-white/85">
        {error || (chosen ? `Anotado como «${chosen.label}». Lo verás en tu reflexión de la semana.` : '')}
      </p>
    </section>
  );
}
