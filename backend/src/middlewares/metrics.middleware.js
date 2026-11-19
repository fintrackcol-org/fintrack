import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import client from 'prom-client';
import { env } from '../config/env.js';

/**
 * Métricas para Grafana (FT-0074), en el formato de Prometheus.
 *
 * - `metricsMiddleware` mide cada petición: cuánto tardó, con qué método, ruta y código.
 * - `GET /metrics` las entrega solo con `Authorization: Bearer <METRICS_TOKEN>`. Sin `METRICS_TOKEN`
 *   la ruta no existe (404): así nadie ve las métricas si no se configuró el token.
 *
 * La ruta se guarda como el patrón de Express (`/api/v1/transactions/:id`), nunca con ids reales:
 * eso mantiene pocas series en Grafana y no deja datos de usuarios en las métricas.
 */

export const registry = new client.Registry();
registry.setDefaultLabels({ service: 'rinde-api', env: env.nodeEnv });
// Memoria, CPU, retraso del event loop, etc. del proceso de Node.
client.collectDefaultMetrics({ register: registry });

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duración de las peticiones HTTP, por método, ruta y código',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

/**
 * Patrón de la ruta que atendió la petición, o `sin_ruta` si no hubo (404, archivos, bots).
 * @param {import('express').Request} req
 * @returns {string}
 */
function routeOf(req) {
  if (!req.route) return 'sin_ruta';
  const path = Array.isArray(req.route.path) ? req.route.path[0] : req.route.path;
  return `${req.baseUrl}${path}` || '/';
}

/** @type {import('express').RequestHandler} */
export function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics') return next();
  const end = httpDuration.startTimer({ method: req.method });
  res.on('finish', () => end({ route: routeOf(req), status: String(res.statusCode) }));
  next();
}

/**
 * ¿El encabezado trae el token correcto? Compara en tiempo constante.
 * @param {string|undefined} header
 * @returns {boolean}
 */
function hasToken(header) {
  const expected = Buffer.from(`Bearer ${env.metricsToken}`);
  const given = Buffer.from(header || '');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const metricsRouter = Router();

metricsRouter.get('/metrics', async (req, res, next) => {
  if (!env.metricsToken) return next(); // sin token configurado: 404
  if (!hasToken(req.get('authorization'))) {
    return res
      .status(401)
      .json({ error: { code: 'UNAUTHORIZED', message: 'Token de métricas inválido' } });
  }
  res.set('Content-Type', registry.contentType);
  res.send(await registry.metrics());
});
