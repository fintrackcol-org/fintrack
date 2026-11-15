-- Rinde — parche 033: reconocer en WhatsApp a quien llega sin número.
-- Desde 2026, Meta omite el número de quien adopta nombre de usuario en WhatsApp y solo manda su
-- BSUID (identificador por negocio). Sin esta columna el bot ignoraba esos mensajes.
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

ALTER TABLE whatsapp_vinculos ADD COLUMN IF NOT EXISTS wa_usuario VARCHAR(100) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_vinculos_wa_usuario ON whatsapp_vinculos(wa_usuario);
