import {
  listCardReminderUsers,
  listLiquidityReminderUsers,
  listReminderCandidates,
  saveLiquidityAlert,
} from '../repositories/reminders.repository.js';
import { updateCard } from '../repositories/cards.repository.js';
import { listDebtsDueTomorrow } from '../repositories/debts.repository.js';
import { markReminderSent } from '../repositories/reminder-configs.repository.js';
import * as businessReminders from '../repositories/negocio-reminders.repository.js';
import { accountAlertPayload, taxDatePayload } from './negocio-accounts.logic.js';
import { pushService } from './push.service.js';
import * as cardsService from './cards.service.js';
import { liquidityAlertDue, liquidityAlertPayload } from './liquidity.logic.js';
import { getLiquidity } from './liquidity.service.js';
import { money, notify as notifyWhatsapp } from './whatsapp.service.js';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Mensaje del recordatorio diario (REQ-030). */
export const REMINDER_PAYLOAD = {
  title: 'Rinde',
  body: '¿Ya registraste tus gastos de hoy?',
  url: '/app/transacciones',
};

/** Los avisos de los negocios salen desde esta hora de Colombia (FT-0058). */
const BUSINESS_TIMEZONE = 'America/Bogota';
const BUSINESS_HOUR = 8;

/** Días antes del pago en que se avisa. */
const CARD_REMINDER_DAYS = 3;

/**
 * Mensaje del aviso de pago de una tarjeta.
 * @param {{ id: string, name: string, used: number, statementTotal: number|null, nextPaymentDate: string }} card
 * @returns {{ title: string, body: string, url: string }}
 */
export function cardReminderPayload(card) {
  const month = new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' })
    .format(new Date(`${card.nextPaymentDate}T00:00:00Z`))
    .replace('.', '');
  const date = `${Number(card.nextPaymentDate.slice(8))} ${month}`;
  return {
    title: 'Pago de tarjeta',
    body: `Tu ${card.name} se paga el ${date}. Debes ${money(card.statementTotal ?? card.used)}.`,
    url: `/app/tarjetas/${card.id}`,
  };
}

/**
 * Cuándo vence algo, dicho desde el día del aviso: "Hoy", "Mañana" o "En 3 días".
 * @param {number} daysBefore
 * @returns {string}
 */
export function whenText(daysBefore) {
  if (daysBefore === 0) return 'Hoy';
  return daysBefore === 1 ? 'Mañana' : `En ${daysBefore} días`;
}

/**
 * Aviso de una cuenta personal por vencer (FT-0046), con la anticipación que eligió el usuario (FT-0063).
 * @param {{ kind: 'receivable'|'payable', person: string, amount: number, daysBefore?: number }} debt
 * @returns {{ title: string, body: string, url: string }}
 */
export function debtReminderPayload({ kind, person, amount, daysBefore = 1 }) {
  const when = whenText(daysBefore);
  return {
    title: kind === 'receivable' ? 'Te deben' : 'Tienes que pagar',
    body:
      kind === 'receivable'
        ? `${when} ${person} te debe pagar ${money(amount)}.`
        : `${when} vence lo que le debes a ${person}: ${money(amount)}.`,
    url: '/app/cuentas',
  };
}

/**
 * Obtiene la fecha (YYYY-MM-DD) y los minutos transcurridos del día en una zona horaria.
 * @param {Date} date
 * @param {string} timezone Zona horaria IANA.
 * @returns {{ localDate: string, minutes: number }}
 */
function localClock(date, timezone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return {
    localDate: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/**
 * Indica si el recordatorio de un usuario debe enviarse ahora.
 * Se envía durante `windowMinutes` minutos desde la hora configurada (en la hora local del usuario),
 * para no perder el aviso si el servidor tardó en despertar o saltó un ciclo.
 *
 * @param {{ time: string, timezone: string, now: Date, windowMinutes?: number }} input
 * @returns {{ due: boolean, key: string }} `key` identifica el recordatorio del día (evita duplicados).
 */
export function checkReminderDue({ time, timezone, now, windowMinutes = 5 }) {
  const [hours, minutes] = time.split(':').map(Number);
  const target = hours * 60 + minutes;
  const local = localClock(now, timezone);
  const elapsed = (local.minutes - target + 1440) % 1440;
  // Si ya pasó la medianoche local, el recordatorio pertenece al día anterior.
  const wrapped = local.minutes < target;
  const day = wrapped
    ? localClock(new Date(now.getTime() - DAY_MS), timezone).localDate
    : local.localDate;
  return { due: elapsed < windowMinutes, key: `${day}|${time}` };
}

/**
 * Algo con fecha que avisa por el motor de recordatorios (FT-0063).
 * @typedef {object} ReminderSource
 * @property {string} type Nombre en `avisos.origen_tipo` ('cuenta', 'tarjeta'…).
 * @property {() => Promise<Array<{ id: string, userId: string, timezone: string, time: string, dueDate: string, daysBefore: number, channel?: 'push'|'whatsapp'|'both' }>>} list
 *   Lo que toca avisar hoy y aún no salió; la hora la revisa el motor.
 * @property {(item: object) => { title: string, body: string, url: string }} payload Texto del aviso.
 */

/**
 * Crea el programador del recordatorio diario. Cada `intervalMs` revisa qué usuarios tienen
 * un recordatorio a la hora actual (pueden tener varios al día) y les envía la notificación,
 * una sola vez por cada hora y día.
 * Los usuarios sin dispositivo suscrito se omiten y se deja constancia en el log (REQ-029).
 *
 * @param {object} [deps]
 * @param {typeof listReminderCandidates} [deps.listCandidates]
 * @param {(userId: string, payload: object, options?: { inbox?: boolean }) => Promise<unknown>} [deps.sendToUser]
 * @param {() => Date} [deps.now]
 * @param {{ info: (message: string) => void, error: (message: string) => void }} [deps.log]
 * @param {typeof listCardReminderUsers} [deps.listCardUsers]
 * @param {typeof cardsService.list} [deps.listUserCards]
 * @param {(cardId: string, userId: string, date: string) => Promise<unknown>} [deps.markCardReminded]
 * @param {typeof listDebtsDueTomorrow} [deps.listDueDebts]
 * @param {ReminderSource[]} [deps.reminderSources] Qué cosas con fecha avisan por el motor (FT-0063).
 * @param {typeof markReminderSent} [deps.markReminderSent]
 * @param {typeof listLiquidityReminderUsers} [deps.listLiquidityUsers]
 * @param {typeof getLiquidity} [deps.getLiquidity]
 * @param {typeof saveLiquidityAlert} [deps.saveLiquidityAlert]
 * @param {(userId: string, text: string) => Promise<boolean>} [deps.notifyWhatsapp]
 * @param {Pick<typeof businessReminders, 'listAccountAlerts'|'listTaxDateAlerts'|'listRecorders'|'markAccountAlert'|'markTaxDateAlert'>} [deps.businessReminders]
 *   Avisos de los negocios (FT-0058).
 * @param {number} [deps.intervalMs] Cada cuánto revisa (por defecto 1 minuto).
 * @param {number} [deps.windowMinutes] Minutos de tolerancia tras la hora configurada.
 * @returns {{ tick: () => Promise<{ sent: number, skipped: number }>, start: () => void, stop: () => void }}
 */
export function createReminderScheduler(deps = {}) {
  const listCandidates = deps.listCandidates ?? listReminderCandidates;
  const sendToUser = deps.sendToUser ?? pushService.sendToUser;
  const listCardUsers = deps.listCardUsers ?? listCardReminderUsers;
  const listUserCards = deps.listUserCards ?? cardsService.list;
  const markCardReminded =
    deps.markCardReminded ??
    ((id, userId, date) => updateCard(id, userId, { reminderSentFor: date }));
  // Para sumar tarjetas, suscripciones o el calendario al motor basta agregar su fuente aquí.
  const sources = deps.reminderSources ?? [
    { type: 'cuenta', list: deps.listDueDebts ?? listDebtsDueTomorrow, payload: debtReminderPayload },
  ];
  const markSent = deps.markReminderSent ?? markReminderSent;
  const listLiquidityUsers = deps.listLiquidityUsers ?? listLiquidityReminderUsers;
  const liquidityOf = deps.getLiquidity ?? getLiquidity;
  const saveAlert = deps.saveLiquidityAlert ?? saveLiquidityAlert;
  const whatsapp = deps.notifyWhatsapp ?? notifyWhatsapp;
  const business = deps.businessReminders ?? businessReminders;
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? console;
  const intervalMs = deps.intervalMs ?? MINUTE_MS;
  const windowMinutes = deps.windowMinutes ?? 5;

  /** @type {Map<string, number>} Recordatorios ya atendidos: "usuario|fecha|hora" → momento. */
  const handled = new Map();
  /** @type {ReturnType<typeof setInterval>|undefined} */
  let timer;
  let running = false;

  /**
   * Avisa del pago de las tarjetas que vencen en 3 días, una vez por fecha de pago.
   * @param {Date} moment
   * @returns {Promise<number>} Avisos enviados.
   */
  async function cardTick(moment) {
    let sent = 0;
    for (const user of await listCardUsers()) {
      try {
        const { due } = checkReminderDue({
          time: user.time,
          timezone: user.timezone,
          now: moment,
          windowMinutes,
        });
        if (!due) continue;
        for (const card of await listUserCards(user.id)) {
          if (
            card.daysToPayment !== CARD_REMINDER_DAYS ||
            card.paidThisCycle ||
            !(card.statementTotal ?? card.used) ||
            card.reminderSentFor === card.nextPaymentDate
          ) {
            continue;
          }
          await sendToUser(user.id, cardReminderPayload(card));
          await markCardReminded(card.id, user.id, card.nextPaymentDate);
          sent += 1;
        }
      } catch (err) {
        log.error(`Error avisando el pago de tarjetas al usuario ${user.id}: ${err.message}`);
      }
    }
    return sent;
  }

  /**
   * Entrega un aviso por donde lo pidió el usuario. Si eligió solo WhatsApp y no se pudo (no tiene
   * el bot conectado, o falló), llega por notificación: un recordatorio de pago no se pierde.
   * @param {string} userId
   * @param {'push'|'whatsapp'|'both'} channel
   * @param {{ title: string, body: string, url: string }} payload
   * @returns {Promise<void>}
   */
  async function deliver(userId, channel, payload) {
    let byWhatsapp = false;
    if (channel !== 'push') {
      byWhatsapp = await whatsapp(userId, `${payload.title}: ${payload.body}`).catch((err) => {
        log.error(`No se pudo avisar por WhatsApp al usuario ${userId}: ${err.message}`);
        return false;
      });
    }
    if (channel !== 'whatsapp' || !byWhatsapp) await sendToUser(userId, payload);
  }

  /**
   * Motor de recordatorios (FT-0063): recorre cada fuente (hoy, las cuentas personales) y envía los
   * avisos que tocan a la hora elegida, una sola vez por vencimiento y anticipación.
   * @param {Date} moment
   * @returns {Promise<number>} Avisos enviados.
   */
  async function sourcesTick(moment) {
    let sent = 0;
    for (const source of sources) {
      for (const item of await source.list()) {
        try {
          const { due } = checkReminderDue({
            time: item.time,
            timezone: item.timezone,
            now: moment,
            windowMinutes,
          });
          if (!due || !(await markSent({ type: source.type, ...item }))) continue;
          await deliver(item.userId, item.channel ?? 'push', source.payload(item));
          sent += 1;
        } catch (err) {
          log.error(`Error avisando ${source.type} ${item.id} al usuario ${item.userId}: ${err.message}`);
        }
      }
    }
    return sent;
  }

  /**
   * Motor de liquidez (FT-0059): a la hora del primer recordatorio del usuario, si le va a faltar
   * plata en 7, 3 o 1 días, le avisa por la bandeja, push y WhatsApp (si tiene el bot). No repite
   * el aviso salvo que lo que falta cambie más del 10 %.
   * @param {Date} moment
   * @returns {Promise<number>} Avisos enviados.
   */
  async function liquidityTick(moment) {
    let sent = 0;
    for (const user of await listLiquidityUsers()) {
      try {
        const { due, key } = checkReminderDue({
          time: user.time,
          timezone: user.timezone,
          now: moment,
          windowMinutes,
        });
        const id = `liquidez|${user.id}|${key}`;
        if (!due || handled.has(id)) continue;
        handled.set(id, moment.getTime());

        const liquidity = await liquidityOf(user.id);
        if (!liquidity.ready) continue;
        const shortfall = liquidity.firstShortfall;
        const daysBefore = liquidityAlertDue({ today: liquidity.today, shortfall, last: user.last });
        if (daysBefore === null) continue;

        const payload = liquidityAlertPayload(liquidity);
        await saveAlert(user.id, { date: shortfall.date, daysBefore, missing: shortfall.missing });
        await sendToUser(user.id, payload);
        await whatsapp(user.id, `${payload.body}\nMira el detalle en Rinde.`).catch((err) => {
          log.error(`No se pudo avisar la liquidez por WhatsApp al usuario ${user.id}: ${err.message}`);
        });
        sent += 1;
      } catch (err) {
        log.error(`Error revisando la liquidez del usuario ${user.id}: ${err.message}`);
      }
    }
    return sent;
  }

  /**
   * Avisos de los negocios (FT-0058) a sus dueños y editores, desde las 8 a. m. de Colombia:
   * cuentas que vencen mañana o que ya vencieron, y fechas de impuestos de los próximos 3 días.
   * Cada aviso queda marcado en su fila, así no se repite aunque el servidor se reinicie.
   * @param {Date} moment
   * @returns {Promise<number>} Avisos enviados.
   */
  async function businessTick(moment) {
    const clock = localClock(moment, BUSINESS_TIMEZONE);
    if (clock.minutes < BUSINESS_HOUR * 60) return 0;
    const today = clock.localDate;
    let sent = 0;
    const notify = async (businessId, payload) => {
      for (const userId of await business.listRecorders(businessId)) {
        await sendToUser(userId, payload);
        sent += 1;
      }
    };
    for (const alert of await business.listAccountAlerts(today)) {
      try {
        // Primero se marca: si el envío falla a medias, no se repite a quienes ya les llegó.
        await business.markAccountAlert(alert.id, alert.stage);
        await notify(alert.businessId, accountAlertPayload(alert));
      } catch (err) {
        log.error(`Error avisando la cuenta ${alert.id} del negocio ${alert.businessId}: ${err.message}`);
      }
    }
    for (const alert of await business.listTaxDateAlerts(today)) {
      try {
        await business.markTaxDateAlert(alert.id);
        await notify(alert.businessId, taxDatePayload(alert, today));
      } catch (err) {
        log.error(`Error avisando la fecha ${alert.id} del negocio ${alert.businessId}: ${err.message}`);
      }
    }
    return sent;
  }

  /**
   * Revisa los recordatorios pendientes ahora mismo.
   * @returns {Promise<{ sent: number, skipped: number }>}
   */
  async function tick() {
    const moment = now();
    let sent = 0;
    let skipped = 0;

    for (const [key, at] of handled) {
      if (moment.getTime() - at > 2 * DAY_MS) handled.delete(key);
    }

    for (const user of await listCandidates()) {
      // Cada hora del usuario es un recordatorio independiente: una falla no frena a las demás.
      for (const time of user.times) {
        try {
          const { due, key } = checkReminderDue({
            time,
            timezone: user.timezone,
            now: moment,
            windowMinutes,
          });
          const id = `${user.id}|${key}`;
          if (!due || handled.has(id)) continue;
          handled.set(id, moment.getTime());

          if (!user.hasSubscription) {
            skipped += 1;
            log.info(
              `Recordatorio omitido: el usuario ${user.id} no tiene notificaciones activadas`,
            );
            continue;
          }
          // No va a la bandeja: un "¿ya registraste?" diario la llenaría sin decir nada nuevo.
          await sendToUser(user.id, REMINDER_PAYLOAD, { inbox: false });
          sent += 1;
        } catch (err) {
          log.error(`Error enviando el recordatorio al usuario ${user.id}: ${err.message}`);
        }
      }
    }
    sent += await cardTick(moment);
    sent += await sourcesTick(moment);
    sent += await liquidityTick(moment);
    sent += await businessTick(moment);
    return { sent, skipped };
  }

  return {
    tick,
    start() {
      if (timer) return;
      timer = setInterval(async () => {
        if (running) return;
        running = true;
        try {
          await tick();
        } catch (err) {
          log.error(`Error revisando los recordatorios: ${err.message}`);
        } finally {
          running = false;
        }
      }, intervalMs);
      // No impide que el proceso termine (apagado limpio y pruebas).
      timer.unref();
    },
    stop() {
      clearInterval(timer);
      timer = undefined;
    },
  };
}
