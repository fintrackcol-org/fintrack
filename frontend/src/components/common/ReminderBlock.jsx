import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ChipGroup from '@/components/common/ChipGroup';
import { Input } from '@/components/ui/input';
import { REMINDER_CHANNEL_OPTIONS, REMINDER_DAY_OPTIONS, reminderSummary } from '@/lib/reminder';
import { getWhatsappLink } from '@/services/whatsappService';
import { t } from '@/lib/i18n';

const TIME_OPTIONS = [
  { value: 'default', label: t('A mi hora de avisos') },
  { value: 'custom', label: t('Otra hora') },
];

/**
 * Bloque "Avisarme" (FT-0063): cuándo, a qué hora y por dónde avisar de algo con fecha. Es el mismo
 * en cuentas, tarjetas, suscripciones y calendario: se usa tal cual, sin copiarlo.
 * Sin días elegidos no hay aviso, y la hora y el canal se esconden.
 *
 * @param {object} props
 * @param {import('@/lib/reminder').Reminder} props.value
 * @param {(value: import('@/lib/reminder').Reminder) => void} props.onChange
 * @param {boolean} [props.disabled]
 */
export default function ReminderBlock({ value, onChange, disabled = false }) {
  // `null` mientras no se sabe (o sin conexión): no se muestra ninguna advertencia.
  const [whatsappLinked, setWhatsappLinked] = useState(null);
  // "Otra hora" puede estar elegida antes de escribir la hora.
  const [customTime, setCustomTime] = useState(value.time !== null);

  useEffect(() => {
    let cancelled = false;
    getWhatsappLink()
      .then((link) => !cancelled && setWhatsappLinked(link.linked))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (patch) => onChange({ ...value, ...patch });
  const pickTime = (mode) => {
    setCustomTime(mode === 'custom');
    set({ time: mode === 'custom' ? (value.time ?? '08:00') : null });
  };
  const active = value.daysBefore.length > 0;
  const needsWhatsapp = value.channel !== 'push' && whatsappLinked === false;

  return (
    <div className="space-y-4 rounded-2xl border border-ink/10 p-4">
      <ChipGroup multiple legend={t('Avisarme')} options={REMINDER_DAY_OPTIONS} value={value.daysBefore} onChange={(daysBefore) => set({ daysBefore })} disabled={disabled} />
      {active && (
        <>
          <div className="space-y-2">
            <ChipGroup legend={t('¿A qué hora?')} options={TIME_OPTIONS} value={customTime ? 'custom' : 'default'} onChange={pickTime} disabled={disabled} />
            {customTime && (
              <Input
                type="time"
                aria-label={t('Hora del aviso')}
                value={value.time ?? ''}
                // Si la borran, vuelve a la hora de Notificaciones: nunca se guarda una hora vacía.
                onChange={(e) => set({ time: e.target.value || null })}
                disabled={disabled}
              />
            )}
          </div>
          <ChipGroup legend={t('¿Por dónde?')} options={REMINDER_CHANNEL_OPTIONS} value={value.channel} onChange={(channel) => set({ channel })} disabled={disabled} />
          {needsWhatsapp && (
            <p className="text-sm text-caution">
              {t('Aún no has conectado WhatsApp: mientras tanto te llega por notificación.')}{' '}
              <Link to="/app/cuenta" className="font-medium underline underline-offset-2">
                {t('Conectarlo')}
              </Link>
            </p>
          )}
        </>
      )}
      <p aria-live="polite" className="text-sm text-ink/60">
        {reminderSummary(value)}
      </p>
    </div>
  );
}
