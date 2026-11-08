import * as accounts from '../services/negocio-accounts.service.js';
import { parseNewAccount, parsePayment, parseTaxDate } from '../validators/negocio-accounts.validator.js';

// Cuentas por cobrar y por pagar del negocio, con abonos (FT-0058).

/**
 * `GET /api/v1/businesses/:id/accounts`: cuentas, saldos y totales.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getAccounts(req, res) {
  res.json(await accounts.list(req.userId, req.params.id));
}

/**
 * `POST /api/v1/businesses/:id/accounts`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postAccount(req, res) {
  res.status(201).json(await accounts.create(req.userId, req.params.id, parseNewAccount(req.body)));
}

/**
 * `DELETE /api/v1/businesses/:id/accounts/:accountId`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteAccount(req, res) {
  await accounts.remove(req.userId, req.params.id, req.params.accountId);
  res.status(204).end();
}

/**
 * `POST /api/v1/businesses/:id/accounts/:accountId/payments`: abono; devuelve la cuenta.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postPayment(req, res) {
  res
    .status(201)
    .json(await accounts.pay(req.userId, req.params.id, req.params.accountId, parsePayment(req.body)));
}

/**
 * `DELETE /api/v1/businesses/:id/accounts/:accountId/payments/:paymentId`: devuelve la cuenta.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deletePayment(req, res) {
  res.json(
    await accounts.removePayment(req.userId, req.params.id, req.params.accountId, req.params.paymentId),
  );
}

/**
 * `GET /api/v1/businesses/:id/tax-dates`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getTaxDates(req, res) {
  res.json(await accounts.listTaxDates(req.userId, req.params.id));
}

/**
 * `POST /api/v1/businesses/:id/tax-dates`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postTaxDate(req, res) {
  res.status(201).json(await accounts.addTaxDate(req.userId, req.params.id, parseTaxDate(req.body)));
}

/**
 * `DELETE /api/v1/businesses/:id/tax-dates/:dateId`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteTaxDate(req, res) {
  await accounts.removeTaxDate(req.userId, req.params.id, req.params.dateId);
  res.status(204).end();
}
