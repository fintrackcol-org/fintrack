import { createHash } from 'node:crypto';
import { AppError } from '../errors/app-error.js';
import { t } from '../i18n/index.js';

// Llaves de idempotencia (cabecera `Idempotency-Key`, tabla `idempotency_keys`, parche 038). Las
// usan la bienvenida de Mi plata, los pagos de tarjeta y los abonos de cuentas.

/** Días que se guarda una llave de idempotencia: más que cualquier reintento real de un cliente. */
const KEY_RETENTION_DAYS = 30;

/** @returns {AppError} 409: la llave ya se usó con otros datos (nada se aplicó). */
export const keyReused = () => new AppError(409, 'IDEMPOTENCY_KEY_REUSED', t('Esa llave ya se usó con otros datos.'));

/**
 * Arma lo que se reclama. La huella es de lo pedido (ya validado), no de lo que se termine guardando.
 * @param {string} scope Operación (`money-profile.welcome`, `cards.payment`, `debts.payment`).
 * @param {string|null} key Cabecera `Idempotency-Key`; sin ella no hay nada que reclamar.
 * @param {unknown} data
 * @returns {{ scope: string, key: string, fingerprint: string }|null}
 */
export function buildClaim(scope, key, data) {
  if (!key) return null;
  return { scope, key, fingerprint: createHash('sha256').update(JSON.stringify(data)).digest('hex') };
}

/**
 * Reclama una llave dentro de la transacción de `client`. Si otra petición con la misma llave está
 * en curso, el INSERT espera a que termine (bloqueo de la llave primaria) y luego ve su fila.
 * @param {import('pg').PoolClient} client
 * @param {string} userId
 * @param {{ scope: string, key: string, fingerprint: string }} claim
 * @returns {Promise<'applied'|'replayed'|'reused'>} `'applied'`: la llave es nueva y hay que aplicar.
 */
export async function claimKey(client, userId, { scope, key, fingerprint }) {
  await client.query(
    `DELETE FROM idempotency_keys WHERE usuario_id = $1 AND created_at < now() - make_interval(days => ${KEY_RETENTION_DAYS})`,
    [userId],
  );
  const inserted = await client.query(
    `INSERT INTO idempotency_keys (usuario_id, scope, clave, huella) VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING RETURNING 1`,
    [userId, scope, key, fingerprint],
  );
  if (inserted.rowCount > 0) return 'applied';
  const { rows } = await client.query(
    'SELECT huella FROM idempotency_keys WHERE usuario_id = $1 AND scope = $2 AND clave = $3',
    [userId, scope, key],
  );
  return rows[0]?.huella === fingerprint ? 'replayed' : 'reused';
}
