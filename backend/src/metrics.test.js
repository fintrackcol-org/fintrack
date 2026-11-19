import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import express from 'express';
import { metricsMiddleware, metricsRouter } from './middlewares/metrics.middleware.js';

// Métricas para Grafana (FT-0074).

after(() => pool.end());

async function withServer(fn) {
  const server = createApp().listen(0);
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

test('sin METRICS_TOKEN la ruta /metrics no existe', async () => {
  const saved = env.metricsToken;
  env.metricsToken = undefined;
  try {
    await withServer(async (base) => {
      assert.equal((await fetch(`${base}/metrics`)).status, 404);
    });
  } finally {
    env.metricsToken = saved;
  }
});

test('con METRICS_TOKEN pide el token y mide las peticiones por patrón de ruta', async () => {
  const saved = env.metricsToken;
  env.metricsToken = 'token-de-prueba-metricas';
  try {
    await withServer(async (base) => {
      assert.equal((await fetch(`${base}/metrics`)).status, 401);
      assert.equal(
        (await fetch(`${base}/metrics`, { headers: { Authorization: 'Bearer otro' } })).status,
        401,
      );

      await fetch(`${base}/health`);
      // Sin sesión el router no llega a la ruta: queda como "sin_ruta", nunca con el id.
      await fetch(`${base}/api/v1/transactions/123e4567-e89b-12d3-a456-426614174000`);
      await fetch(`${base}/no-existe`);

      const res = await fetch(`${base}/metrics`, {
        headers: { Authorization: 'Bearer token-de-prueba-metricas' },
      });
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/plain/);
      const text = await res.text();
      // /health responde 200 o 503 según la base; lo que importa es que quede su patrón de ruta.
      assert.match(text, /http_request_duration_seconds_count\{[^}]*route="\/health"/);
      assert.match(text, /route="sin_ruta"[^}]*status="404"/);
      assert.match(text, /process_resident_memory_bytes/);
      // Nunca ids reales en las métricas.
      assert.doesNotMatch(text, /123e4567/);
    });
  } finally {
    env.metricsToken = saved;
  }
});

test('guarda el patrón de la ruta (con :id), no la dirección real', async () => {
  const saved = env.metricsToken;
  env.metricsToken = 'token-de-prueba-metricas';
  const app = express();
  app.use(metricsMiddleware);
  app.use(metricsRouter);
  const router = express.Router();
  router.get('/:id', (_req, res) => res.json({ ok: true }));
  app.use('/api/v1/prueba-metricas', router);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fetch(`${base}/api/v1/prueba-metricas/9f1c2d3e-0000-4000-8000-000000000001`);
    const text = await (
      await fetch(`${base}/metrics`, {
        headers: { Authorization: 'Bearer token-de-prueba-metricas' },
      })
    ).text();
    assert.match(text, /route="\/api\/v1\/prueba-metricas\/:id",status="200"/);
    assert.doesNotMatch(text, /9f1c2d3e/);
  } finally {
    server.close();
    env.metricsToken = saved;
  }
});
