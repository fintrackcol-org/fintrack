-- FinTrack — parche 035: tutorial de primera vez (FT-0071).
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

-- Cuándo terminó u omitió el tutorial: se guarda en el servidor para que no vuelva a salir en otro
-- dispositivo. Repetirlo desde Cuenta no lo borra.
ALTER TABLE perfiles_financieros ADD COLUMN IF NOT EXISTS tutorial_at TIMESTAMPTZ NULL;
