import { cn } from '@/lib/utils';
import { passwordStrength } from '@/lib/validation/passwordStrength';
import { t } from '@/lib/i18n';

const TONE = { 1: 'bg-negative', 2: 'bg-violet-light', 3: 'bg-success' };
const TEXT = { 0: 'text-white/55', 1: 'text-[#ff8a80]', 2: 'text-violet-light', 3: 'text-success' };

/**
 * Fuerza de la contraseña en vivo (Rinde v2): tres rayas, "Débil / Media / Fuerte" y qué le falta
 * para mejorar. Va debajo del campo; el lector de pantalla la oye al dejar de escribir.
 * @param {{ password?: string, id?: string }} props
 */
export default function PasswordStrength({ password = '', id }) {
  const { score, label, tips } = passwordStrength(password);
  return (
    <div id={id} className="space-y-1.5">
      <div aria-hidden="true" className="grid grid-cols-3 gap-1.5">
        {[1, 2, 3].map((n) => (
          <span key={n} className={cn('h-1 rounded-full transition-colors', score >= n ? TONE[score] : 'bg-white/15')} />
        ))}
      </div>
      <p className="text-xs text-white/60" aria-live="polite">
        {password ? (
          <>
            <b className={cn('font-semibold', TEXT[score])}>{label}.</b>{' '}
            {tips.length ? t('Para mejorarla: {join}.', { join: tips.join(' y ') }) : t('Lista.')}
          </>
        ) : (
          t('Usa 8 caracteres o más, con letras y números.')
        )}
      </p>
    </div>
  );
}
