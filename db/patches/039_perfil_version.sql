-- Rinde — parche 039: versión del perfil financiero (expectedVersion en las escrituras de Mi plata).
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.
-- Es aditivo: los clientes que no mandan expectedVersion siguen igual. Para revertir basta
-- ALTER TABLE perfiles_financieros DROP COLUMN version.

-- Sube en 1 con cada escritura del perfil (PUT /money-profile, la bienvenida y PUT /money-profile/sources).
-- En PostgreSQL 11+ agregar una columna con DEFAULT constante no reescribe la tabla.
ALTER TABLE perfiles_financieros ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
