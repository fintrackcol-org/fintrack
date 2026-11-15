-- FinTrack — parche 033: abonos y cuotas en las cuentas con personas (FT-0064) y vencimiento del
-- plástico de las tarjetas (FT-0065).
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

-- FT-0064: cuándo se prestó y, si se paga a cuotas, cuántas y cada cuánto. Sin cuotas es "fecha
-- fija" (como antes): fecha_limite es el día del pago. Con cuotas, primera_cuota fija el calendario
-- y fecha_limite se mueve a la próxima cuota pendiente, así el motor de avisos (FT-0063) avisa cada una.
-- Las cuentas que ya existían quedan sin fecha del préstamo y se pueden editar.
ALTER TABLE cuentas_personales ADD COLUMN IF NOT EXISTS fecha_prestamo DATE NULL;
ALTER TABLE cuentas_personales ADD COLUMN IF NOT EXISTS cuotas SMALLINT NULL;
ALTER TABLE cuentas_personales ADD COLUMN IF NOT EXISTS frecuencia VARCHAR(10) NULL;
ALTER TABLE cuentas_personales ADD COLUMN IF NOT EXISTS primera_cuota DATE NULL;
ALTER TABLE cuentas_personales DROP CONSTRAINT IF EXISTS cuentas_personales_cuotas_check;
ALTER TABLE cuentas_personales ADD CONSTRAINT cuentas_personales_cuotas_check CHECK (
  (cuotas IS NULL AND frecuencia IS NULL AND primera_cuota IS NULL)
  OR (cuotas BETWEEN 2 AND 60 AND frecuencia IN ('semanal', 'quincenal', 'mensual') AND primera_cuota IS NOT NULL));

-- Cada abono: cuánto y cuándo, en las dos direcciones (lo que me pagan o lo que pago). Si al
-- registrarlo se creó el ingreso o el gasto, queda enlazado.
CREATE TABLE IF NOT EXISTS abonos_cuenta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id UUID NOT NULL REFERENCES cuentas_personales(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  fecha DATE NOT NULL,
  transaccion_id UUID NULL REFERENCES transacciones(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_abonos_cuenta_cuenta ON abonos_cuenta(cuenta_id, fecha);

-- FT-0065: mes y año en que vence el plástico (MM/AA). Cambia la decisión del parche 014: se
-- guarda solo el vencimiento, nunca el número completo ni el CVV. aviso_vencimiento_enviado (los días de anticipación ya avisados) evita
-- repetir el aviso de 60 y de 30 días.
ALTER TABLE tarjetas ADD COLUMN IF NOT EXISTS vence_mes SMALLINT NULL;
ALTER TABLE tarjetas ADD COLUMN IF NOT EXISTS vence_anio SMALLINT NULL;
ALTER TABLE tarjetas ADD COLUMN IF NOT EXISTS aviso_vencimiento_enviado SMALLINT[] NOT NULL DEFAULT '{}';
ALTER TABLE tarjetas DROP CONSTRAINT IF EXISTS tarjetas_vencimiento_check;
ALTER TABLE tarjetas ADD CONSTRAINT tarjetas_vencimiento_check CHECK (
  (vence_mes IS NULL AND vence_anio IS NULL)
  OR (vence_mes BETWEEN 1 AND 12 AND vence_anio BETWEEN 2000 AND 2099));
