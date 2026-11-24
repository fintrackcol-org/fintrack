# Idempotencia de `POST /api/v1/money-profile/welcome`

Para la app móvil (Rinde Mobile, etapa 3). La web (PWA) no cambia: no manda la cabecera.

## Contrato

| Qué | Detalle |
| --- | --- |
| Cabecera de entrada | `Idempotency-Key` (nombre del borrador IETF). **Opcional.** |
| Formato | 8 a 128 caracteres de `[A-Za-z0-9._:-]`. Recomendado: un UUID v4 por intento lógico (p. ej. `welcome-<uuid>`). |
| Llave mal formada | `400 VALIDATION_ERROR`, `details[0].field = "Idempotency-Key"`, mensaje traducido. No se aplica nada. |
| Primera vez | Se aplica la bienvenida y se responde `200` con el perfil (`MoneyProfile`). |
| Misma llave, mismos datos | No se aplica nada otra vez. `200` con el perfil y la cabecera `Idempotent-Replayed: true`. |
| Misma llave, otros datos | `409 IDEMPOTENCY_KEY_REUSED` («Esa llave ya se usó con otros datos.»). No se aplica nada. |
| Sin la cabecera | Exactamente como antes. |
| Token vencido | `401 TOKEN_EXPIRED` antes de mirar la llave (`requireAuth` va primero): no se reclama nada. |

"Mismos datos" = mismo cuerpo **después de validarlo** (sha256 del JSON validado: días de pago
ordenados, nombres sin espacios sobrantes, montos redondeados). Dos cuerpos que se escriben distinto
pero significan lo mismo cuentan como iguales.

**El cuerpo de una repetición es el perfil ACTUAL**, no una copia guardada de la primera respuesta:
refleja la primera operación terminada más todo lo que se haya aplicado después (por ejemplo, un
`PUT /money-profile` posterior). Es lo que el cliente necesita para quedar al día y evita guardar
montos en la tabla de llaves.

## Garantías

- **Atómica.** La llave se reclama dentro de la misma transacción que guarda el perfil y los
  compromisos (`saveWelcome` en `backend/src/repositories/money-profile.repository.js`). Si algo
  falla a mitad de camino se deshace todo, la llave incluida, y el reintento corre normal.
- **Concurrente.** Dos o más peticiones con la misma llave a la vez: el `INSERT` de la segunda espera
  el bloqueo de la llave primaria; cuando la primera confirma, la segunda ve la fila y responde como
  repetición. Probado con 5 peticiones simultáneas: se aplica una sola.
- **Sin estado en memoria.** Todo vive en la tabla `idempotency_keys`; sobrevive reinicios y varias
  instancias del backend (probado con otro proceso de Node y otro pool).
- **Por usuario.** La llave primaria es `(usuario_id, scope, clave)`: la misma llave de dos usuarios
  no choca. `scope = 'money-profile.welcome'` deja la tabla lista para otros endpoints sin cambiarla.
- **Retención 30 días.** Al reclamar una llave se borran las de ese usuario con más de 30 días. Una
  llave repetida después de 30 días se trata como nueva (ningún cliente reintenta tanto tiempo).
  No hay limpieza periódica: como la bienvenida suele enviarse una sola vez, en la práctica la fila
  (pequeña, sin montos) queda hasta que se borra la cuenta (`ON DELETE CASCADE`).
- **Sin datos sensibles en logs.** El código nuevo no registra cuerpos, montos, tokens ni llaves.
  Ojo: el manejador general de errores (`error.middleware.js`, anterior a este cambio) imprime el
  error completo de PostgreSQL en un 500, y eso puede incluir la fila que falló (con montos).

## Límite conocido (no resuelto, espera aprobación)

Un POST **viejo con OTRA llave** que llega tarde (por ejemplo, un intento anterior que el cliente
abandonó y generó una llave nueva) se aplica normal y puede pisar un saldo más nuevo. La llave solo
evita aplicar dos veces **el mismo** intento; no ordena intentos distintos.

Resolverlo exige cambiar el contrato, por ejemplo:

- `If-Unmodified-Since` / un campo `expectedBalanceAt` con el `balanceAt` que el cliente vio: si el
  saldo cambió desde entonces, `409`/`412` y el cliente vuelve a leer; o
- una columna `version` en `perfiles_financieros` y `If-Match: <version>`.

Ambas tocan también a la web si se quiere la misma garantía allí. Queda para decidir.

Mientras tanto el cliente móvil debe **reusar la misma llave** en todos los reintentos del mismo
intento (la guarda junto con su marca de escritura anticipada) y solo generar una llave nueva cuando
el usuario envía datos nuevos.

## Esquema

`db/patches/038_idempotencia.sql` (el 027 ya estaba usado), la misma sentencia en
`backend/src/config/migrations.js` (`038_idempotencia`, se aplica sola al arrancar) y en
`db/init/01_schema.sql` para bases nuevas. RLS lo activa el paso genérico (`03_rls.sql` /
`RLS_STATEMENT`). El conteo de tablas del CI pasó de 44 a 45.

```sql
CREATE TABLE IF NOT EXISTS idempotency_keys (
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  scope VARCHAR(64) NOT NULL,
  clave VARCHAR(128) NOT NULL,
  huella CHAR(64) NOT NULL,          -- sha256 hex del cuerpo validado
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, scope, clave)
);
```

## Plan de reversa

El cambio es aditivo. Para revertir:

1. Quitar el camino de código: `parseIdempotencyKey` (validador), el tercer parámetro de
   `finishWelcome`/`saveWelcome` y `claimKey`, y la cabecera en `postWelcome`. `claimKey` vive en
   `backend/src/repositories/idempotency.repository.js` y también la usan `POST /cards/:id/payments`
   y `POST /debts/:id/payments`: si se revierte, quitarla también de ahí.
2. Quitar la migración `038_idempotencia` de `migrations.js` y del esquema, y `DROP TABLE idempotency_keys;`
3. Devolver el conteo del CI a 44.

Los clientes sin la cabecera (la web) no notan nada en ningún paso. Un cliente móvil que siga
mandándola después de la reversa simplemente pierde la garantía (el servidor ignora cabeceras
desconocidas).

## Otros endpoints que usa el móvil (solo investigación, sin cambios)

### `POST /api/v1/transactions` (`localId`)

- `localId` opcional, 1 a 64 caracteres. Índice único `(usuario_id, local_id)` e
  `INSERT ... ON CONFLICT DO NOTHING`.
- Reintento con el mismo `localId`: devuelve la transacción que ya existe, con `201` (no hay cabecera
  de repetición). Si ya se había borrado, la devuelve con `deletedAt` en vez de revivirla.
- **No compara el cuerpo**: el mismo `localId` con otros datos devuelve la original sin avisar
  (no hay `409`). Es seguro contra duplicados, no contra reuso equivocado de la llave.
- Concurrencia: dos inserts simultáneos con el mismo `localId` dejan una sola fila (el segundo lee
  la del primero).
- Comparte espacio de `localId` con `/sync/batch`: el mismo movimiento puede llegar por las dos vías.
- **El móvil debe mandar** un `localId` estable (UUID) generado al anotar y reusarlo en cada reintento.

### `PUT /api/v1/transactions/:id`

- Sin detección de conflictos: no acepta `If-Match`, `If-Unmodified-Since` ni `updatedAt`.
  Last-write-wins por orden de llegada; el servidor pone `updated_at = now()`.
- Repetir el mismo PUT es idempotente en el resultado (mismos valores), salvo que una edición
  distinta llegue en medio: el reintento la pisa.
- Si cambia el tipo sin mandar categoría, se recategoriza (puede usar IA): repetir podría dar otra
  categoría sugerida.
- `404` si no existe, está borrada o es de otro usuario.

### `DELETE /api/v1/transactions/:id`

- Borrado lógico (`deleted_at`). La primera vez `204`; repetirlo da **`404`** (ya no está). El
  cliente debe tratar `404` en un reintento de DELETE como éxito.

### `POST /api/v1/sync/batch`

- Hasta 200 operaciones `create | update | delete`, cada una con `localId`; `update`/`delete`
  exigen `serverId` y `updatedAt` (ISO 8601, hora del dispositivo de la última edición), y el lote
  exige `lastSyncedAt` (o `null`).
- `create`: idempotente por `localId` (igual que `POST /transactions`).
- `update`/`delete`: last-write-wins (RN-07). Hay conflicto si la fila cambió en el servidor después
  de `lastSyncedAt`; gana el `updatedAt` más reciente (`resolution: server_wins | client_wins`, con
  `serverVersion`). Un borrado en el servidor nunca se revierte; borrar algo ya borrado es éxito.
- Fase 1 valida todo antes de aplicar (un `422` no aplica nada). **La fase 2 no es una sola
  transacción**: si falla a mitad (500), lo aplicado antes queda. El reintento del lote es seguro:
  los `create` no se duplican, los `delete` repetidos son éxito y un `update` ya aplicado vuelve
  como conflicto `server_wins` con la versión que el propio cliente dejó.
- Compara `updatedAt` del dispositivo con `updated_at` del servidor: depende del reloj del teléfono.
- **El móvil debe mandar** `localId` estable por operación, `serverId` + `updatedAt` en ediciones y
  borrados, `lastSyncedAt` = el `syncedAt` de la última respuesta, y aplicar `conflicts` y
  `serverChanges` de la respuesta.
