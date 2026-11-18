-- Rinde — parche 036: país, moneda principal e idioma de cada usuario.
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

-- pais: donde está la persona ahora (ISO 3166, "CO"); cambia si viaja.
-- moneda: moneda principal de la cuenta (ISO 4217, "COP"); en ella van todos los montos y totales.
-- idioma: idioma de la app ("es", "en", "pt", "zh"); se cambia aparte, no al viajar.
-- Las cuentas que ya existen son de Colombia, en pesos y en español.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pais CHAR(2) NOT NULL DEFAULT 'CO';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS moneda CHAR(3) NOT NULL DEFAULT 'COP';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS idioma VARCHAR(5) NOT NULL DEFAULT 'es';
