-- FinTrack — parche 024: último aviso del motor de liquidez (FT-0059).
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

-- El motor avisa 7, 3 y 1 día antes de que falte la plata. Para no repetir el mismo aviso se guarda
-- de qué hueco se avisó (fecha), a cuántos días y cuánto faltaba.
ALTER TABLE perfiles_financieros ADD COLUMN IF NOT EXISTS aviso_liquidez_fecha DATE NULL;
ALTER TABLE perfiles_financieros ADD COLUMN IF NOT EXISTS aviso_liquidez_dias SMALLINT NULL;
ALTER TABLE perfiles_financieros ADD COLUMN IF NOT EXISTS aviso_liquidez_monto NUMERIC(12,2) NULL;
