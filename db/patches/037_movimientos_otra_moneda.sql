-- Rinde — parche 037: movimientos anotados en otra moneda (al viajar) y tasas de cambio.
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

-- `monto` sigue siempre en la moneda principal del usuario: totales, presupuestos y reportes no
-- cambian. Si se anotó en otra moneda, queda también lo que se pagó allá y la tasa usada
-- (monto = monto_original × tasa). Los tres van juntos o ninguno.
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS moneda_original CHAR(3) NULL;
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS monto_original NUMERIC(14,2) NULL;
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS tasa NUMERIC(20,10) NULL;
ALTER TABLE transacciones DROP CONSTRAINT IF EXISTS transacciones_moneda_original_check;
ALTER TABLE transacciones ADD CONSTRAINT transacciones_moneda_original_check CHECK (
  (moneda_original IS NULL AND monto_original IS NULL AND tasa IS NULL)
  OR (moneda_original IS NOT NULL AND monto_original > 0 AND tasa > 0));

-- Tasas de Frankfurter (api.frankfurter.dev), una vez por día y par de monedas, compartidas por
-- todos: la API se consulta muy poco y la app sigue andando si un día no responde.
-- 1 `base` = `tasa` `moneda` en esa `fecha`.
CREATE TABLE IF NOT EXISTS tasas_cambio (
  fecha DATE NOT NULL,
  base CHAR(3) NOT NULL,
  moneda CHAR(3) NOT NULL,
  tasa NUMERIC(20,10) NOT NULL CHECK (tasa > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (fecha, base, moneda)
);
