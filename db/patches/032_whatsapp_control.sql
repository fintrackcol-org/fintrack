-- Rinde — parche 032: control del bot de WhatsApp. Acceso aprobado por el equipo y conteo de
-- respuestas enviadas, que son las que Meta cobra.
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

-- Una fila por usuario que pidió usar el bot. Sin fila, no lo ha pedido.
CREATE TABLE IF NOT EXISTS whatsapp_accesos (
  usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  estado VARCHAR(10) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  solicitado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resuelto_at TIMESTAMPTZ NULL
);

-- Quien ya tenía su número conectado conserva el acceso.
INSERT INTO whatsapp_accesos (usuario_id, estado, resuelto_at)
SELECT usuario_id, 'aprobado', now() FROM whatsapp_vinculos WHERE telefono IS NOT NULL
ON CONFLICT (usuario_id) DO NOTHING;

-- Una fila por respuesta enviada. Del número solo se guarda el hash; `usuario_id` es NULL cuando
-- se le respondió a un número sin conectar.
CREATE TABLE IF NOT EXISTS whatsapp_envios (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  telefono_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_envios_fecha ON whatsapp_envios(created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_envios_telefono ON whatsapp_envios(telefono_hash, created_at);
