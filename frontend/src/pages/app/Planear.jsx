import { CalendarDays, CreditCard, Flag, HandCoins, Repeat, Target } from 'lucide-react';
import ShortcutGrid from '@/components/common/ShortcutGrid';
import PageHeader from '@/components/layout/PageHeader';
import usePageTitle from '@/hooks/usePageTitle';
import { t } from '@/lib/i18n';

/** Lo que viene: pagos, topes, metas y deudas (Rinde v5). Exportado para la prueba de navegación. */
export const PLAN_ITEMS = [
  { to: '/app/mi-plata/pagos', label: t('Pagos fijos'), hint: t('Lo que se repite cada mes'), icon: Repeat },
  { to: '/app/calendario', label: t('Calendario'), hint: t('Qué toca pagar y cuándo'), icon: CalendarDays },
  { to: '/app/presupuestos', label: t('Presupuestos'), hint: t('Topes por categoría'), icon: Target },
  { to: '/app/metas', label: t('Metas'), hint: t('Para qué estás ahorrando'), icon: Flag },
  { to: '/app/cuentas', label: t('Deudas'), hint: t('Lo que te deben y debes'), icon: HandCoins },
  { to: '/app/tarjetas', label: t('Tarjetas'), hint: t('Cupo y fechas de pago'), icon: CreditCard },
];

/** Pestaña Planear: la regla es «Inicio es hoy, Movimientos lo que ya pasó, Planear lo que viene». */
export default function Planear() {
  usePageTitle(t('Planear'));
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader title={t('Planear')} description={t('Lo que viene y lo que quieres lograr.')} />
      <ShortcutGrid id="planear-accesos" title={t('Tus planes')} items={PLAN_ITEMS} />
    </div>
  );
}
