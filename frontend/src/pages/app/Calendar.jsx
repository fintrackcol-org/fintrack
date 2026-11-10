import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ChevronLeft, ChevronRight, CircleAlert, HandCoins, Loader2, Plus } from 'lucide-react';
import MonthGrid from '@/components/common/MonthGrid';
import Sheet from '@/components/common/Sheet';
import DebtForm from '@/components/debts/DebtForm';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import useAsync from '@/hooks/useAsync';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { dayLabel, monthLabel, shiftMonth } from '@/lib/calendar';
import { FILTERS, LEGEND, STATUS_TEXT, calendarCells, eventLink, filterEvents, groupByDate, shortMoney } from '@/lib/paymentCalendar';
import { cn } from '@/lib/utils';
import { CommitmentDialog, EMPTY_COMMITMENT } from '@/pages/app/MiPlata';
import { createDebt } from '@/services/debtService';
import { getLiquidity, getPaymentCalendar } from '@/services/moneyProfileService';

/** Color de cada tono de la cuadrícula y del saldo: el semáforo, más lo que no se calcula y lo que entra. */
const TONE_CLASS = {
  negativo: 'text-negative',
  riesgo: 'text-caution',
  ok: 'text-positive',
  pago: 'text-ink/60',
  ingreso: 'text-brand',
};

/** El punto de la leyenda, del mismo color que la cifra del día. */
const DOT_CLASS = { negativo: 'bg-negative', riesgo: 'bg-caution', ok: 'bg-positive' };

const RISK_TEXT = {
  negativo: 'No te alcanza',
  riesgo: 'Te queda poco',
};

/** Qué dice el lector de pantalla de cada tono (el color no puede ser lo único). */
const TONE_SPOKEN = {
  negativo: 'no alcanza o está atrasado',
  riesgo: 'te queda poco',
  ok: 'te alcanza',
  pago: 'por pagar',
  ingreso: 'te entra plata',
};

/**
 * Cuadrícula del mes con el total por pagar de cada día, del color del semáforo, y su leyenda.
 * Cada día se puede tocar para ver lo que tiene y agregarle algo (FT-0069).
 * @param {{ month: string, events: object[], today: string, shortfallDate?: string, onSelect: (date: string) => void }} props
 */
function PaymentGrid({ month, events, today, shortfallDate, onSelect }) {
  // El día en que el motor de liquidez dice que falta plata va en rojo (FT-0059).
  const toneOfCell = (cell) => (cell.date === shortfallDate ? 'negativo' : cell.tone);
  return (
    <MonthGrid
      label={`Pagos de ${monthLabel(month)}`}
      cells={calendarCells(month, events, today)}
      onSelect={(cell) => onSelect(cell.date)}
      cellLabel={(cell) => {
        const tone = toneOfCell(cell);
        const what = cell.count === 0 ? 'sin pagos' : `${cell.count} ${cell.count === 1 ? 'elemento' : 'elementos'}`;
        return `${dayLabel(cell.date)}, ${what}${tone ? `, ${TONE_SPOKEN[tone]}` : ''}`;
      }}
      renderMark={(cell) => {
        const tone = toneOfCell(cell);
        if (!tone) return null;
        // El rojo lleva además un signo: no depende solo del color.
        const text = cell.total > 0 ? shortMoney(cell.total) : '•';
        return { text: tone === 'negativo' ? `!${cell.total > 0 ? ` ${text}` : ''}` : text, className: TONE_CLASS[tone] };
      }}
      footer={
        <ul aria-label="Qué significa cada color" className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-ink/10 pt-3 text-xs text-ink/70">
          {LEGEND.map(({ tone, label }) => (
            <li key={tone} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn('size-2 rounded-full', DOT_CLASS[tone])} />
              {label}
            </li>
          ))}
        </ul>
      }
    />
  );
}

/**
 * Un pago, un cobro o un día de pago, con cuánto queda después. Lleva a su detalle.
 * @param {{ event: object }} props
 */
function EventRow({ event }) {
  const income = event.kind === 'ingreso';
  const receivable = event.kind === 'cobro';
  const paid = event.status === 'pagado';
  let detail = income ? 'Te entra plata' : STATUS_TEXT[event.status];
  if (event.kind === 'vaca' && !paid) detail = `${detail} · tu aporte a la vaca`;
  if (event.kind === 'cuenta') detail = `${detail} · le debes`;
  if (receivable) detail = event.status === 'atrasado' ? 'Atrasado · te debe' : 'Te debe · no se suma a tu plata';
  return (
    <li>
      <Link
        to={eventLink(event)}
        className="flex min-h-14 items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-3 transition-colors hover:bg-ink/5 active:bg-ink/5 focus-visible:outline-2 focus-visible:outline-violet"
      >
        <span
          aria-hidden="true"
          className={cn(
            'grid size-10 flex-none place-items-center rounded-full bg-ink/5 font-bold',
            income || receivable ? 'text-positive' : event.kind === 'vaca' ? 'text-caution' : 'text-brand',
          )}
        >
          {income ? '$' : event.name[0].toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate font-medium', paid && 'text-ink/50 line-through')}>{event.name}</span>
          <span className={cn('block text-xs text-ink/60', event.status === 'atrasado' && 'text-negative')}>{detail}</span>
          {event.balanceAfter !== null && (
            <span className={cn('block text-xs', TONE_CLASS[event.risk] ?? 'text-ink/60')}>
              {RISK_TEXT[event.risk] ? `${RISK_TEXT[event.risk]}: ` : 'Te quedan '}
              {formatMoney(event.balanceAfter)}
            </span>
          )}
        </span>
        {event.amount !== null && (
          <span className={cn('font-semibold tabular-nums', (paid || receivable) && 'text-ink/60')}>
            {receivable ? '+' : '−'}
            {formatMoney(event.amount)}
          </span>
        )}
        <ChevronRight className="size-4 shrink-0 text-ink/40" aria-hidden="true" />
      </Link>
    </li>
  );
}

/** Una opción de "Agregar a este día": ícono, nombre y para qué sirve. */
function AddOption({ icon: Icon, title, text, onClick }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-ink/10 p-3 text-left transition-colors hover:bg-ink/5 active:bg-ink/5 focus-visible:outline-2 focus-visible:outline-violet"
      >
        <span aria-hidden="true" className="grid size-10 flex-none place-items-center rounded-xl bg-brand-soft text-brand">
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{title}</span>
          <span className="block text-sm text-ink/60">{text}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-ink/40" aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * Calendario de pagos (FT-0025): compromisos de Mi plata, días de pago, aportes a vacas, tarjetas y
 * cuentas personales del mes, con cuánto le queda al usuario después de cada pago. Desde FT-0069
 * los días llevan semáforo con leyenda, se pueden tocar y se les puede agregar un pago o una cuenta.
 */
export default function Calendar() {
  usePageTitle('Calendario');
  const online = useOnlineStatus();
  // `undefined`: el mes actual, que decide la API con la zona horaria del usuario.
  const [month, setMonth] = useState();
  const [filter, setFilter] = useState('todo');
  const [day, setDay] = useState(null); // día abierto en la ventana
  const [adding, setAdding] = useState(null); // null: lo del día · 'choose': qué agregar · 'debt': la cuenta
  const [commitment, setCommitment] = useState(null);
  const calendar = useAsync(() => getPaymentCalendar(month), [month]);
  // Si falla, el calendario se ve igual, sin la marca del hueco.
  const liquidity = useAsync(() => getLiquidity().catch(() => null), []);
  const data = calendar.data;
  const shown = data?.month;
  const shortfall = liquidity.data?.ready ? liquidity.data.firstShortfall : null;
  const shortfallHere = shortfall && shown && shortfall.date.startsWith(shown) ? shortfall : null;

  const events = data ? filterEvents(data.events, filter) : [];
  const unknownAfter = data?.projectedUntil && events.some((e) => e.kind !== 'ingreso' && e.date >= data.projectedUntil);
  // En la ventana del día va todo, sin el filtro: es "todo lo de ese día".
  const dayEvents = day && data ? data.events.filter((e) => e.date === day) : [];
  const dayName = day ? (day === data?.today ? 'Hoy' : dayLabel(day)) : '';
  const closeDay = () => {
    setDay(null);
    setAdding(null);
  };
  const sheetTitle = adding === 'debt' ? 'Nueva cuenta' : adding === 'choose' ? `Agregar al ${day ? dayLabel(day) : ''}` : dayName;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Calendario"
        description="Tus pagos del mes y cuánto te queda después de cada uno."
        actions={
          shown && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="size-11" aria-label="Mes anterior" onClick={() => setMonth(shiftMonth(shown, -1))}>
                <ChevronLeft />
              </Button>
              <span className="min-w-36 text-center font-medium" aria-live="polite">
                {monthLabel(shown)}
              </span>
              <Button variant="ghost" size="icon" className="size-11" aria-label="Mes siguiente" onClick={() => setMonth(shiftMonth(shown, 1))}>
                <ChevronRight />
              </Button>
            </div>
          )
        }
      />

      {calendar.error && !data && (
        <p role="alert" className="text-sm text-negative">
          {calendar.error}{' '}
          <button type="button" className="underline" onClick={calendar.reload}>
            Reintentar
          </button>
        </p>
      )}
      {!data && !calendar.error && (
        <p className="flex justify-center py-10" role="status" aria-label="Cargando el calendario">
          <Loader2 className="animate-spin text-ink/50" aria-hidden="true" />
        </p>
      )}

      {data && (
        <div className={cn('flex flex-col gap-4', calendar.loading && 'opacity-60')}>
          <div className="grid grid-cols-2 gap-3">
            <Panel className="p-4 md:p-4">
              <p className="text-xs text-ink/60">Por pagar este mes</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{formatMoney(data.totals.pending)}</p>
            </Panel>
            <Panel className="p-4 md:p-4">
              <p className="text-xs text-ink/60">Tienes hoy</p>
              {data.money === null ? (
                <Link to="/app/mi-plata" className="mt-1 block text-sm font-medium text-brand underline-offset-4 hover:underline">
                  Dinos cuánto tienes
                </Link>
              ) : (
                <p className="mt-1 text-xl font-bold tabular-nums">{formatMoney(data.money)}</p>
              )}
            </Panel>
          </div>

          <div role="radiogroup" aria-label="Qué pagos mostrar" className="flex gap-1 rounded-2xl bg-ink/5 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'h-11 flex-1 rounded-xl text-sm font-semibold transition-colors',
                  filter === f.id ? 'bg-violet text-white' : 'text-ink/70 hover:text-ink',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {shortfallHere && (
            <Link
              to="/app/liquidez"
              className="flex items-center gap-2 rounded-2xl bg-negative/10 p-3 text-sm font-medium text-negative"
            >
              <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                El {dayLabel(shortfallHere.date)} te faltan {formatMoney(shortfallHere.missing)}. Ver qué pasa
              </span>
              <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
            </Link>
          )}

          <div>
            <PaymentGrid month={data.month} events={events} today={data.today} shortfallDate={shortfallHere?.date} onSelect={setDay} />
            <p className="mt-2 text-center text-xs text-ink/60">Toca un día para ver lo que tiene o agregarle algo.</p>
          </div>

          {events.length === 0 ? (
            <Panel className="text-center">
              <p className="font-medium">No hay pagos este mes.</p>
              <p className="mt-1 text-sm text-ink/60">
                Toca un día para agregar un pago o una cuenta, o agrega tus pagos de cada mes en{' '}
                <Link to="/app/mi-plata" className="font-medium text-brand underline-offset-4 hover:underline">
                  Mi plata
                </Link>
                .
              </p>
            </Panel>
          ) : (
            <div className="flex flex-col gap-4">
              {groupByDate(events).map((group) => (
                <section key={group.date} aria-label={dayLabel(group.date)}>
                  <h2 className="mb-2 text-sm font-semibold text-ink/70">
                    {group.date === data.today ? 'Hoy' : dayLabel(group.date)}
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {group.events.map((event) => (
                      <EventRow key={`${event.kind}-${event.id ?? 'pago'}-${event.date}`} event={event} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {unknownAfter && (
            <p className="text-center text-xs text-ink/60">
              Después del {dayLabel(data.projectedUntil)} no calculamos cuánto te queda: todavía no sabemos cuánto
              te van a pagar.
            </p>
          )}
        </div>
      )}

      <Sheet open={day !== null} title={sheetTitle} onClose={closeDay}>
        {day && adding === null && (
          <div className="space-y-4">
            {dayEvents.length === 0 ? (
              <p className="text-ink/60">No tienes pagos ni cuentas este día.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {dayEvents.map((event) => (
                  <EventRow key={`${event.kind}-${event.id ?? 'pago'}`} event={event} />
                ))}
              </ul>
            )}
            {day === shortfallHere?.date && (
              <Link to="/app/liquidez" className="block text-sm font-medium text-negative underline underline-offset-2">
                Este día te faltarían {formatMoney(shortfallHere.missing)}. Ver qué pasa
              </Link>
            )}
            <Button size="lg" className="w-full" onClick={() => setAdding('choose')}>
              <Plus aria-hidden="true" />
              Agregar a este día
            </Button>
          </div>
        )}
        {day && adding === 'choose' && (
          <ul className="flex flex-col gap-2">
            <AddOption
              icon={CalendarClock}
              title="Pago de cada mes"
              text={`Arriendo, servicios, cuotas. Se repite el día ${Number(day.slice(8))} de cada mes.`}
              onClick={() => {
                setCommitment({ ...EMPTY_COMMITMENT, dayOfMonth: String(Number(day.slice(8))) });
                closeDay();
              }}
            />
            <AddOption
              icon={HandCoins}
              title="Cuenta"
              text="Plata que debes o que te deben, con el aviso que elijas."
              onClick={() => setAdding('debt')}
            />
          </ul>
        )}
        {day && adding === 'debt' && (
          <DebtForm
            kind="payable"
            dueDate={day}
            disabled={!online}
            onSubmit={async (values) => {
              await createDebt(values);
              closeDay();
              calendar.reload();
            }}
          />
        )}
      </Sheet>
      <CommitmentDialog
        form={commitment}
        onClose={() => setCommitment(null)}
        onSaved={() => {
          setCommitment(null);
          calendar.reload();
        }}
      />
    </div>
  );
}
