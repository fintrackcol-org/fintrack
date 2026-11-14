import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env, isAdminEmail } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { listCategories } from '../repositories/categories.repository.js';
import { findUserById } from '../repositories/users.repository.js';
import * as repo from '../repositories/whatsapp.repository.js';
import { parseSpokenTransaction } from './entry-parser.js';
import { todayIso } from './insights.service.js';
import { liquidityLine } from './liquidity.logic.js';
import { sendEmail } from './mail.service.js';
import { getLiquidity } from './liquidity.service.js';
import { getPlan } from './money-plan.service.js';
import { create as createTransaction, summary as summarizePeriod } from './transactions.service.js';
import { sendText } from './whatsapp-client.service.js';

/** Minutos que dura el código para vincular; la pantalla de Cuenta dice lo mismo. */
export const LINK_CODE_MINUTES = 10;

/** Sin 0, O, 1, I ni L, que se confunden al leerlos. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const CODE_RE = /^FT-[A-Z0-9]{8}$/;

/** Respuestas por día a un número sin conectar: cada una se cobra y cualquiera puede escribir. */
export const STRANGER_DAILY_MAX = 3;
/** Parte del tope mensual en la que se avisa al equipo. */
const WARN_RATIO = 0.8;
/** Cada cuántas respuestas se deja el conteo del mes en los logs. */
const LOG_EVERY = 50;

const ACCESS = { aprobado: 'approved', pendiente: 'pending', rechazado: 'rejected' };
const ACCESS_TO_DB = { approved: 'aprobado', rejected: 'rechazado' };

/** Preguntas que entiende el bot, sobre el texto en minúsculas y sin tildes. */
const BALANCE_QUESTION = /(?<!\p{L})(cuanto tengo|cuanta plata tengo|cuanto me queda|saldo|balance)(?!\p{L})/u;
const EXPENSE_QUESTION = /(?<!\p{L})(cuanto (he gastado|llevo gastado|gaste)|mis gastos|gastos del mes)(?!\p{L})/u;
const PROGRESS_QUESTION =
  /(?<!\p{L})(como voy|como vamos|como va mi dia|mi meta|meta de hoy|cuanto puedo gastar|cuanto me falta|cuanto (tengo|debo|necesito) (que )?hacer|me alcanza|avance)(?!\p{L})/u;
const ANY_QUESTION = /\?|^¿?\s*(cuanto|cuanta|que|como|cual)(?!\p{L})/u;

export const REPLIES = {
  unlinked: 'Hola. Para usar este chat, conecta tu número en Rinde, en Cuenta → WhatsApp.',
  linked: 'Listo, tu número quedó conectado. Escríbeme algo como "almuerzo 15 mil".',
  invalidCode: 'Ese código no es válido o ya venció. Genera uno nuevo en Rinde, en Cuenta.',
  taken: 'Este número ya está conectado a otra cuenta de Rinde.',
  textOnly: 'Por ahora solo leo mensajes de texto. Prueba con "almuerzo 15 mil".',
  noAmount: 'No encontré el monto. Prueba con algo como "almuerzo 15 mil".',
  severalAmounts: 'Vi varios números. Escríbelo con un solo monto, como "almuerzos 24 mil".',
  noDescription: '¿En qué fue? Agrega una palabra, como "almuerzo 15 mil".',
  dailyLimit: 'Llegaste al límite de mensajes de hoy. Mañana sigo registrando.',
  failed: 'No pude guardar ese movimiento. Inténtalo de nuevo en un momento.',
  help: 'Puedo decirte cómo vas hoy, tu saldo y tus gastos del mes. Prueba con "cómo voy", "cuánto tengo" o "cuánto he gastado".',
  noPlan: `Para decirte cómo vas hoy, primero cuéntame cómo te entra la plata en Rinde: ${env.appUrl}/app/mi-plata`,
  queryFailed: 'No pude consultar tus movimientos. Inténtalo de nuevo en un momento.',
  noMovements: (month) => `En ${month} aún no tienes movimientos.`,
  noExpenses: (month) => `En ${month} aún no tienes gastos.`,
};

/**
 * ¿Está configurado todo lo que necesita el bot?
 * @returns {boolean}
 */
export function isAvailable() {
  return Boolean(
    env.whatsappAccessToken &&
    env.whatsappPhoneNumberId &&
    env.whatsappAppSecret &&
    env.whatsappVerifyToken,
  );
}

/**
 * Compara dos textos sin que el tiempo de respuesta revele cuánto coinciden.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * ¿La verificación del webhook trae el token configurado?
 * @param {string|undefined} mode
 * @param {string|undefined} token
 * @returns {boolean}
 */
export function isValidVerification(mode, token) {
  return (
    mode === 'subscribe' &&
    typeof token === 'string' &&
    Boolean(env.whatsappVerifyToken) &&
    safeEqual(token, env.whatsappVerifyToken)
  );
}

/**
 * ¿El cuerpo fue firmado por Meta con la clave secreta de la app?
 * @param {Buffer} rawBody Cuerpo tal como llegó.
 * @param {string|undefined} signature Cabecera `X-Hub-Signature-256`.
 * @param {string|undefined} [secret]
 * @returns {boolean}
 */
export function isValidSignature(rawBody, signature, secret = env.whatsappAppSecret) {
  if (!secret || typeof signature !== 'string') return false;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  return safeEqual(signature, expected);
}

/**
 * @param {string} code
 * @returns {string} Huella del código; es lo único que se guarda.
 */
function hashCode(code) {
  return createHash('sha256').update(code).digest('hex');
}

/**
 * @returns {string} Código como `FT-AB23CD45`.
 */
function generateCode() {
  const chars = [...randomBytes(CODE_LENGTH)].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]);
  return `FT-${chars.join('')}`;
}

/**
 * @param {string} phone
 * @returns {string} Solo los últimos cuatro dígitos.
 */
export function maskPhone(phone) {
  return `•••• ${phone.slice(-4)}`;
}

/**
 * Mensajes entrantes de un aviso de Meta. Los avisos de estado (entregado, leído) no traen ninguno.
 * @param {object} payload
 * @param {string|undefined} [phoneNumberId] Solo se aceptan los dirigidos a este número.
 * @returns {Array<{ id: string, from: string, text: string|null }>} `text` es `null` si no es texto.
 */
export function extractMessages(payload, phoneNumberId = env.whatsappPhoneNumberId) {
  const messages = [];
  for (const entry of payload?.entry ?? []) {
    for (const { value } of entry?.changes ?? []) {
      if (value?.metadata?.phone_number_id !== phoneNumberId) continue;
      for (const message of value?.messages ?? []) {
        if (typeof message?.id !== 'string' || typeof message?.from !== 'string') continue;
        messages.push({
          id: message.id,
          from: message.from.replace(/\D/g, ''),
          text: message.type === 'text' ? String(message.text?.body ?? '').trim() : null,
        });
      }
    }
  }
  return messages;
}

/**
 * @param {number} value
 * @returns {string} Monto en pesos, p. ej. "$15.000" o "-$15.000".
 */
export function money(value) {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toLocaleString('es-CO', { maximumFractionDigits: 2 })}`;
}

/**
 * @param {string} date AAAA-MM-DD.
 * @returns {string} Nombre del mes, p. ej. "noviembre".
 */
function monthName(date) {
  return new Intl.DateTimeFormat('es-CO', { month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

/**
 * @param {number} days
 * @returns {string} `1 día` o `3 días`.
 */
const daysText = (days) => (days === 1 ? '1 día' : `${days} días`);

/**
 * `15 de noviembre` a partir de `2026-11-15`.
 * @param {string} date AAAA-MM-DD
 * @returns {string}
 */
function dayAndMonth(date) {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

/**
 * Avance del día según Mi plata (FT-0038), con las mismas cuentas y palabras que la tarjeta de la
 * app (`frontend/src/lib/moneyPlan.js`): quien cobra en fecha fija ve cuánto puede gastar hoy; quien
 * no, cuánto lleva hoy y cuánto necesita hacer al día para cubrir sus pagos.
 * @param {object} plan Respuesta de `getPlan` (`money-plan.service.js`).
 * @returns {string|null} `null` si el usuario no ha configurado Mi plata.
 */
export function planProgress(plan) {
  if (!plan?.ready) return null;
  if (plan.mode === 'daily') {
    if (plan.shortfall > 0) {
      return `Te faltan ${money(plan.shortfall)} para tus pagos antes del ${dayAndMonth(plan.nextPay)}.`;
    }
    if (plan.dayStatus === 'over') {
      return `Hoy te pasaste ${money(plan.overBy)} de tu límite de ${money(plan.perDay)}.`;
    }
    const left = `${money(plan.leftToday)} más`;
    if (plan.dayStatus === 'near') return `Ya casi llegas: hoy puedes gastar ${left}.`;
    return `Hoy puedes gastar ${left}; faltan ${daysText(plan.days)} para tu pago.`;
  }
  if (plan.mode === 'goal') {
    const usual = plan.usualIncome ? ` (sueles hacer ${money(plan.usualIncome)})` : '';
    return [
      `Hoy llevas ${money(plan.todayIncome)}${usual}.`,
      `Para cubrir todo necesitas hacer ${money(plan.goal)} al día hasta ${plan.until} (${daysText(plan.days)}).`,
    ].join('\n');
  }
  if (plan.shortfall > 0) {
    return `Te faltan ${money(plan.shortfall)}. Revisa tus movimientos o corrige tu saldo en Rinde.`;
  }
  if (plan.runwayDays === null) return `Ya cubres tus pagos. Tienes libres ${money(plan.free)}.`;
  return `Ya cubres tus pagos. Lo que tienes te alcanza para ${daysText(plan.runwayDays)} a tu ritmo.`;
}

/**
 * Crea el servicio del bot. Las dependencias se inyectan para probarlo sin BD, IA ni Meta.
 * @param {object} [deps]
 * @param {typeof repo} [deps.repository]
 * @param {typeof createTransaction} [deps.createTransaction]
 * @param {typeof listCategories} [deps.listCategories]
 * @param {typeof summarizePeriod} [deps.summarize]
 * @param {typeof getPlan} [deps.getPlan]
 * @param {typeof sendText} [deps.sendText]
 * @param {typeof findUserById} [deps.findUser]
 * @param {() => Date} [deps.now]
 * @param {number} [deps.dailyMax]
 * @param {number} [deps.monthlyMax]
 * @param {typeof sendEmail} [deps.sendEmail]
 * @returns {{ status: (userId: string) => Promise<object>, createLinkCode: (userId: string) => Promise<object>, unlink: (userId: string) => Promise<void>, handleMessage: (message: { id: string, from: string, text: string|null }) => Promise<void>, handleWebhook: (payload: object) => Promise<void> }}
 */
export function createWhatsappService(deps = {}) {
  const store = deps.repository ?? repo;
  const save = deps.createTransaction ?? createTransaction;
  const categoriesOf = deps.listCategories ?? listCategories;
  const summarize = deps.summarize ?? summarizePeriod;
  const planOf = deps.getPlan ?? getPlan;
  const liquidityOf = deps.getLiquidity ?? getLiquidity;
  const send = deps.sendText ?? sendText;
  const findUser = deps.findUser ?? findUserById;
  const now = deps.now ?? (() => new Date());
  const dailyMax = deps.dailyMax ?? env.whatsappDailyMax;
  const monthlyMax = deps.monthlyMax ?? env.whatsappMonthlyMax;
  const mail = deps.sendEmail ?? sendEmail;

  /**
   * Le escribe al equipo (`ADMIN_EMAILS`). Un correo que falle no detiene nada.
   * @param {string} subject
   * @param {string} text
   * @returns {Promise<void>}
   */
  async function mailAdmins(subject, text) {
    await Promise.all(
      env.adminEmails.map((to) =>
        mail({ to, subject, text, html: `<p>${text.replaceAll('\n', '<br>')}</p>` }).catch(
          (err) => {
            console.error(`No se pudo avisar al equipo por correo (${err.message})`);
          },
        ),
      ),
    );
  }

  /**
   * Envía una respuesta y la cuenta. Meta cobra cada una: al llegar al tope del mes no envía nada.
   * @param {string} to
   * @param {string} text
   * @param {string|null} [userId] `null` si el número no está conectado.
   * @returns {Promise<boolean>} `false` si el tope del mes ya se alcanzó.
   */
  async function deliver(to, text, userId = null) {
    if ((await store.countMonthSends()) >= monthlyMax) {
      console.warn(`WhatsApp: tope del mes alcanzado (${monthlyMax}); no se respondió`);
      return false;
    }
    await send(to, text);
    const total = await store.recordSend({ userId, phoneHash: hashCode(to) });
    const warnAt = Math.floor(monthlyMax * WARN_RATIO);
    if (total % LOG_EVERY === 0 || total === warnAt || total === monthlyMax) {
      console.info(`WhatsApp: ${total} de ${monthlyMax} respuestas este mes`);
    }
    if (total === monthlyMax) {
      await mailAdmins(
        'Rinde: el bot de WhatsApp llegó al tope del mes',
        `El bot ya envió ${total} respuestas este mes y dejó de responder hasta el otro mes.\nPara subir el tope, cambia WHATSAPP_MONTHLY_MAX en Render.`,
      );
    } else if (total === warnAt) {
      await mailAdmins(
        'Rinde: el bot de WhatsApp va en el 80 % del mes',
        `El bot lleva ${total} de ${monthlyMax} respuestas este mes. Al llegar a ${monthlyMax} deja de responder.`,
      );
    }
    return true;
  }

  /**
   * Acceso del usuario al bot. Los correos de `WHATSAPP_ALLOWED_EMAILS` y el equipo entran
   * directo; los demás lo piden y el equipo lo aprueba.
   * @param {string} userId
   * @returns {Promise<{ access: 'approved'|'pending'|'rejected'|'none', admin: boolean }>}
   */
  async function accessOf(userId) {
    const user = await findUser(userId);
    if (!user) return { access: 'none', admin: false };
    const admin = isAdminEmail(user.email);
    if (admin || env.whatsappAllowedEmails.includes(user.email.toLowerCase()))
      return { access: 'approved', admin };
    return { access: ACCESS[await store.findAccess(userId)] ?? 'none', admin };
  }

  /**
   * ¿Este usuario puede usar el bot?
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async function canUse(userId) {
    return isAvailable() && (await accessOf(userId)).access === 'approved';
  }

  /**
   * Estado de la conexión para la pantalla de Cuenta. `available` es si el usuario ve el bot:
   * ya tiene acceso, lo pidió, o `*` deja que cualquiera lo pida.
   * @param {string} userId
   * @returns {Promise<{ available: boolean, access: 'approved'|'pending'|'rejected'|'none', admin: boolean, linked: boolean, phone: string|null, botNumber: string|null }>}
   */
  async function status(userId) {
    const [phone, { access, admin }] = await Promise.all([
      store.findPhone(userId),
      accessOf(userId),
    ]);
    return {
      available: isAvailable() && (access !== 'none' || env.whatsappAllowedEmails.includes('*')),
      access,
      admin,
      linked: phone !== null,
      phone: phone && maskPhone(phone),
      botNumber: env.whatsappBotNumber ?? null,
    };
  }

  /**
   * Pide acceso al bot y le avisa al equipo por correo. Pedirlo dos veces no cambia nada.
   * @param {string} userId
   * @returns {Promise<object>} Estado de la conexión, como `status`.
   * @throws {AppError} 403 si el bot no está abierto a solicitudes.
   */
  async function requestAccess(userId) {
    const current = await status(userId);
    if (!current.available) {
      throw new AppError(403, 'FORBIDDEN', 'WhatsApp aún no está disponible para tu cuenta');
    }
    if (current.access !== 'none' || !(await store.requestAccess(userId))) return current;
    const user = await findUser(userId);
    await mailAdmins(
      'Rinde: alguien pidió acceso al bot de WhatsApp',
      `${user.email} pidió usar el bot de WhatsApp.\nApruébalo o recházalo en ${env.appUrl}/app/whatsapp/admin`,
    );
    return { ...current, access: 'pending' };
  }

  /**
   * Panel del equipo: respuestas del mes y quién pidió acceso.
   * @returns {Promise<{ month: { sent: number, max: number }, users: object[] }>}
   */
  async function adminOverview() {
    const [sent, users] = await Promise.all([store.countMonthSends(), store.listAccess()]);
    return {
      month: { sent, max: monthlyMax },
      users: users.map((u) => ({ ...u, status: ACCESS[u.status] })),
    };
  }

  /**
   * Aprueba o rechaza el acceso de un usuario y, si lo aprueba, le avisa por correo.
   * @param {string} userId
   * @param {'approved'|'rejected'} access
   * @returns {Promise<void>}
   * @throws {AppError} 404 si el usuario no existe.
   */
  async function setAccess(userId, access) {
    const email = await store.setAccess(userId, ACCESS_TO_DB[access]);
    if (!email) throw new AppError(404, 'NOT_FOUND', 'Usuario no encontrado');
    if (access !== 'approved') return;
    const text = `Ya puedes anotar tus movimientos por WhatsApp.\nConecta tu número en ${env.appUrl}/app/cuenta`;
    await mail({
      to: email,
      subject: 'Ya tienes WhatsApp en Rinde',
      text,
      html: `<p>${text.replaceAll('\n', '<br>')}</p>`,
    }).catch((err) => {
      console.error(`No se pudo avisar la aprobación por correo (${err.message})`);
    });
  }

  /**
   * Genera el código de un solo uso que el usuario le envía al bot.
   * @param {string} userId
   * @returns {Promise<{ code: string, expiresAt: Date, botNumber: string|null }>}
   * @throws {AppError} 403 si el usuario no tiene acceso.
   */
  async function createLinkCode(userId) {
    if (!(await canUse(userId))) {
      throw new AppError(403, 'FORBIDDEN', 'WhatsApp aún no está disponible para tu cuenta');
    }
    const code = generateCode();
    const expiresAt = new Date(now().getTime() + LINK_CODE_MINUTES * 60 * 1000);
    await store.saveLinkCode({ userId, codeHash: hashCode(code), expiresAt });
    return { code, expiresAt, botNumber: env.whatsappBotNumber ?? null };
  }

  /**
   * Desconecta el número del usuario.
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async function unlink(userId) {
    await store.removeLink(userId);
  }

  /**
   * @param {string} userId
   * @param {string|null} key
   * @returns {Promise<string>} Nombre de la categoría.
   */
  async function categoryName(userId, key) {
    const categories = await categoriesOf(userId);
    return categories.find((c) => c.key === key)?.name ?? 'Sin clasificar';
  }

  /**
   * Responde el balance del mes con las mismas cuentas del dashboard: el ahorro va en su línea
   * y se resta del balance, pero no cuenta como gasto.
   * @param {string} userId
   * @param {string} today AAAA-MM-DD.
   * @returns {Promise<string>}
   */
  async function balanceReply(userId, today) {
    const month = monthName(today);
    const { income, expense, savings } = await summarize(userId, { period: 'month', date: today });
    if (income.total === 0 && expense.total === 0 && savings.total === 0) return REPLIES.noMovements(month);
    const balance = Math.round((income.total - expense.total - savings.total) * 100) / 100;
    const saved = savings.total > 0 ? `\nAhorro: ${money(savings.total)}` : '';
    return `En ${month} llevas:\nIngresos: ${money(income.total)}\nGastos: ${money(expense.total)}${saved}\nBalance: ${money(balance)}`;
  }

  /**
   * Responde cuánto se ha gastado en el mes y la categoría que más pesa.
   * @param {string} userId
   * @param {string} today AAAA-MM-DD.
   * @returns {Promise<string>}
   */
  async function expensesReply(userId, today) {
    const month = monthName(today);
    const { expense } = await summarize(userId, { period: 'month', date: today });
    if (expense.total === 0) return REPLIES.noExpenses(month);
    const [top] = expense.byCategory;
    const name = await categoryName(userId, top.category);
    return `En ${month} has gastado ${money(expense.total)}.\nLo que más pesa: ${name}, ${money(top.total)}.`;
  }

  /**
   * Avance del día, o la invitación a configurar Mi plata.
   * @param {string} userId
   * @returns {Promise<string>}
   */
  async function progressReply(userId) {
    const progress = planProgress(await planOf(userId));
    if (!progress) return REPLIES.noPlan;
    // El motor de liquidez (FT-0059) agrega una línea; si falla, se responde sin ella.
    const line = await liquidityOf(userId)
      .then(liquidityLine)
      .catch((err) => {
        console.error(`No se pudo calcular la liquidez por WhatsApp (${err.message})`);
        return null;
      });
    return line ? `${progress}\n${line}` : progress;
  }

  /**
   * Envía un aviso por WhatsApp a quien tiene el bot vinculado y habilitado. Meta puede rechazar
   * mensajes fuera de la ventana de 24 horas: el error se deja al llamador.
   * @param {string} userId
   * @param {string} text
   * @returns {Promise<boolean>} `false` si el usuario no tiene el bot o ya se llegó al tope del mes.
   */
  async function notify(userId, text) {
    if (!(await canUse(userId))) return false;
    const phone = await store.findPhone(userId);
    if (!phone) return false;
    return deliver(phone, text, userId);
  }

  /**
   * Responde un mensaje sin monto: una consulta del mes o, si no lo es, qué hace falta aclarar.
   * @param {string} userId
   * @param {string} text
   * @param {string} today AAAA-MM-DD.
   * @returns {Promise<string>} Respuesta para el usuario.
   */
  async function answer(userId, text, today) {
    const asked = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();
    let query = null;
    if (PROGRESS_QUESTION.test(asked)) query = progressReply;
    else if (BALANCE_QUESTION.test(asked)) query = balanceReply;
    else if (EXPENSE_QUESTION.test(asked)) query = expensesReply;
    if (!query) return ANY_QUESTION.test(asked) ? REPLIES.help : REPLIES.noAmount;
    return query(userId, today).catch((err) => {
      console.error(`No se pudo consultar el mes por WhatsApp (${err.message})`);
      return REPLIES.queryFailed;
    });
  }

  /**
   * Registra un movimiento a partir del texto, o devuelve qué hace falta aclarar. El analizador
   * trabaja con la fecha local del servidor: se le pasa el mediodía de hoy en Bogotá.
   * @param {string} userId
   * @param {{ id: string, text: string }} message
   * @returns {Promise<string>} Respuesta para el usuario.
   */
  async function register(userId, { id, text }) {
    const today = todayIso(now());
    const parsed = parseSpokenTransaction(text, new Date(`${today}T12:00:00`));
    if (parsed.amount === null) return answer(userId, text, today);
    if (parsed.ambiguous) return REPLIES.severalAmounts;
    if (!parsed.description) return REPLIES.noDescription;

    const saved = await save(userId, {
      amount: parsed.amount,
      description: parsed.description,
      type: parsed.type,
      date: parsed.date,
      category: null,
      // Como máximo 64 caracteres, igual que `transacciones.local_id`.
      localId: `wa-${hashCode(id).slice(0, 61)}`,
    });
    const name = await categoryName(userId, saved.category);
    const when = saved.date === today ? '' : ` del ${saved.date}`;
    const what = saved.type === 'ingreso' ? 'ingreso' : 'gasto';
    const done = `Guardé un ${what} de ${money(saved.amount)}${when} en ${name}.`;
    // Lo guardado ya quedó: si el avance falla, se responde sin él.
    const progress = await planOf(userId)
      .then(planProgress)
      .catch((err) => {
        console.error(`No se pudo calcular Mi plata por WhatsApp (${err.message})`);
        return null;
      });
    return progress ? `${done}\n${progress}` : done;
  }

  /**
   * Procesa un mensaje y responde. Quien no está vinculado solo puede enviar su código.
   * @param {{ id: string, from: string, text: string|null }} message
   * @returns {Promise<void>}
   */
  async function handleMessage(message) {
    const { from, text } = message;
    const candidate = text?.toUpperCase() ?? '';
    const isCode = CODE_RE.test(candidate);
    const userId = isCode ? null : await store.findUserIdByPhone(from);
    if (!userId) {
      // Cualquiera puede escribirle al número: a quien no está conectado se le responde poco.
      if ((await store.countStrangerSends(hashCode(from))) >= STRANGER_DAILY_MAX) return;
      if (!isCode) {
        await deliver(from, REPLIES.unlinked);
        return;
      }
      const result = await store.confirmLink({ codeHash: hashCode(candidate), phone: from });
      const replies = {
        linked: REPLIES.linked,
        invalid: REPLIES.invalidCode,
        taken: REPLIES.taken,
      };
      await deliver(from, replies[result]);
      return;
    }
    // A quien se le quitó el acceso no se le responde: cada respuesta se cobra.
    if ((await accessOf(userId)).access !== 'approved') return;
    const used = await store.countRecentMessages(userId);
    if (used >= dailyMax) {
      // Cada respuesta se cobra: el aviso va solo al primer mensaje de más (que queda contado) y
      // los siguientes se ignoran hasta que la ventana de 24 h libere cupo.
      if (used === dailyMax && (await store.claimMessage({ messageId: message.id, userId }))) {
        await deliver(from, REPLIES.dailyLimit, userId);
      }
      return;
    }
    if (!(await store.claimMessage({ messageId: message.id, userId }))) return;
    if (text === null) {
      await deliver(from, REPLIES.textOnly, userId);
      return;
    }
    const reply = await register(userId, { id: message.id, text }).catch((err) => {
      console.error(`No se pudo registrar un mensaje de WhatsApp (${err.message})`);
      return REPLIES.failed;
    });
    await deliver(from, reply, userId);
  }

  /**
   * Procesa un aviso de Meta. Un mensaje que falle no detiene los demás.
   * @param {object} payload
   * @returns {Promise<void>}
   */
  async function handleWebhook(payload) {
    for (const message of extractMessages(payload)) {
      await handleMessage(message).catch((err) => {
        console.error(`No se pudo procesar un mensaje de WhatsApp (${err.message})`);
      });
    }
  }

  return {
    status,
    requestAccess,
    adminOverview,
    setAccess,
    createLinkCode,
    unlink,
    handleMessage,
    handleWebhook,
    notify,
  };
}

export const {
  status,
  requestAccess,
  adminOverview,
  setAccess,
  createLinkCode,
  unlink,
  handleWebhook,
  notify,
} = createWhatsappService();
