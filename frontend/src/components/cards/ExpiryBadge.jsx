import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { expiryNotice } from './cardFormat';

/**
 * Pastilla "Vencida · actualiza la fecha" o "Vence pronto" bajo una tarjeta (FT-0065). Nada si falta.
 * @param {{ card: object }} props
 */
export default function ExpiryBadge({ card }) {
  const notice = expiryNotice(card);
  if (!notice) return null;
  return (
    <p
      className={cn(
        'mt-2 flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
        notice.tone === 'negative' ? 'bg-negative/10 text-negative' : 'bg-caution/15 text-ink',
      )}
    >
      <CalendarClock className="size-4" aria-hidden="true" />
      {notice.text}
    </p>
  );
}
