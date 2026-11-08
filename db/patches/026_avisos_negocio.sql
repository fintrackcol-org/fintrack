-- FinTrack — parche 026: avisos del negocio (FT-0058).
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

-- Cuentas por cobrar y por pagar: se avisa un día antes de que venzan y una vez cuando ya vencieron.
ALTER TABLE negocio_cuentas ADD COLUMN IF NOT EXISTS aviso_previo_at TIMESTAMPTZ NULL;
ALTER TABLE negocio_cuentas ADD COLUMN IF NOT EXISTS aviso_vencida_at TIMESTAMPTZ NULL;

-- Fechas de impuestos de cada negocio (IVA, retención en la fuente, ICA…): se avisa 3 días antes.
CREATE TABLE IF NOT EXISTS negocio_fechas_impuesto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre VARCHAR(40) NOT NULL,
  fecha DATE NOT NULL,
  avisada_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_negocio_fechas_impuesto ON negocio_fechas_impuesto(negocio_id, fecha);
