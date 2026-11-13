-- FinTrack — parche 031: emociones y Kakeibo en los gastos (FT-0070).
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

-- Cómo se sintió la persona con un gasto y en qué grupo Kakeibo lo pone. Ambas son opcionales y
-- solo aplican a gastos: un ingreso siempre las tiene en NULL.
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS emocion VARCHAR(16) NULL;
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS kakeibo VARCHAR(10) NULL;
ALTER TABLE transacciones DROP CONSTRAINT IF EXISTS transacciones_emocion_check;
ALTER TABLE transacciones ADD CONSTRAINT transacciones_emocion_check
  CHECK (emocion IN ('valio_la_pena', 'normal', 'no_lo_necesitaba', 'me_arrepiento'));
ALTER TABLE transacciones DROP CONSTRAINT IF EXISTS transacciones_kakeibo_check;
ALTER TABLE transacciones ADD CONSTRAINT transacciones_kakeibo_check
  CHECK (kakeibo IN ('necesidad', 'deseo', 'cultura', 'imprevisto'));
ALTER TABLE transacciones DROP CONSTRAINT IF EXISTS transacciones_reflexion_solo_gasto;
ALTER TABLE transacciones ADD CONSTRAINT transacciones_reflexion_solo_gasto
  CHECK (tipo = 'gasto' OR (emocion IS NULL AND kakeibo IS NULL));
