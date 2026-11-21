# Corte y fecha límite de las tarjetas en el calendario · Botón de instalar en el hero

## Por qué
Nicolás quiere ver en el calendario cuándo corta cada tarjeta y hasta cuándo puede pagarla, y que
desde la landing en el celular se pueda instalar Rinde como app sin bajar hasta la sección "App instalable".

## Qué se hace
1. **Calendario.** `buildPaymentCalendar` devuelve `cardDates`: el corte de cada tarjeta que tenga
   `cutoffDay` (`kind: 'corte'`) y la fecha límite de pago (`kind: 'limite'`) cuando ese mes no hay
   un pago de la tarjeta (no debe nada). Sin monto ni saldo. Van aparte de `events` porque Inicio,
   Planear y Mi plata leen `events` como "próximos pagos"; solo la pantalla Calendario los mezcla.
2. **Hero.** Botón "Instalar app" solo en celular (`md:hidden`). Android: el instalador del navegador
   (`useInstallPrompt`). Si el navegador no lo ofrece (iPhone, navegador de otra app), baja a
   "App instalable", donde `installGuide` (#235) ya da los pasos de cada dispositivo: una sola guía.
   Oculto si ya está instalada.

## Enfoques considerados
- Corte dentro de `events`: menos código, pero se colaría en "próximos pagos" de varias pantallas. Descartado.
- Lista aparte `cardDates` (elegido).

## Decisiones mías
- Tarjeta sin día de corte: no sale corte; no se vuelve obligatorio.
- Las compras a cuotas con tasa quedan para su propio diseño.
