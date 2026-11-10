import { getPlan as buildPlan } from '../services/money-plan.service.js';
import { getCalendar as buildCalendar } from '../services/payment-calendar.service.js';
import * as moneyProfile from '../services/money-profile.service.js';
import { parseMonthQuery } from '../validators/budgets.validator.js';
import * as income from '../services/income.service.js';
import { AppError } from '../errors/app-error.js';
import { isValidDate } from '../validators/transactions.validator.js';
import { parseCommitment, parseProfile, parseSources, parseSplitQuery, parseWelcome } from '../validators/money-profile.validator.js';

/**
 * `GET /api/v1/money-profile`: perfil del usuario con sus compromisos.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getProfile(req, res) {
  res.json(await moneyProfile.get(req.userId));
}

/**
 * `GET /api/v1/money-profile/plan`: cuánto puede gastar o necesita ganar el usuario hoy.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getPlan(req, res) {
  res.json(await buildPlan(req.userId));
}

/**
 * `GET /api/v1/money-profile/calendar?month=AAAA-MM`: pagos del mes y cuánto le queda al usuario
 * después de cada uno (FT-0025). Sin `month`, el actual.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getCalendar(req, res) {
  res.json(await buildCalendar(req.userId, parseMonthQuery(req.query)));
}

/**
 * `PUT /api/v1/money-profile`: cambia cómo le entra la plata y cuánta tiene.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function putProfile(req, res) {
  res.json(await moneyProfile.update(req.userId, parseProfile(req.body)));
}

/**
 * `GET /api/v1/money-profile/adjustments?from=&to=`: correcciones de saldo, para el historial (FT-0062).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getAdjustments(req, res) {
  const { from, to } = req.query;
  const details = ['from', 'to']
    .filter((field) => req.query[field] !== undefined && !isValidDate(req.query[field]))
    .map((field) => ({ field, problem: 'Debe ser una fecha AAAA-MM-DD' }));
  if (details.length > 0) throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', details);
  res.json({ data: await moneyProfile.listAdjustments(req.userId, { from, to }) });
}

/**
 * `POST /api/v1/money-profile/welcome`: guarda la bienvenida; sin datos, la marca como omitida.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postWelcome(req, res) {
  res.json(await moneyProfile.finishWelcome(req.userId, parseWelcome(req.body)));
}

/**
 * `POST /api/v1/money-profile/commitments`: crea un compromiso y responde 201.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postCommitment(req, res) {
  res.status(201).json(await moneyProfile.createCommitment(req.userId, parseCommitment(req.body)));
}

/**
 * `PUT /api/v1/money-profile/commitments/:id`: cambia un compromiso.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function putCommitment(req, res) {
  res.json(await moneyProfile.updateCommitment(req.userId, req.params.id, parseCommitment(req.body)));
}

/**
 * `DELETE /api/v1/money-profile/commitments/:id`: elimina un compromiso y responde 204.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteCommitment(req, res) {
  await moneyProfile.removeCommitment(req.userId, req.params.id);
  res.status(204).end();
}

/**
 * `GET /api/v1/money-profile/income`: cómo y cuánto le entra la plata al usuario (FT-0060).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getIncome(req, res) {
  res.json(await income.getIncome(req.userId));
}

/**
 * `GET /api/v1/money-profile/income/split?amount=`: cómo repartir un ingreso (FT-0060).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getSplit(req, res) {
  res.json(await income.split(req.userId, parseSplitQuery(req.query)));
}

/**
 * `PUT /api/v1/money-profile/sources`: reemplaza las fuentes de ingreso (FT-0060).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function putSources(req, res) {
  res.json(await income.saveSources(req.userId, parseSources(req.body)));
}
