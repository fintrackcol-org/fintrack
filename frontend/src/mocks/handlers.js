import { http, HttpResponse, delay } from 'msw';
import { API_V1 } from '@/lib/api';
import { plainText } from '@/lib/plainText';
import { progress } from '@/lib/debtSchedule';

/**
 * Handlers de MSW que simulan auth, categorías y transacciones mientras se desarrolla sin backend.
 * Siguen `docs/api/openapi.yaml` (v2.0.1): rutas bajo `/api/v1`, errores con la forma
 * `{ error: { code, message, details? } }` y `AuthResponse` con tokens.
 * Los usuarios y sesiones viven en memoria: se reinician al recargar la página.
 */

/** @type {Map<string, { id: string, email: string, password: string, timezone: string, verified: boolean }>} */
const users = new Map();
/** @type {Map<string, object[]>} Correcciones de saldo por usuario (FT-0062). */
const adjustments = new Map();
/** token del enlace para confirmar el correo → email (FT-0016) */
const verificationTokens = new Map();
/** access token → email */
const accessTokens = new Map();
/** refresh token → email */
const refreshTokens = new Map();
let whatsappLinked = false;
/** Acceso al bot del usuario de los mocks; `?whatsapp=pedir` en la URL lo deja sin pedir. */
let whatsappAccess = new URLSearchParams(globalThis.location?.search).get('whatsapp') === 'pedir' ? 'none' : 'approved';
/** Solicitudes de ejemplo del panel del equipo. */
const whatsappRequests = [
  { userId: 'wa-1', email: 'laura.gomez@ejemplo.co', name: 'Laura', status: 'pending', requestedAt: new Date().toISOString(), linked: false, monthSends: 0 },
  { userId: 'wa-2', email: 'andres@ejemplo.co', name: 'Andrés', status: 'approved', requestedAt: new Date(Date.now() - 3 * 86400000).toISOString(), linked: true, hasPhone: true, monthSends: 41 },
  { userId: 'wa-3', email: 'nicolas@ejemplo.co', name: null, status: 'approved', requestedAt: new Date(Date.now() - 5 * 86400000).toISOString(), linked: true, hasPhone: false, monthSends: 0 },
  { userId: 'wa-4', email: 'desconocido@ejemplo.co', name: null, status: 'rejected', requestedAt: new Date(Date.now() - 9 * 86400000).toISOString(), linked: false, monthSends: 0 },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Llave pública VAPID de ejemplo (válida, solo para desarrollo): permite suscribirse sin backend. */
const MOCK_VAPID_PUBLIC_KEY =
  'BKQMg0AmJJ34cFCv2R9ZhYsC5nfn4yDHX59UkDTz9Oxt7hVPlf6syvjSKfGKnk3TbL73wdayjvf5NNN5fsevPJU';
/** endpoint de suscripción push → id del usuario */
const pushEndpoints = new Map();
/** id del usuario → configuración del recordatorio diario */
const reminders = new Map();
/** Bandeja de avisos por usuario (FT-0045); arranca con un ejemplo para ver la campana. */
const inboxes = new Map();
/** Cuentas por cobrar y por pagar (FT-0046) por usuario. */
const debtsByUser = new Map();
/** Pagos de Apple Pay por confirmar (FT-0047) y token del Atajo, por usuario. */
const pendingByUser = new Map();
const shortcutTokens = new Map();

/** Pagos de ejemplo para ver "Por confirmar" en local; el segundo parece repetido. */
function pendingFor(userId) {
  if (!pendingByUser.has(userId)) {
    const today = new Date().toLocaleDateString('en-CA');
    const now = new Date().toISOString();
    pendingByUser.set(userId, [
      {
        id: crypto.randomUUID(),
        merchant: 'Éxito Calle 80',
        amount: 45900,
        date: today,
        card: 'Visa Bancolombia',
        status: 'pending',
        transactionId: null,
        possibleDuplicate: false,
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        merchant: 'Juan Valdez',
        amount: 12500,
        date: today,
        card: 'Visa Bancolombia',
        status: 'pending',
        transactionId: null,
        possibleDuplicate: true,
        createdAt: now,
      },
    ]);
  }
  return pendingByUser.get(userId);
}

const demoUser = addUser('demo@fintrack.com', 'demo1234');

/**
 * Datos de ejemplo de la cuenta demo, para ver las pantallas con contenido sin backend: movimientos
 * del mes en curso y un saldo conocido. Las cuentas que se registran en el mock empiezan vacías.
 * Se llama apenas existen los mapas de movimientos y perfiles (más abajo).
 */
function seedDemo(user) {
  const now = new Date();
  const day = (d) => {
    const date = new Date(now.getFullYear(), now.getMonth(), Math.min(d, now.getDate()));
    return date.toLocaleDateString('en-CA');
  };
  const rows = [
    [700000, 'Pago diseño de logo', 'ingreso', 'freelance', 3],
    [450000, 'Arriendo', 'gasto', 'vivienda', 1],
    [68500, 'Mercado D1', 'gasto', 'alimentacion', 9],
    [14000, 'Almuerzo', 'gasto', 'alimentacion', now.getDate()],
    [3200, 'MIO', 'gasto', 'transporte', now.getDate() - 1],
    [26900, 'Netflix', 'gasto', 'entretenimiento', 8],
    [32000, 'Droguería', 'gasto', 'salud', 6],
    [58100, 'Internet y luz', 'gasto', 'servicios_publicos', 5],
    [18000, 'Almuerzo con el equipo', 'gasto', 'alimentacion', 7],
    [9000, 'Taxi', 'gasto', 'transporte', 4],
  ];
  const stamp = now.toISOString();
  transactions.set(
    user.id,
    rows.map(([amount, description, type, category, d]) => ({
      id: crypto.randomUUID(),
      userId: user.id,
      amount,
      description,
      type,
      date: day(Math.max(d, 1)),
      category,
      source: 'manual',
      emotion: null,
      kakeibo: null,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    })),
  );
  Object.assign(moneyProfileOf(user.id), {
    incomeType: 'mensual',
    payDays: [30],
    balance: 412300,
    money: 412300,
    balanceAt: stamp,
    welcomeDone: true,
    commitments: [
      ['Netflix', 26900, 8, 'subscription'],
      ['PILA: salud y pensión', 228000, 13, 'payment'],
      ['Plan celular', 45000, 15, 'payment'],
      ['Arriendo', 450000, 28, 'payment'],
    ].map(([name, amount, dayOfMonth, kind]) => ({ id: crypto.randomUUID(), name, amount, dayOfMonth, frequency: 'monthly', kind })),
  });
}

function addUser(email, password, verified = true) {
  const user = { id: crypto.randomUUID(), email, password, timezone: 'America/Bogota', verified };
  users.set(email, user);
  return user;
}

/**
 * "Envía" el enlace para confirmar el correo: como el backend sin Brevo, lo imprime en la consola
 * para poder abrirlo a mano. Solo sirve el último enlace de cada correo.
 */
function sendVerificationLink(email) {
  for (const [token, owner] of verificationTokens) if (owner === email) verificationTokens.delete(token);
  const token = crypto.randomUUID();
  verificationTokens.set(token, email);
  console.info(`[correo simulado] Para: ${email} | ${window.location.origin}/verificar?token=${token}`);
}

/** Respuesta de error con el esquema `Error` del contrato. */
function error(status, code, message, details) {
  return HttpResponse.json({ error: { code, message, ...(details && { details }) } }, { status });
}

/** Emite un par de tokens nuevo y devuelve un `AuthResponse`. */
function issueSession(user) {
  const accessToken = `mock-access.${crypto.randomUUID()}`;
  const refreshToken = `mock-refresh.${crypto.randomUUID()}`;
  accessTokens.set(accessToken, user.email);
  refreshTokens.set(refreshToken, user.email);
  return { user: { id: user.id, email: user.email }, accessToken, refreshToken };
}

/** Lee el body JSON; `null` si está malformado (→ 400). */
async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Valida `Credentials`: 400 si los tipos no cuadran, 422 si incumple reglas. */
function checkCredentials(body) {
  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
    return error(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
  }
  const details = [];
  if (!EMAIL_RE.test(body.email.trim())) details.push({ field: 'email', problem: 'Debe ser un correo válido' });
  if (body.password.length < 8) details.push({ field: 'password', problem: 'Debe tener al menos 8 caracteres' });
  return details.length ? error(422, 'VALIDATION_ERROR', 'Datos inválidos', details) : null;
}

/** Perfil de `GET /users/me`. Las cuentas de los mocks son de Colombia, en pesos y en español. */
function mockProfile(user) {
  // Sin datos propios, los mocks siguen la región guardada en el navegador (para probar otros idiomas).
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem('rinde.region')) ?? {};
  } catch {
    // Sin región guardada: Colombia.
  }
  user = { ...saved, ...user };
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    timezone: user.timezone,
    isAdmin: true,
    termsAccepted: true,
    country: user.country ?? 'CO',
    currency: user.currency ?? 'COP',
    language: user.language ?? 'es',
  };
}

/** Usuario dueño del Bearer token, o `null`. */
function authUser(request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  const email = token && accessTokens.get(token);
  return email ? users.get(email) : null;
}

/** Catálogo cerrado de categorías (mismas claves que `db/init/02_seed_categorias.sql`). */
const CATALOG = [
  ['alimentacion', 'Alimentación', 'gasto'],
  ['transporte', 'Transporte', 'gasto'],
  ['vivienda', 'Vivienda', 'gasto'],
  ['servicios_publicos', 'Servicios públicos', 'gasto'],
  ['salud', 'Salud', 'gasto'],
  ['educacion', 'Educación', 'gasto'],
  ['entretenimiento', 'Entretenimiento', 'gasto'],
  ['ropa_accesorios', 'Ropa y accesorios', 'gasto'],
  ['tecnologia', 'Tecnología', 'gasto'],
  ['ahorro_inversion', 'Ahorro/Inversión', 'gasto'],
  ['otros', 'Otros', 'gasto'],
  ['salario', 'Salario', 'ingreso'],
  ['freelance', 'Freelance', 'ingreso'],
  ['inversion_rendimientos', 'Inversión y rendimientos', 'ingreso'],
  ['otros_ingresos', 'Otros ingresos', 'ingreso'],
].map(([key, name, type]) => ({ key, name, type }));

/** Palabras que el mock usa en lugar de la IA para sugerir una categoría. */
const KEYWORDS = {
  alimentacion: /almuerzo|cena|desayuno|restaurante|mercado|comida|caf[eé]|super/i,
  transporte: /taxi|uber|bus|gasolina|metro|transporte|peaje/i,
  vivienda: /arriendo|alquiler|hipoteca|vivienda/i,
  servicios_publicos: /luz|agua|internet|gas natural|energ[ií]a|tel[eé]fono/i,
  salud: /m[eé]dico|farmacia|salud|droguer[ií]a/i,
  educacion: /curso|matr[ií]cula|universidad|libro/i,
  entretenimiento: /cine|netflix|spotify|concierto|juego/i,
  salario: /n[oó]mina|salario|sueldo/i,
  freelance: /freelance|proyecto|honorarios/i,
};

/** user id → transacciones (en memoria, como los usuarios). */
const transactions = new Map();

/** Sugerencia del mock: la primera categoría del tipo cuyo patrón coincide, o `null`. */
function mockSuggest(description, type) {
  const match = CATALOG.find((c) => c.type === type && KEYWORDS[c.key]?.test(description));
  return match ? match.key : null;
}

/** Valida el cuerpo de crear/editar como lo hace la API (422 con `details`). */
function checkTransaction(body, { partial }) {
  const details = [];
  const has = (f) => body && f in body;
  if ((!partial || has('amount')) && !(typeof body?.amount === 'number' && body.amount > 0)) {
    details.push({ field: 'amount', problem: 'Debe ser un número mayor que 0' });
  }
  if ((!partial || has('description')) && !(typeof body?.description === 'string' && body.description.trim())) {
    details.push({ field: 'description', problem: 'Es obligatoria' });
  }
  if ((!partial || has('type')) && !['ingreso', 'gasto'].includes(body?.type)) {
    details.push({ field: 'type', problem: 'Debe ser "ingreso" o "gasto"' });
  }
  if ((!partial || has('date')) && !/^\d{4}-\d{2}-\d{2}$/.test(body?.date ?? '')) {
    details.push({ field: 'date', problem: 'Debe ser una fecha válida AAAA-MM-DD' });
  }
  return details.length ? error(422, 'VALIDATION_ERROR', 'Datos inválidos', details) : null;
}

/** Comprueba que la categoría exista y sea del tipo indicado. */
function checkCategory(key, type) {
  const found = CATALOG.find((c) => c.key === key);
  if (found && found.type === type) return null;
  return error(422, 'VALIDATION_ERROR', 'Datos inválidos', [
    { field: 'category', problem: `No es una categoría de ${type} del catálogo` },
  ]);
}

/** Decide categoría y origen: la del usuario o la que "sugiere la IA". */
function resolve(category, description, type) {
  if (category) return { category, source: 'manual' };
  const suggested = mockSuggest(description, type);
  return suggested
    ? { category: suggested, source: 'ia' }
    : { category: null, source: 'sin_clasificar' };
}

/**
 * Alerta de presupuesto simulada para probar la interfaz sin backend: un gasto desde
 * $500.000 avisa al 80 % y desde $1.000.000 marca el presupuesto como superado.
 * @param {{ type: string, amount: number }} transaction
 * @returns {{ level: string, percentage: number }|null}
 */
function mockAlert({ type, amount }) {
  if (type !== 'gasto') return null;
  if (amount >= 1_000_000) return { level: 'exceeded_100', percentage: 112.5 };
  if (amount >= 500_000) return { level: 'warning_80', percentage: 85 };
  return { level: 'none', percentage: 20 };
}

/** Ideas de ejemplo de Lo que viene (FT-0026). */
const ideas = [
  { id: 'idea-1', title: 'Registrar gastos por WhatsApp', status: 'en_progreso', votes: 12 },
  { id: 'idea-2', title: 'Metas de ahorro personales', status: 'planeada', votes: 7 },
  { id: 'idea-3', title: 'Registro por voz', status: 'lista', votes: 20 },
  { id: 'idea-4', title: 'Dividir gastos con amigos', status: 'revision', votes: 0 },
];
const ideaVotes = new Set();

/** Perfil de Mi plata por usuario. */
const moneyProfiles = new Map();

/** @returns {object} El perfil del usuario; vacío si todavía no tiene. */
function moneyProfileOf(userId) {
  if (!moneyProfiles.has(userId)) {
    moneyProfiles.set(userId, {
      incomeType: null,
      payDays: [],
      balance: null,
      balanceAt: null,
      money: null,
      totals: { income: 0, expense: 0 },
      welcomeDone: false,
      tutorialDone: false,
      commitments: [],
    });
  }
  return moneyProfiles.get(userId);
}

seedDemo(demoUser);

/** Cuenta como la devuelve la API: con lo pagado, lo que falta y la próxima cuota (FT-0064). */
function presentDebt(d) {
  const payments = d.payments ?? [];
  const p = progress(d, payments.reduce((sum, x) => sum + x.amount, 0));
  return {
    ...d,
    payments: [...payments].sort((a, b) => b.date.localeCompare(a.date)),
    paid: p.paid,
    pending: d.settledAt ? 0 : p.pending,
    paidInstallments: p.paidInstallments,
    nextInstallment: d.settledAt ? null : p.next,
    // Con cuotas, la fecha límite es la de la próxima cuota (así avisa cada una).
    dueDate: d.installments && p.next ? p.next.date : d.dueDate,
  };
}

/** Cuentas de ejemplo del usuario demo: una en cuotas con un abono, una de una sola fecha y una que debe. */
function seedDemoDebts(userId) {
  const now = new Date();
  const iso = (offset) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset).toLocaleDateString('en-CA');
  const base = { note: null, settledAt: null, transactionId: null, reminder: { daysBefore: [1], time: null, channel: 'push' } };
  debtsByUser.set(userId, [
    {
      ...base,
      id: 'debt-demo-1',
      kind: 'receivable',
      person: 'Laura Gómez',
      amount: 200000,
      loanDate: iso(-20),
      installments: 4,
      frequency: 'biweekly',
      firstDueDate: iso(-5),
      dueDate: iso(-5),
      note: 'Para el arriendo',
      payments: [{ id: 'pay-demo-1', amount: 50000, date: iso(-5), transactionId: null }],
    },
    {
      ...base,
      id: 'debt-demo-2',
      kind: 'receivable',
      person: 'Andrés',
      amount: 35000,
      loanDate: iso(-3),
      installments: null,
      frequency: null,
      firstDueDate: null,
      dueDate: iso(4),
      payments: [],
    },
    {
      ...base,
      id: 'debt-demo-3',
      kind: 'payable',
      person: 'Mamá',
      amount: 300000,
      loanDate: iso(-40),
      installments: 3,
      frequency: 'monthly',
      firstDueDate: iso(-10),
      dueDate: iso(-10),
      payments: [{ id: 'pay-demo-2', amount: 100000, date: iso(-10), transactionId: null }],
    },
  ]);
}
seedDemoDebts(demoUser.id);

/** Metas personales (vacas de una sola persona) por usuario; la proyección se calcula como el backend. */
const vacasByUser = new Map();

function presentVaca(v) {
  const total = v.contributions.reduce((sum, c) => sum + c.amount, 0);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = v.deadline ? Math.round((Date.parse(`${v.deadline}T00:00:00Z`) - today) / 86_400_000) : null;
  const remaining = Math.max(0, v.goal - total);
  const first = v.contributions.length ? Math.min(...v.contributions.map((c) => Date.parse(`${c.date}T00:00:00Z`))) : today;
  const elapsed = Math.max(1, Math.round((today - first) / 86_400_000));
  const averagePerDay = v.contributions.length ? total / elapsed : 0;
  const neededPerDay = daysLeft > 0 ? remaining / daysLeft : null;
  const status = remaining === 0 ? 'completada' : daysLeft !== null && daysLeft < 0 ? 'vencida' : 'activa';
  const estimated = averagePerDay > 0 ? new Date(today + Math.ceil(remaining / averagePerDay) * 86_400_000).toISOString().slice(0, 10) : null;
  return {
    ...v,
    code: null,
    personal: true,
    role: 'admin',
    split: 'igual',
    total,
    percentage: Math.min(100, Math.round((total / v.goal) * 1000) / 10),
    status,
    membersCount: 1,
    myQuota: v.goal,
    myContributed: total,
    myRemaining: remaining,
    myStatus: remaining === 0 ? 'cumplido' : 'al_dia',
    projection: {
      remaining,
      averagePerDay,
      estimatedDate: estimated,
      daysLeft,
      neededPerDay,
      neededPerWeek: neededPerDay === null ? null : neededPerDay * 7,
      onTrack: daysLeft === null || remaining === 0 ? null : estimated !== null && estimated <= v.deadline,
    },
    updatedAt: new Date().toISOString(),
  };
}

{
  const d = (offset) => new Date(Date.now() + offset * 86_400_000).toLocaleDateString('en-CA');
  vacasByUser.set(demoUser.id, [
    { id: 'meta-demo-1', name: 'Fondo de emergencia', description: null, goal: 3600000, deadline: null, contributions: [{ id: 'c1', amount: 720000, date: d(-60) }] },
    { id: 'meta-demo-2', name: 'Viaje a Santa Marta', description: null, goal: 1200000, deadline: d(30), contributions: [{ id: 'c2', amount: 400000, date: d(-40) }, { id: 'c3', amount: 240000, date: d(-6) }] },
    { id: 'meta-demo-3', name: 'Portátil nuevo', description: null, goal: 2800000, deadline: d(130), contributions: [{ id: 'c4', amount: 380000, date: d(-23) }] },
  ]);
}

/** Tarjetas por usuario (solo lo que piden las pantallas; el cálculo de cupo real vive en el backend). */
const cardsByUser = new Map();

/** `expiry` como lo devuelve la API (FT-0065): "03/27", si ya venció y si vence en 60 días o menos. */
function cardExpiry({ expiryMonth, expiryYear }) {
  if (!expiryMonth || !expiryYear) return null;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.round((Date.UTC(expiryYear, expiryMonth - 1, 1) - today) / 86_400_000);
  const expired = today >= Date.UTC(expiryYear, expiryMonth, 1);
  return {
    label: `${String(expiryMonth).padStart(2, '0')}/${String(expiryYear).slice(2)}`,
    expired,
    soon: !expired && daysLeft <= 60,
  };
}

/** Tarjeta como la devuelve la API, con el próximo pago calculado a partir del día de pago. */
function presentCard(card) {
  const now = new Date();
  let next = new Date(now.getFullYear(), now.getMonth(), card.paymentDay);
  if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next = new Date(now.getFullYear(), now.getMonth() + 1, card.paymentDay);
  return {
    ...card,
    available: card.limit - card.used,
    nextPaymentDate: next.toLocaleDateString('en-CA'),
    daysToPayment: Math.round((next - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000),
    paidThisCycle: false,
    statementTotal: null,
    statementDueDate: null,
    expiry: cardExpiry(card),
  };
}

const soon = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
cardsByUser.set(demoUser.id, [
  { id: 'card-demo-1', name: 'Visa Gold ••8456', network: 'visa', tier: 'gold', last4: '8456', limit: 3000000, used: 816000, paymentDay: 15, cutoffDay: 30, expiryMonth: soon.getMonth() + 1, expiryYear: soon.getFullYear(), expiryNotified: [] },
  { id: 'card-demo-2', name: 'Mastercard ••1290', network: 'mastercard', tier: 'clasica', last4: '1290', limit: 1500000, used: 230000, paymentDay: 5, cutoffDay: null, expiryMonth: 9, expiryYear: 2029, expiryNotified: [] },
]);

/** user id → presupuestos `{ id, category, month, amount }` (el consumo se calcula al pedirlos). */
const budgetsByUser = new Map([
  [
    demoUser.id,
    [
      ['alimentacion', 150000],
      ['vivienda', 600000],
      ['entretenimiento', 80000],
      ['transporte', 60000],
    ].map(([category, amount]) => ({ id: crypto.randomUUID(), category, month: new Date().toLocaleDateString('en-CA').slice(0, 7), amount })),
  ],
]);

/** Presupuesto con lo gastado en su categoría y mes, y su alerta (RN-04). */
function withConsumption(userId, budget) {
  const consumed = (transactions.get(userId) ?? [])
    .filter((t) => t.type === 'gasto' && !t.deletedAt && t.category === budget.category && t.date.startsWith(budget.month))
    .reduce((sum, t) => sum + t.amount, 0);
  const percentage = Math.round((consumed / budget.amount) * 1000) / 10;
  const level = percentage >= 100 ? 'exceeded_100' : percentage >= 80 ? 'warning_80' : 'none';
  return { ...budget, consumed, percentage, alert: { level, percentage } };
}

export const handlers = [
  http.get(`${API_V1}/budgets`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const month = new URL(request.url).searchParams.get('month');
    const list = (budgetsByUser.get(user.id) ?? []).filter((b) => !month || b.month === month);
    return HttpResponse.json(list.map((b) => withConsumption(user.id, b)));
  }),

  http.post(`${API_V1}/budgets`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const { category, month, amount } = await readJson(request);
    const list = budgetsByUser.get(user.id) ?? [];
    if (list.some((b) => b.category === category && b.month === month)) {
      return error(409, 'BUDGET_EXISTS', 'Ya hay un presupuesto para esa categoría en ese mes');
    }
    const budget = { id: crypto.randomUUID(), category, month, amount };
    budgetsByUser.set(user.id, [...list, budget]);
    return HttpResponse.json(withConsumption(user.id, budget), { status: 201 });
  }),

  http.put(`${API_V1}/budgets/:id`, async ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const budget = (budgetsByUser.get(user.id) ?? []).find((b) => b.id === params.id);
    if (!budget) return error(404, 'NOT_FOUND', 'Presupuesto no encontrado');
    budget.amount = (await readJson(request)).amount;
    return HttpResponse.json(withConsumption(user.id, budget));
  }),

  http.delete(`${API_V1}/budgets/:id`, ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    budgetsByUser.set(user.id, (budgetsByUser.get(user.id) ?? []).filter((b) => b.id !== params.id));
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API_V1}/auth/register`, async ({ request }) => {
    const body = await readJson(request);
    await delay();
    const invalid = checkCredentials(body);
    if (invalid) return invalid;
    const email = body.email.trim().toLowerCase();
    if (users.has(email)) return error(409, 'EMAIL_TAKEN', 'El correo ya está registrado');
    const user = addUser(email, body.password, false);
    if (typeof body.name === 'string' && body.name.trim()) user.name = body.name.trim().replace(/\s+/g, ' ');
    sendVerificationLink(email);
    return HttpResponse.json({ email, verificationRequired: true }, { status: 201 });
  }),

  http.post(`${API_V1}/auth/verify-email`, async ({ request }) => {
    const body = await readJson(request);
    await delay();
    if (!body || typeof body.token !== 'string' || body.token === '') {
      return error(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
    }
    const email = verificationTokens.get(body.token);
    if (!email) return error(400, 'INVALID_VERIFICATION_TOKEN', 'El enlace no es válido o ya venció.');
    verificationTokens.delete(body.token);
    const user = users.get(email);
    user.verified = true;
    return HttpResponse.json(issueSession(user));
  }),

  http.post(`${API_V1}/auth/resend-verification`, async ({ request }) => {
    const body = await readJson(request);
    await delay();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (users.get(email)?.verified === false) sendVerificationLink(email);
    return HttpResponse.json({
      message: 'Si el correo tiene una cuenta sin confirmar, te enviamos un enlace nuevo.',
    });
  }),

  // Google: en desarrollo cualquier credential entra como una cuenta de Google de prueba.
  http.post(`${API_V1}/auth/google`, async ({ request }) => {
    const body = await readJson(request);
    await delay();
    if (!body || typeof body.credential !== 'string' || body.credential === '') {
      return error(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
    }
    const email = 'cuenta.google@example.com';
    return HttpResponse.json(issueSession(users.get(email) ?? addUser(email, crypto.randomUUID())));
  }),

  http.post(`${API_V1}/auth/login`, async ({ request }) => {
    const body = await readJson(request);
    await delay();
    if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
      return error(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
    }
    const user = users.get(body.email.trim().toLowerCase());
    if (!user || user.password !== body.password) {
      return error(401, 'UNAUTHORIZED', 'Correo o contraseña incorrectos');
    }
    if (!user.verified) {
      return error(403, 'EMAIL_NOT_VERIFIED', 'Confirma tu correo para entrar.');
    }
    return HttpResponse.json(issueSession(user));
  }),

  http.post(`${API_V1}/auth/refresh`, async ({ request }) => {
    const body = await readJson(request);
    if (!body || typeof body.refreshToken !== 'string') {
      return error(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
    }
    const email = refreshTokens.get(body.refreshToken);
    if (!email) return error(401, 'UNAUTHORIZED', 'Refresh token inválido, vencido o revocado');
    refreshTokens.delete(body.refreshToken); // rotación
    const { accessToken, refreshToken } = issueSession(users.get(email));
    return HttpResponse.json({ accessToken, refreshToken });
  }),

  http.post(`${API_V1}/auth/logout`, async ({ request }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const body = await readJson(request);
    if (body?.refreshToken) refreshTokens.delete(body.refreshToken);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_V1}/users/me`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json(mockProfile(user));
  }),

  // Tasas de cambio: unas fijas de ejemplo (el servidor las trae de Frankfurter).
  http.get(`${API_V1}/exchange-rates`, ({ request }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const url = new URL(request.url);
    const [from, to] = [url.searchParams.get('from'), url.searchParams.get('to')];
    const perUsd = { USD: 1, COP: 3319.65, MXN: 18.53, BRL: 5.74, EUR: 0.908, PEN: 3.41, CLP: 999.9, ARS: 1550, CNY: 7.1 };
    if (!perUsd[from] || !perUsd[to]) return error(503, 'RATE_UNAVAILABLE', 'No pudimos traer la tasa de cambio. Escríbela tú.');
    const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
    return HttpResponse.json({ from, to, date, rate: Math.round((perUsd[to] / perUsd[from]) * 1e6) / 1e6, stale: false });
  }),

  // País, moneda principal, idioma o nombre. La moneda no cambia si ya hay movimientos (como el servidor).
  http.patch(`${API_V1}/users/me`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const body = (await readJson(request)) ?? {};
    const current = mockProfile(user);
    if (body.currency && body.currency !== current.currency && (transactions.get(user.id) ?? []).length > 0) {
      return error(409, 'CURRENCY_LOCKED', `Ya tienes movimientos en ${current.currency}: tu moneda principal no se puede cambiar`);
    }
    for (const field of ['name', 'country', 'currency', 'language']) if (field in body) user[field] = body[field];
    return HttpResponse.json(mockProfile(user));
  }),

  http.get(`${API_V1}/categories`, ({ request }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const pick = (type) =>
      CATALOG.filter((c) => c.type === type).map(({ key, name, icon = null, color = null, custom = false }) => ({
        key,
        name,
        icon,
        color,
        custom,
      }));
    return HttpResponse.json({ expense: pick('gasto'), income: pick('ingreso') });
  }),

  // Categorías propias: en los mocks se agregan al mismo catálogo (no se separan por usuario).
  http.post(`${API_V1}/categories`, async ({ request }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const body = await readJson(request);
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 30 || !['gasto', 'ingreso'].includes(body?.type)) {
      return error(422, 'VALIDATION_ERROR', 'Datos inválidos', [{ field: 'name', problem: 'Debe tener entre 1 y 30 caracteres' }]);
    }
    if (CATALOG.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      return error(409, 'CATEGORY_EXISTS', 'Ya tienes una categoría con ese nombre');
    }
    if (CATALOG.filter((c) => c.custom).length >= 20) {
      return error(409, 'CATEGORY_LIMIT', 'Puedes tener hasta 20 categorías propias');
    }
    await delay(400);
    const category = {
      key: `c_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`,
      name,
      type: body.type,
      icon: body.icon,
      color: body.color,
      custom: true,
    };
    CATALOG.push(category);
    const { key, icon, color, custom } = category;
    return HttpResponse.json({ key, name, icon, color, custom }, { status: 201 });
  }),

  http.patch(`${API_V1}/categories/:key`, async ({ request, params }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const category = CATALOG.find((c) => c.key === params.key && c.custom);
    if (!category) return error(404, 'NOT_FOUND', 'Categoría no encontrada');
    const body = (await readJson(request)) ?? {};
    const name = typeof body.name === 'string' ? body.name.trim() : category.name;
    if (CATALOG.some((c) => c !== category && c.name.toLowerCase() === name.toLowerCase())) {
      return error(409, 'CATEGORY_EXISTS', 'Ya tienes una categoría con ese nombre');
    }
    Object.assign(category, { name, icon: body.icon ?? category.icon, color: body.color ?? category.color });
    const { key, icon, color, custom } = category;
    return HttpResponse.json({ key, name, icon, color, custom });
  }),

  http.delete(`${API_V1}/categories/:key`, ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const index = CATALOG.findIndex((c) => c.key === params.key && c.custom);
    if (index === -1) return error(404, 'NOT_FOUND', 'Categoría no encontrada');
    const [category] = CATALOG.splice(index, 1);
    const fallback = category.type === 'gasto' ? 'otros' : 'otros_ingresos';
    let moved = 0;
    for (const t of transactions.get(user.id) ?? []) {
      if (t.category === category.key) {
        t.category = fallback;
        moved += 1;
      }
    }
    return HttpResponse.json({ moved });
  }),

  http.get(`${API_V1}/transactions`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const q = new URL(request.url).searchParams;
    const page = Number(q.get('page') ?? 1);
    const pageSize = Number(q.get('pageSize') ?? 20);
    const rows = (transactions.get(user.id) ?? [])
      .filter((t) => (!q.get('type') || t.type === q.get('type')))
      .filter((t) => (!q.get('category') || t.category === q.get('category')))
      .filter((t) => (!q.get('q') || plainText(t.description).includes(plainText(q.get('q')))))
      .filter((t) => (!q.get('from') || t.date >= q.get('from')))
      .filter((t) => (!q.get('to') || t.date <= q.get('to')))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    return HttpResponse.json({
      data: rows.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total: rows.length,
    });
  }),

  http.post(`${API_V1}/transactions`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const body = await readJson(request);
    await delay(500);
    const invalid = checkTransaction(body, { partial: false });
    if (invalid) return invalid;
    if (body.category) {
      const wrong = checkCategory(body.category, body.type);
      if (wrong) return wrong;
    }
    const now = new Date().toISOString();
    const transaction = {
      id: crypto.randomUUID(),
      userId: user.id,
      amount: body.amount,
      description: body.description.trim(),
      type: body.type,
      date: body.date,
      ...resolve(body.category, body.description, body.type),
      // FT-0070: solo en gastos.
      emotion: body.type === 'gasto' ? (body.emotion ?? null) : null,
      kakeibo: body.type === 'gasto' ? (body.kakeibo ?? null) : null,
      // En otra moneda el monto lo calcula el servidor: lo pagado allá × la tasa.
      original: body.original ?? null,
      ...(body.original && { amount: Math.round(body.original.amount * body.original.rate * 100) / 100 }),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    transactions.set(user.id, [transaction, ...(transactions.get(user.id) ?? [])]);
    return HttpResponse.json({ transaction, alert: mockAlert(transaction) }, { status: 201 });
  }),

  // Versión simplificada de /sync/batch: solo `create`, sin conflictos ni `serverChanges`.
  http.post(`${API_V1}/sync/batch`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const body = await readJson(request);
    if (!body || !Array.isArray(body.operations)) {
      return error(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
    }
    await delay(500);
    const own = transactions.get(user.id) ?? [];
    const synced = [];
    for (const { op, localId, transaction: input } of body.operations) {
      if (op !== 'create') continue;
      // Reenviar el mismo localId no duplica, como en el servidor real.
      let saved = own.find((t) => t.localId === localId);
      if (!saved) {
        const now = new Date().toISOString();
        saved = {
          id: crypto.randomUUID(),
          localId,
          userId: user.id,
          amount: input.amount,
          description: input.description.trim(),
          type: input.type,
          date: input.date,
          ...resolve(input.category, input.description, input.type),
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
        own.unshift(saved);
      }
      synced.push({ localId, serverId: saved.id, transaction: saved });
    }
    transactions.set(user.id, own);
    return HttpResponse.json({ synced, conflicts: [], serverChanges: [], syncedAt: new Date().toISOString() });
  }),

  // Antes de `/transactions/:id`, que si no tomaría "reflection" como id (FT-0070).
  http.get(`${API_V1}/transactions/reflection`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const day = new Date(`${new URL(request.url).searchParams.get('date') ?? new Date().toISOString().slice(0, 10)}T12:00:00`);
    const monday = new Date(day);
    monday.setDate(day.getDate() - ((day.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const iso = (d) => d.toISOString().slice(0, 10);
    const [from, to] = [iso(monday), iso(sunday)];
    const week = (transactions.get(user.id) ?? []).filter(
      (t) => t.type === 'gasto' && !t.deletedAt && t.date >= from && t.date <= to,
    );
    const sum = (list) => ({ count: list.length, total: list.reduce((acc, t) => acc + t.amount, 0) });
    const emotions = ['valio_la_pena', 'normal', 'no_lo_necesitaba', 'me_arrepiento'].map((key) => ({
      key,
      ...sum(week.filter((t) => t.emotion === key)),
    }));
    const kakeibo = ['necesidad', 'deseo', 'cultura', 'imprevisto'].map((key) => ({
      key,
      ...sum(week.filter((t) => t.kakeibo === key)),
    }));
    const regrets = week
      .filter((t) => t.emotion === 'no_lo_necesitaba' || t.emotion === 'me_arrepiento')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
      .map(({ id, description, amount, date, emotion }) => ({ id, description, amount, date, emotion }));
    const regretTotal = regrets.reduce((acc, r) => acc + r.amount, 0);
    const questions = [];
    if (regrets.length)
      questions.push(
        `Esta semana ${regrets.length} ${regrets.length === 1 ? 'gasto' : 'gastos'} por $${regretTotal.toLocaleString('es-CO')} no te convencieron. ¿Qué tenían en común?`,
      );
    if (kakeibo[1].count) questions.push('¿Cuál de tus deseos de esta semana podrías dejar para la próxima?');
    if (week.length && week.filter((t) => t.emotion).length < week.length)
      questions.push('¿Qué gasto de esta semana te hizo sentir mejor, y por qué?');
    return HttpResponse.json({
      from,
      to,
      expenses: sum(week),
      withEmotion: week.filter((t) => t.emotion).length,
      emotions,
      kakeibo,
      withoutKakeibo: sum(week.filter((t) => !t.kakeibo)),
      regrets,
      questions: questions.slice(0, 3),
    });
  }),

  http.get(`${API_V1}/transactions/:id`, ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const found = (transactions.get(user.id) ?? []).find((t) => t.id === params.id);
    if (!found) return error(404, 'NOT_FOUND', 'Transacción no encontrada');
    return HttpResponse.json(found);
  }),

  http.put(`${API_V1}/transactions/:id`, async ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const current = (transactions.get(user.id) ?? []).find((t) => t.id === params.id);
    if (!current) return error(404, 'NOT_FOUND', 'Transacción no encontrada');
    const body = await readJson(request);
    await delay(400);
    const invalid = checkTransaction(body, { partial: true });
    if (invalid) return invalid;
    const type = body.type ?? current.type;
    const next = { ...current };
    for (const field of ['amount', 'description', 'date', 'emotion', 'kakeibo']) if (field in body) next[field] = body[field];
    next.type = type;
    // Emoción y Kakeibo son solo de gastos (FT-0070): al pasar a ingreso se quitan.
    if (type === 'ingreso') Object.assign(next, { emotion: null, kakeibo: null });
    if ('category' in body || type !== current.type) {
      const category = 'category' in body ? body.category : null;
      if (category) {
        const wrong = checkCategory(category, type);
        if (wrong) return wrong;
      }
      Object.assign(next, resolve(category, next.description, type));
    }
    next.updatedAt = new Date().toISOString();
    Object.assign(current, next);
    return HttpResponse.json({ transaction: current, alert: mockAlert(current) });
  }),

  http.get(`${API_V1}/insights`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    await delay(800);
    if ((transactions.get(user.id) ?? []).length < 3) {
      return error(
        422,
        'INSUFFICIENT_HISTORY',
        'Aún no hay suficiente historial. Registra movimientos durante al menos una semana para recibir consejos.',
      );
    }
    // Como la API con menos de un mes de historial: la semana actual, desde el lunes.
    const today = new Date();
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
    return HttpResponse.json({
      period: 'week',
      month: today.toISOString().slice(0, 7),
      from: `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`,
      insights: [
        {
          type: 'saving_opportunity',
          title: 'Gastas más en alimentación',
          detail: 'Esta semana llevas 18 % más que la anterior. Reducir los domicilios a 2 por semana podría ahorrarte $30.000.',
        },
        {
          type: 'positive_trend',
          title: 'Transporte a la baja',
          detail: 'Gastaste $12.000 menos que la semana pasada en transporte.',
        },
      ],
    });
  }),

  // Analítica (FT-0019): valores de ejemplo; el cálculo real está en el backend.
  http.get(`${API_V1}/analytics`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    await delay(400);
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return HttpResponse.json({
      month: today.toISOString().slice(0, 7),
      day: today.getDate(),
      daysInMonth,
      empty: (transactions.get(user.id) ?? []).length === 0,
      // Gasto acumulado de ejemplo que llega a $ 1.840.000 hoy, con un arriendo el día 1.
      daily: Array.from({ length: today.getDate() }, (_, i) => ({
        day: i + 1,
        total: Math.round(900000 + (940000 * (i + 1)) / today.getDate()),
      })),
      previousScore: 60,
      projection: {
        available: today.getDate() >= 3,
        spent: 1840000,
        projected: 2310000,
        pendingFixed: 0,
        oneOff: 0,
        saved: 0,
        income: 2800000,
        possibleIncome: 0,
        balance: 490000,
      },
      smallExpenses: {
        threshold: 20000,
        count: 14,
        total: 142000,
        share: 7.7,
        yearly: 1704000,
        flagged: true,
        top: [
          { description: 'Café', count: 6, total: 33000 },
          { description: 'Snacks', count: 4, total: 26000 },
          { description: 'Bus', count: 3, total: 9000 },
        ],
      },
      health: {
        score: 68,
        level: 'good',
        parts: [
          { key: 'savings', points: 21.9, value: 17.5 },
          { key: 'budgets', points: 16.7, value: 2 },
          { key: 'stability', points: 13.3, value: 14 },
          { key: 'small_expenses', points: 15.5, value: 7.7 },
        ],
      },
    });
  }),

  http.post(`${API_V1}/assistant/chat`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const question = (await readJson(request))?.messages?.at(-1)?.text?.toLowerCase() ?? '';
    await delay(900);
    if (question.includes('cdt')) {
      return HttpResponse.json({
        reply:
          'Para un CDT a 360 días el promedio es 12,77 % E.A. La que más paga es Banco Pichincha con 13,31 % (corte del 27/10/2026, Superintendencia Financiera).',
        toolsUsed: ['tasas_cdt'],
      });
    }
    const reply = question.includes('ahorr')
      ? 'Este mes llevas $1.500.000 de ingresos y $765.000 de gastos: te quedan unos $735.000. Si apartas el 20 % de tus ingresos, serían $300.000 de ahorro.'
      : question.includes('presupuesto')
        ? 'Vas bien en Transporte (52 %), pero Alimentación ya va en el 85 %: te quedan $75.000 para lo que resta del mes.'
        : 'Tu mayor gasto del mes es Alimentación, con $425.000. Le siguen Transporte ($210.000) y Ocio ($130.000).';
    return HttpResponse.json({ reply, toolsUsed: ['resumen_de_movimientos'] });
  }),

  http.get(`${API_V1}/push/vapid-public-key`, ({ request }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json({ key: MOCK_VAPID_PUBLIC_KEY });
  }),

  http.post(`${API_V1}/push/subscribe`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const body = await readJson(request);
    const { endpoint, keys } = body?.subscription ?? {};
    if (typeof endpoint !== 'string' || typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string') {
      return error(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
    }
    pushEndpoints.set(endpoint, user.id);
    return new HttpResponse(null, { status: 201 });
  }),

  http.delete(`${API_V1}/push/subscribe`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const body = await readJson(request);
    if (typeof body?.endpoint !== 'string') {
      return error(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
    }
    if (pushEndpoints.get(body.endpoint) !== user.id) return error(404, 'NOT_FOUND', 'Suscripción no encontrada');
    pushEndpoints.delete(body.endpoint);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_V1}/users/me/reminder-settings`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json(reminders.get(user.id) ?? { times: [], time: null, timezone: user.timezone });
  }),

  http.put(`${API_V1}/users/me/reminder-settings`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const body = await readJson(request);
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
    const raw = Array.isArray(body?.times) ? body.times : body?.time === null ? [] : [body?.time];
    if (!body || typeof body.timezone !== 'string' || !raw.every((t) => typeof t === 'string')) {
      return error(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
    }
    if (!raw.every((t) => timeRe.test(t))) {
      return error(422, 'VALIDATION_ERROR', 'Datos inválidos', [
        { field: 'times', problem: 'Cada hora debe tener el formato HH:mm (00:00 a 23:59)' },
      ]);
    }
    const times = [...new Set(raw)].sort();
    if (times.length > 5) {
      return error(422, 'VALIDATION_ERROR', 'Datos inválidos', [
        { field: 'times', problem: 'Máximo 5 recordatorios al día' },
      ]);
    }
    const settings = { times, time: times[0] ?? null, timezone: body.timezone };
    reminders.set(user.id, settings);
    return HttpResponse.json(settings);
  }),

  http.delete(`${API_V1}/transactions/:id`, ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const list = transactions.get(user.id) ?? [];
    if (!list.some((t) => t.id === params.id)) return error(404, 'NOT_FOUND', 'Transacción no encontrada');
    transactions.set(user.id, list.filter((t) => t.id !== params.id));
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_V1}/money-profile`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json(moneyProfileOf(user.id));
  }),

  http.get(`${API_V1}/money-profile/adjustments`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json({ data: adjustments.get(user.id) ?? [] });
  }),

  // Plan simplificado: con saldo conocido, cuántos días alcanza al ritmo de gasto del mes.
  http.get(`${API_V1}/money-profile/plan`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const profile = moneyProfileOf(user.id);
    if (typeof profile.money !== 'number') return HttpResponse.json({ ready: false });
    const today = new Date();
    const spent = (transactions.get(user.id) ?? [])
      .filter((t) => t.type === 'gasto' && !t.deletedAt && t.date.slice(0, 7) === today.toLocaleDateString('en-CA').slice(0, 7))
      .reduce((sum, t) => sum + t.amount, 0);
    const pace = Math.round(spent / Math.max(today.getDate(), 1));
    return HttpResponse.json({
      ready: true,
      mode: 'runway',
      money: profile.money,
      free: profile.money,
      shortfall: 0,
      pace,
      runwayDays: pace > 0 ? Math.floor(profile.money / pace) : null,
      pending: [],
    });
  }),

  http.put(`${API_V1}/money-profile`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const profile = moneyProfileOf(user.id);
    const { incomeType = null, payDays = [], balance = null, resetBalance = false } = await readJson(request);
    if (resetBalance && typeof profile.money === 'number' && balance !== null && profile.money !== balance) {
      const now = new Date();
      adjustments.set(user.id, [
        { id: crypto.randomUUID(), before: profile.money, after: balance, date: now.toLocaleDateString('en-CA'), createdAt: now.toISOString() },
        ...(adjustments.get(user.id) ?? []),
      ]);
    }
    Object.assign(profile, {
      incomeType,
      payDays,
      balance,
      money: balance,
      balanceAt: balance === null ? null : new Date().toISOString(),
    });
    return HttpResponse.json(profile);
  }),

  http.post(`${API_V1}/money-profile/tutorial`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const profile = moneyProfileOf(user.id);
    profile.tutorialDone = true;
    return HttpResponse.json(profile);
  }),

  http.post(`${API_V1}/money-profile/welcome`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const profile = moneyProfileOf(user.id);
    const { commitments = [], ...answers } = (await readJson(request)) ?? {};
    Object.assign(profile, answers, { welcomeDone: true });
    for (const item of commitments) profile.commitments.push({ id: crypto.randomUUID(), ...item });
    return HttpResponse.json(profile);
  }),

  // Fuentes de ingreso (FT-0060): aquí solo se aceptan, para poder terminar la bienvenida sin servidor.
  http.put(`${API_V1}/money-profile/sources`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const { sources = [] } = (await readJson(request)) ?? {};
    return HttpResponse.json({ sources });
  }),

  // Calendario simplificado (FT-0025, FT-0069): compromisos y cuentas con fecha del mes pedido.
  http.get(`${API_V1}/money-profile/calendar`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const profile = moneyProfileOf(user.id);
    const today = new Date().toLocaleDateString('en-CA');
    const month = new URL(request.url).searchParams.get('month') ?? today.slice(0, 7);
    const status = (date) => (date < today ? 'atrasado' : 'pendiente');
    const events = [
      ...profile.commitments.map((c) => {
        const date = `${month}-${String(c.dayOfMonth).padStart(2, '0')}`;
        return { date, kind: 'compromiso', id: c.id, name: c.name, amount: c.amount, status: status(date) };
      }),
      ...(debtsByUser.get(user.id) ?? [])
        .map(presentDebt)
        .filter((d) => d.dueDate?.startsWith(month) && !d.settledAt)
        .map((d) => ({
          date: d.dueDate,
          kind: d.kind === 'payable' ? 'cuenta' : 'cobro',
          id: d.id,
          name: d.person,
          amount: d.nextInstallment?.amount ?? d.pending,
          status: status(d.dueDate),
        })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    let balance = profile.money;
    for (const e of events) {
      const counts = e.kind !== 'cobro' && typeof balance === 'number';
      if (counts) balance -= e.amount;
      e.balanceAfter = counts ? balance : null;
      e.risk = counts ? (balance < 0 ? 'negativo' : balance < 100000 ? 'riesgo' : 'ok') : null;
    }
    const pending = events.filter((e) => e.kind !== 'cobro').reduce((acc, e) => acc + e.amount, 0);
    // Como el servidor: corte de cada tarjeta y fecha límite (aquí el pago de tarjeta no sale como evento).
    const day = (d) => `${month}-${String(Math.min(d, new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate())).padStart(2, '0')}`;
    const info = { amount: null, status: null, balanceAfter: null, risk: null };
    const cardDates = (cardsByUser.get(user.id) ?? [])
      .flatMap((c) => [
        ...(c.cutoffDay ? [{ date: day(c.cutoffDay), kind: 'corte', id: c.id, name: c.name, ...info }] : []),
        { date: day(c.paymentDay), kind: 'limite', id: c.id, name: c.name, ...info },
      ])
      .sort((a, b) => a.date.localeCompare(b.date));
    return HttpResponse.json({ month, today, money: profile.money, projectedUntil: null, events, cardDates, totals: { pending, paid: 0 } });
  }),

  http.post(`${API_V1}/money-profile/commitments`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const profile = moneyProfileOf(user.id);
    const body = await readJson(request);
    if (profile.commitments.some((c) => c.name.toLowerCase() === body.name.toLowerCase())) {
      return error(409, 'COMMITMENT_EXISTS', 'Ya tienes un compromiso con ese nombre');
    }
    const commitment = { id: crypto.randomUUID(), ...body };
    profile.commitments.push(commitment);
    return HttpResponse.json(commitment, { status: 201 });
  }),

  http.put(`${API_V1}/money-profile/commitments/:id`, async ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const commitment = moneyProfileOf(user.id).commitments.find((c) => c.id === params.id);
    if (!commitment) return error(404, 'NOT_FOUND', 'Compromiso no encontrado');
    Object.assign(commitment, await readJson(request));
    return HttpResponse.json(commitment);
  }),

  http.delete(`${API_V1}/money-profile/commitments/:id`, ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const profile = moneyProfileOf(user.id);
    profile.commitments = profile.commitments.filter((c) => c.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_V1}/ideas`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const shown = ideas
      .filter((idea) => ['planeada', 'en_progreso', 'lista'].includes(idea.status))
      .map((idea) => {
        const voted = ideaVotes.has(idea.id);
        return { ...idea, votes: idea.votes + (voted ? 1 : 0), voted };
      })
      .sort((a, b) => b.votes - a.votes);
    return HttpResponse.json({
      upcoming: shown.filter((idea) => idea.status !== 'lista'),
      done: shown.filter((idea) => idea.status === 'lista'),
    });
  }),

  http.post(`${API_V1}/ideas`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const { title } = await readJson(request);
    return HttpResponse.json({ id: crypto.randomUUID(), title, status: 'revision' }, { status: 201 });
  }),

  http.get(`${API_V1}/ideas/admin`, ({ request }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json({ ideas: ideas.map((idea) => ({ ...idea, createdAt: new Date().toISOString() })) });
  }),

  http.post(`${API_V1}/ideas/admin`, async ({ request }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const idea = { id: crypto.randomUUID(), votes: 0, status: 'planeada', ...(await readJson(request)) };
    ideas.unshift(idea);
    return HttpResponse.json(idea, { status: 201 });
  }),

  http.patch(`${API_V1}/ideas/admin/:id`, async ({ request, params }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const idea = ideas.find(({ id }) => id === params.id);
    if (!idea) return error(404, 'NOT_FOUND', 'Idea no encontrada');
    Object.assign(idea, await readJson(request));
    return HttpResponse.json(idea);
  }),

  http.post(`${API_V1}/ideas/:id/vote`, ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    ideaVotes.add(params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(`${API_V1}/ideas/:id/vote`, ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    ideaVotes.delete(params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_V1}/whatsapp/link`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json({
      available: true,
      access: whatsappAccess,
      admin: true,
      linked: whatsappLinked,
      phone: whatsappLinked ? '•••• 3374' : null,
      botNumber: '15551773374',
    });
  }),

  http.post(`${API_V1}/whatsapp/link`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    // En los mocks no hay bot: "Ya lo envié" encuentra el número conectado.
    whatsappLinked = true;
    return HttpResponse.json(
      { code: 'FT-AB23CD45', expiresAt: new Date(Date.now() + 600000).toISOString(), botNumber: '15551773374' },
      { status: 201 },
    );
  }),

  http.post(`${API_V1}/whatsapp/link/request`, ({ request }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    whatsappAccess = 'pending';
    return HttpResponse.json({ available: true, access: 'pending', admin: true, linked: false, phone: null, botNumber: '15551773374' });
  }),

  http.get(`${API_V1}/whatsapp/admin`, ({ request }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json({ month: { sent: 742, max: 900 }, users: whatsappRequests });
  }),

  http.patch(`${API_V1}/whatsapp/admin/:userId`, async ({ request, params }) => {
    if (!authUser(request)) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const row = whatsappRequests.find(({ userId }) => userId === params.userId);
    if (!row) return error(404, 'NOT_FOUND', 'Usuario no encontrado');
    row.status = (await readJson(request)).status;
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(`${API_V1}/whatsapp/link`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    whatsappLinked = false;
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(`${API_V1}/notifications`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    if (!inboxes.has(user.id)) {
      inboxes.set(user.id, [
        {
          id: crypto.randomUUID(),
          title: 'Presupuesto de Alimentación',
          body: 'Ya llevas el 85 % de lo que pusiste para este mes.',
          url: '/app/presupuestos',
          read: false,
          createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
        },
      ]);
    }
    const items = inboxes.get(user.id);
    return HttpResponse.json({ items, unread: items.filter((n) => !n.read).length });
  }),
  http.post(`${API_V1}/notifications/read`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    for (const item of inboxes.get(user.id) ?? []) item.read = true;
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_V1}/vacas`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json((vacasByUser.get(user.id) ?? []).map(presentVaca));
  }),

  http.post(`${API_V1}/vacas`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const body = await request.json();
    const vaca = { id: crypto.randomUUID(), name: body.name, description: body.description ?? null, goal: body.goal, deadline: body.deadline ?? null, contributions: [] };
    vacasByUser.set(user.id, [vaca, ...(vacasByUser.get(user.id) ?? [])]);
    return HttpResponse.json(presentVaca(vaca), { status: 201 });
  }),

  http.post(`${API_V1}/vacas/:id/contributions`, async ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const vaca = (vacasByUser.get(user.id) ?? []).find((v) => v.id === params.id);
    if (!vaca) return error(404, 'NOT_FOUND', 'Vaca no encontrada');
    const body = await request.json();
    const contribution = { id: crypto.randomUUID(), amount: body.amount, date: body.date, note: body.note ?? null };
    vaca.contributions.push(contribution);
    return HttpResponse.json(
      { contribution: { ...contribution, userId: user.id, name: 'Tú', isMe: true, createdAt: new Date().toISOString() }, transaction: { id: crypto.randomUUID(), type: 'gasto', amount: body.amount, description: `Ahorro: ${vaca.name}`, category: 'ahorro_inversion', date: body.date, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, vaca: presentVaca(vaca) },
      { status: 201 },
    );
  }),

  http.get(`${API_V1}/cards`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json((cardsByUser.get(user.id) ?? []).map(presentCard));
  }),

  http.get(`${API_V1}/cards/:id`, ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const card = (cardsByUser.get(user.id) ?? []).find((c) => c.id === params.id);
    return card ? HttpResponse.json(presentCard(card)) : error(404, 'NOT_FOUND', 'Tarjeta no encontrada');
  }),

  http.get(`${API_V1}/cards/:id/movements`, () => HttpResponse.json([])),

  http.post(`${API_V1}/cards`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const body = await request.json();
    const card = {
      id: crypto.randomUUID(),
      name: body.name ?? `${body.network} ••${body.last4}`,
      cutoffDay: null,
      expiryMonth: null,
      expiryYear: null,
      expiryNotified: [],
      ...body,
      used: body.limit - body.available,
    };
    delete card.available;
    cardsByUser.set(user.id, [...(cardsByUser.get(user.id) ?? []), card]);
    return HttpResponse.json(presentCard(card), { status: 201 });
  }),

  http.put(`${API_V1}/cards/:id`, async ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const card = (cardsByUser.get(user.id) ?? []).find((c) => c.id === params.id);
    if (!card) return error(404, 'NOT_FOUND', 'Tarjeta no encontrada');
    const body = await request.json();
    if (body.expiryMonth !== card.expiryMonth || body.expiryYear !== card.expiryYear) card.expiryNotified = [];
    Object.assign(card, body);
    return HttpResponse.json(presentCard(card));
  }),

  http.get(`${API_V1}/debts`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const items = (debtsByUser.get(user.id) ?? []).map(presentDebt);
    const totals = { receivable: 0, payable: 0 };
    for (const d of items) if (!d.settledAt) totals[d.kind] += d.pending;
    const sorted = [...items].sort(
      (a, b) =>
        Boolean(a.settledAt) - Boolean(b.settledAt) ||
        (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'),
    );
    return HttpResponse.json({ items: sorted, totals });
  }),

  http.post(`${API_V1}/debts`, async ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const body = await request.json();
    if (!['receivable', 'payable'].includes(body.kind) || !body.person?.trim() || !(body.amount > 0)) {
      return error(422, 'VALIDATION_ERROR', 'Datos inválidos');
    }
    const now = new Date().toISOString();
    const debt = {
      id: crypto.randomUUID(),
      kind: body.kind,
      person: body.person.trim(),
      amount: body.amount,
      dueDate: body.dueDate ?? null,
      loanDate: body.loanDate ?? null,
      installments: body.installments ?? null,
      frequency: body.frequency ?? null,
      firstDueDate: body.installments ? body.dueDate : null,
      payments: [],
      note: body.note ?? null,
      reminder: body.reminder ?? { daysBefore: [1], time: null, channel: 'push' },
      settledAt: null,
      transactionId: null,
      createdAt: now,
      updatedAt: now,
    };
    debtsByUser.set(user.id, [...(debtsByUser.get(user.id) ?? []), debt]);
    return HttpResponse.json(presentDebt(debt), { status: 201 });
  }),

  http.put(`${API_V1}/debts/:id`, async ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const debt = (debtsByUser.get(user.id) ?? []).find((d) => d.id === params.id);
    if (!debt) return error(404, 'NOT_FOUND', 'Cuenta no encontrada');
    if (debt.settledAt) return error(409, 'ALREADY_SETTLED', 'Esta cuenta ya está saldada');
    const body = await request.json();
    Object.assign(debt, body, { updatedAt: new Date().toISOString() });
    if ('installments' in body) debt.firstDueDate = body.installments ? (body.dueDate ?? debt.firstDueDate) : null;
    return HttpResponse.json(presentDebt(debt));
  }),

  http.delete(`${API_V1}/debts/:id`, ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const items = debtsByUser.get(user.id) ?? [];
    if (!items.some((d) => d.id === params.id)) return error(404, 'NOT_FOUND', 'Cuenta no encontrada');
    debtsByUser.set(user.id, items.filter((d) => d.id !== params.id));
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API_V1}/debts/:id/settle`, async ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const debt = (debtsByUser.get(user.id) ?? []).find((d) => d.id === params.id);
    if (!debt) return error(404, 'NOT_FOUND', 'Cuenta no encontrada');
    if (debt.settledAt) return error(409, 'ALREADY_SETTLED', 'Esta cuenta ya está saldada');
    const { createTransaction = true } = (await request.json().catch(() => ({}))) ?? {};
    debt.settledAt = new Date().toISOString();
    debt.transactionId = createTransaction ? crypto.randomUUID() : null;
    return HttpResponse.json({ debt: presentDebt(debt), transaction: createTransaction ? { id: debt.transactionId } : null });
  }),

  http.post(`${API_V1}/debts/:id/payments`, async ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const debt = (debtsByUser.get(user.id) ?? []).find((d) => d.id === params.id);
    if (!debt) return error(404, 'NOT_FOUND', 'Cuenta no encontrada');
    if (debt.settledAt) return error(409, 'ALREADY_SETTLED', 'Esta cuenta ya está saldada');
    const body = await request.json();
    const { pending } = presentDebt(debt);
    if (!(body.amount > 0)) return error(422, 'VALIDATION_ERROR', 'Datos inválidos', [{ field: 'amount', problem: 'Debe ser mayor que 0' }]);
    if (body.amount > pending + 0.004) {
      return error(422, 'VALIDATION_ERROR', 'Datos inválidos', [{ field: 'amount', problem: `No puede pasar de lo pendiente (${pending})` }]);
    }
    const createTransaction = body.createTransaction !== false;
    const payment = {
      id: crypto.randomUUID(),
      amount: body.amount,
      date: body.date ?? new Date().toLocaleDateString('en-CA'),
      transactionId: createTransaction ? crypto.randomUUID() : null,
    };
    debt.payments = [...(debt.payments ?? []), payment];
    if (pending - body.amount < 0.005) debt.settledAt = new Date().toISOString();
    return HttpResponse.json(
      { debt: presentDebt(debt), payment, transaction: payment.transactionId ? { id: payment.transactionId } : null },
      { status: 201 },
    );
  }),

  http.delete(`${API_V1}/debts/:id/payments/:paymentId`, ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const debt = (debtsByUser.get(user.id) ?? []).find((d) => d.id === params.id);
    if (!debt?.payments?.some((p) => p.id === params.paymentId)) return error(404, 'NOT_FOUND', 'Abono no encontrado');
    debt.payments = debt.payments.filter((p) => p.id !== params.paymentId);
    // Como el backend: el movimiento que se anotó con el abono también se borra.
    return HttpResponse.json(presentDebt(debt));
  }),

  http.get(`${API_V1}/pending-payments/token`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json({ enabled: true, token: shortcutTokens.get(user.id) ?? null });
  }),

  http.post(`${API_V1}/pending-payments/token`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const saved = { createdAt: new Date().toISOString(), lastUsedAt: null };
    shortcutTokens.set(user.id, saved);
    return HttpResponse.json({ token: `ftk_${crypto.randomUUID().replaceAll('-', '')}`, ...saved }, { status: 201 });
  }),

  http.delete(`${API_V1}/pending-payments/token`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    shortcutTokens.delete(user.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_V1}/pending-payments`, ({ request }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    return HttpResponse.json({ items: pendingFor(user.id).filter((p) => p.status === 'pending') });
  }),

  http.post(`${API_V1}/pending-payments/:id/confirm`, async ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const payment = pendingFor(user.id).find((p) => p.id === params.id);
    if (!payment) return error(404, 'NOT_FOUND', 'Pago no encontrado');
    if (payment.status !== 'pending') return error(409, 'ALREADY_RESOLVED', 'Este pago ya se confirmó o se descartó');
    const body = (await request.json().catch(() => ({}))) ?? {};
    await delay(400);
    const description = body.description ?? payment.merchant;
    const now = new Date().toISOString();
    const transaction = {
      id: crypto.randomUUID(),
      userId: user.id,
      amount: payment.amount,
      description,
      type: 'gasto',
      date: payment.date,
      ...resolve(body.category, description, 'gasto'),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    transactions.set(user.id, [transaction, ...(transactions.get(user.id) ?? [])]);
    Object.assign(payment, { status: 'confirmed', transactionId: transaction.id });
    return HttpResponse.json({ payment, transaction });
  }),

  http.post(`${API_V1}/pending-payments/:id/discard`, ({ request, params }) => {
    const user = authUser(request);
    if (!user) return error(401, 'UNAUTHORIZED', 'Token inválido o ausente');
    const payment = pendingFor(user.id).find((p) => p.id === params.id);
    if (!payment) return error(404, 'NOT_FOUND', 'Pago no encontrado');
    if (payment.status !== 'pending') return error(409, 'ALREADY_RESOLVED', 'Este pago ya se confirmó o se descartó');
    payment.status = 'discarded';
    return HttpResponse.json(payment);
  }),
];
