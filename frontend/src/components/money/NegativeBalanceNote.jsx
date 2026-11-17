import { Link } from 'react-router-dom';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Plata en negativo casi siempre es un dato mal anotado (un cero de más, un ingreso que faltó):
 * se dice y se lleva a revisar los gastos, en vez de dejar el número solo. Toma el color del texto
 * de alrededor, así sirve sobre la franja violeta y sobre fondo claro. No dice montos: sale aunque
 * estén ocultos.
 * @param {{ money: number|null|undefined, className?: string }} props
 */
export default function NegativeBalanceNote({ money, className }) {
  if (typeof money !== 'number' || money >= 0) return null;
  return (
    <p className={cn('flex items-start gap-2 text-sm', className)}>
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        Tus gastos superan lo que tienes. ¿Anotaste algo mal?{' '}
        <Link to="/app/gastos" className="inline-flex min-h-6 items-center font-medium underline underline-offset-2">
          Revisa tus gastos
        </Link>
      </span>
    </p>
  );
}
