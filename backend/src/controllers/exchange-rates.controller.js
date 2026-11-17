import { AppError } from '../errors/app-error.js';
import { exchangeRateService } from '../services/exchange-rates.service.js';
import { isValidDate } from '../validators/transactions.validator.js';

const CURRENCIES = new Set(Intl.supportedValuesOf('currency'));

/**
 * `GET /api/v1/exchange-rates?from=MXN&to=COP&date=2026-11-17`: cuánto vale 1 `from` en `to` ese día.
 * `date` es opcional (hoy, en UTC). Para anotar un gasto hecho en otra moneda al viajar.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getExchangeRate(req, res) {
  const { from, to } = req.query;
  const date = req.query.date ?? new Date().toISOString().slice(0, 10);
  const details = [];
  if (!CURRENCIES.has(from)) details.push({ field: 'from', problem: 'Debe ser un código de moneda como "MXN"' });
  if (!CURRENCIES.has(to)) details.push({ field: 'to', problem: 'Debe ser un código de moneda como "COP"' });
  if (!isValidDate(date)) details.push({ field: 'date', problem: 'Debe ser una fecha válida AAAA-MM-DD' });
  if (details.length) throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', details);
  res.json(await exchangeRateService.getRate({ from, to, date }));
}
