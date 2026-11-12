-- FinTrack — parche 030: suscripciones dentro de los compromisos de Mi plata (FT-0067).
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

-- Un compromiso es un pago fijo (arriendo, internet) o una suscripción (Netflix, Spotify), mensual o
-- anual. Los anuales se cobran en `mes` (1 a 12) el día `dia_mes`. Los que ya existen quedan como
-- pagos fijos mensuales: no cambia nada para nadie.
ALTER TABLE compromisos ADD COLUMN IF NOT EXISTS tipo VARCHAR(12) NOT NULL DEFAULT 'pago_fijo';
ALTER TABLE compromisos ADD COLUMN IF NOT EXISTS frecuencia VARCHAR(8) NOT NULL DEFAULT 'mensual';
ALTER TABLE compromisos ADD COLUMN IF NOT EXISTS mes SMALLINT NULL;
ALTER TABLE compromisos DROP CONSTRAINT IF EXISTS compromisos_tipo_check;
ALTER TABLE compromisos ADD CONSTRAINT compromisos_tipo_check CHECK (tipo IN ('pago_fijo', 'suscripcion'));
ALTER TABLE compromisos DROP CONSTRAINT IF EXISTS compromisos_frecuencia_check;
ALTER TABLE compromisos ADD CONSTRAINT compromisos_frecuencia_check
  CHECK ((frecuencia = 'mensual' AND mes IS NULL) OR (frecuencia = 'anual' AND mes BETWEEN 1 AND 12));
