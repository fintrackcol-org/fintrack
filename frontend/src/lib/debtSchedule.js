// Cuotas y avance de una cuenta con abonos (FT-0064). Copia de backend/src/services/debt-schedule.js:
// el formulario la usa para mostrar las cuotas antes de guardar y los mocks para responder igual.

const cents = (n) => Math.round(n * 100) / 100;

/**
 * Suma `k` periodos a una fecha. Quincenal son 15 días, como se paga en Colombia; mensual es el
 * mismo día del mes siguiente, o el último día si ese mes es más corto (31 de enero → 28 de febrero).
 * @param {string} date AAAA-MM-DD
 * @param {'weekly'|'biweekly'|'monthly'} frequency
 * @param {number} k
 * @returns {string} AAAA-MM-DD
 */
export function addPeriods(date, frequency, k) {
  const [y, m, d] = date.split('-').map(Number);
  if (frequency === 'monthly') {
    const target = new Date(Date.UTC(y, m - 1 + k, 1));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(d, last));
    return target.toISOString().slice(0, 10);
  }
  const days = frequency === 'weekly' ? 7 : 15;
  return new Date(Date.UTC(y, m - 1, d + days * k)).toISOString().slice(0, 10);
}

/**
 * Las cuotas de una cuenta: el monto se reparte en partes iguales y la última absorbe los centavos.
 * @param {{ amount: number, installments: number, frequency: string, firstDueDate: string }} plan
 * @returns {{ number: number, date: string, amount: number }[]}
 */
export function schedule({ amount, installments, frequency, firstDueDate }) {
  const each = Math.floor((amount / installments) * 100) / 100;
  return Array.from({ length: installments }, (_, i) => ({
    number: i + 1,
    date: addPeriods(firstDueDate, frequency, i),
    amount: i === installments - 1 ? cents(amount - each * (installments - 1)) : each,
  }));
}

/**
 * Cuánto se ha pagado, cuánto falta y cuál es la próxima cuota. Los abonos se aplican en orden:
 * primero cubren la cuota 1, luego la 2… Un abono parcial deja la cuota "en curso" con lo que falta.
 * @param {{ amount: number, installments?: number|null, frequency?: string|null, firstDueDate?: string|null, dueDate?: string|null }} debt
 * @param {number} paid Suma de los abonos.
 * @returns {{ paid: number, pending: number, paidInstallments: number, next: { number: number, date: string, amount: number }|null }}
 */
export function progress(debt, paid) {
  const total = cents(paid);
  const pending = Math.max(0, cents(debt.amount - total));
  if (!debt.installments) {
    return {
      paid: total,
      pending,
      paidInstallments: 0,
      next: pending > 0 && debt.dueDate ? { number: 1, date: debt.dueDate, amount: pending } : null,
    };
  }
  let left = total;
  let paidInstallments = 0;
  let next = null;
  for (const cuota of schedule({ ...debt, installments: debt.installments })) {
    if (left >= cuota.amount - 0.004) {
      left = cents(left - cuota.amount);
      paidInstallments += 1;
      continue;
    }
    next = { ...cuota, amount: cents(cuota.amount - left) };
    break;
  }
  return { paid: total, pending, paidInstallments, next };
}
