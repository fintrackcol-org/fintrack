-- FinTrack — parche 023: fuentes de ingreso (FT-0060). Cómo y cuánto le entra la plata a cada usuario.
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.
--
-- Cada fila es una forma en que le entra plata: sueldo, comisiones, proyectos, trabajo por días o
-- mesada. Los montos son los que el usuario dijo, aproximados ("más o menos" está bien). Se borran
-- con la cuenta (ON DELETE CASCADE). `transacciones.fuente_id` dice de qué fuente vino un ingreso.

CREATE TABLE IF NOT EXISTS fuentes_ingreso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre VARCHAR(60) NOT NULL,
  tipo VARCHAR(12) NOT NULL CHECK (tipo IN ('sueldo','comisiones','proyectos','diario','mesada')),
  frecuencia VARCHAR(10) NOT NULL CHECK (frecuencia IN ('mensual','quincenal','semanal','diario','irregular')),
  dias_pago SMALLINT[] NOT NULL DEFAULT '{}',
  monto_dicho NUMERIC(12,2) NULL CHECK (monto_dicho IS NULL OR monto_dicho >= 0),
  monto_bajo NUMERIC(12,2) NULL CHECK (monto_bajo IS NULL OR monto_bajo >= 0),
  monto_alto NUMERIC(12,2) NULL CHECK (monto_alto IS NULL OR monto_alto >= 0),
  montos_meses NUMERIC(12,2)[] NOT NULL DEFAULT '{}',
  dias_semana SMALLINT NULL CHECK (dias_semana IS NULL OR dias_semana BETWEEN 1 AND 7),
  es_fijo BOOLEAN NOT NULL DEFAULT false,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fuentes_ingreso_usuario ON fuentes_ingreso(usuario_id) WHERE activo;
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS fuente_id UUID NULL
  REFERENCES fuentes_ingreso(id) ON DELETE SET NULL;
