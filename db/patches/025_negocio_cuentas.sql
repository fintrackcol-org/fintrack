-- FinTrack — parche 025: cuentas por cobrar (clientes) y por pagar (proveedores) de los negocios,
-- con abonos parciales (FT-0058).
-- Para bases ya creadas (Supabase y volúmenes locales existentes); las nuevas lo toman de db/init.
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- El backend lo aplica solo al arrancar (backend/src/config/migrations.js); no hace falta correrlo a mano.

-- Lo que un cliente le debe al negocio (`cobrar`) o lo que el negocio le debe a un proveedor
-- (`pagar`). El saldo es `monto` menos la suma de sus abonos; está pagada cuando llega a 0.
CREATE TABLE IF NOT EXISTS negocio_cuentas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL, -- quién la registró
  tipo VARCHAR(6) NOT NULL CHECK (tipo IN ('cobrar', 'pagar')),
  tercero VARCHAR(80) NOT NULL,
  descripcion VARCHAR(120) NULL,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  vence DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_negocio_cuentas_negocio ON negocio_cuentas(negocio_id, vence);

-- Cada abono crea el movimiento del negocio que le corresponde (un cobro entra como venta u otro
-- ingreso; un pago, como el gasto que se elija). Si se borra ese movimiento, se borra el abono.
CREATE TABLE IF NOT EXISTS negocio_abonos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id UUID NOT NULL REFERENCES negocio_cuentas(id) ON DELETE CASCADE,
  usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  fecha DATE NOT NULL,
  movimiento_id UUID NOT NULL REFERENCES negocio_movimientos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_negocio_abonos_cuenta ON negocio_abonos(cuenta_id, fecha);
