import { AppError } from '../errors/app-error.js';
import { MAX_DAYS, getLiquidity as project } from '../services/liquidity.service.js';

/**
 * `GET /api/v1/liquidity?days=45`: plata día por día, cuándo y cuánto faltaría y cuánto puede
 * gastar al día para llegar (FT-0059). `days` entre 1 y 90.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getLiquidity(req, res) {
  let days;
  if (req.query.days !== undefined) {
    days = Number(req.query.days);
    if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
        { field: 'days', problem: `Debe ser un entero entre 1 y ${MAX_DAYS}` },
      ]);
    }
  }
  res.json(await project(req.userId, days));
}
