-- Rinde — parche 038: llaves de idempotencia (cabecera Idempotency-Key) de POST /money-profile/welcome.
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.
-- Es aditivo: para revertir basta DROP TABLE idempotency_keys (ver docs/idempotencia-bienvenida.md).

-- Una fila por llave ya aplicada. huella = sha256 (hex) del cuerpo validado: la misma llave con
-- otros datos se rechaza. Se borran a los 30 días, al reclamar una llave nueva del mismo usuario.
CREATE TABLE IF NOT EXISTS idempotency_keys (
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  scope VARCHAR(64) NOT NULL,
  clave VARCHAR(128) NOT NULL,
  huella CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, scope, clave)
);
