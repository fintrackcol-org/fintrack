-- FinTrack — parche 027: categorías propias de cada negocio (FT-0058).
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

-- Además de las 9 de siempre, cada negocio puede crear las suyas. `clave` es lo que se guarda en
-- `negocio_movimientos.categoria` (empieza por "c_"); `nombre` es lo que se ve.
CREATE TABLE IF NOT EXISTS negocio_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  clave VARCHAR(20) NOT NULL,
  nombre VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_negocio_categorias_clave ON negocio_categorias(negocio_id, clave);
CREATE UNIQUE INDEX IF NOT EXISTS ux_negocio_categorias_nombre ON negocio_categorias(negocio_id, lower(nombre));
