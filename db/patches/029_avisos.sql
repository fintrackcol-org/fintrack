-- FinTrack — parche 029: motor de recordatorios configurables (FT-0063).
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

-- Cómo quiere el usuario que le avisen de algo con fecha (una cuenta, una tarjeta, una suscripción…).
-- `origen_tipo` + `origen_id` dicen de qué es; sin fila se usa lo de siempre: un día antes, por notificación.
CREATE TABLE IF NOT EXISTS avisos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  origen_tipo VARCHAR(20) NOT NULL,
  origen_id UUID NOT NULL,
  dias_antes SMALLINT[] NOT NULL DEFAULT '{1}', -- 0 = el mismo día; vacío = no avisar
  hora TIME NULL, -- NULL = la primera hora de Notificaciones del usuario (o 09:00)
  canal VARCHAR(10) NOT NULL DEFAULT 'push' CHECK (canal IN ('push', 'whatsapp', 'both')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (origen_tipo, origen_id)
);

-- Un aviso sale una sola vez por fecha de vencimiento y por anticipación: la fila es la marca.
CREATE TABLE IF NOT EXISTS avisos_enviados (
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  origen_tipo VARCHAR(20) NOT NULL,
  origen_id UUID NOT NULL,
  fecha_vence DATE NOT NULL,
  dias_antes SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (origen_tipo, origen_id, fecha_vence, dias_antes)
);
