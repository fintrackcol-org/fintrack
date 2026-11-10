-- FinTrack — parche 028: rastro de cada corrección de saldo (FT-0062).
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

-- Va en su propia tabla y no en `transacciones`: así ningún reporte ni presupuesto lo cuenta
-- como ingreso o gasto. El historial lo muestra como "Ajuste de saldo".
CREATE TABLE IF NOT EXISTS ajustes_saldo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  saldo_antes NUMERIC(12,2) NOT NULL,
  saldo_despues NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ajustes_saldo_usuario ON ajustes_saldo(usuario_id, created_at DESC);
