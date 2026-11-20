# Rinde: manual visual de la app

Documento vivo. Es la fuente de verdad del diseño de la app; la guía del logo está aparte en `marca-rinde/kit/guia-de-uso.md`.
**Regla:** todo cambio que toque colores, letra, componentes o movimiento actualiza este archivo en el mismo cambio.
Los valores de abajo se tomaron de `frontend/src/index.css` y de los componentes reales (nov-2026); si el código y este texto difieren, gana el código y se corrige el texto.

## 1. Principios
1. **Claridad antes que adorno.** Cada elemento responde una pregunta del usuario o no está.
2. **Confianza.** Cifras grandes y legibles, sin falsa certeza: lo estimado se rotula como estimado.
3. **El color informa, nunca es lo único.** Gasto/ingreso, alertas y categorías llevan también texto, signo o ícono.
4. **Se ve igual en todo el producto.** Antes de crear un patrón nuevo, usa uno de este manual.
5. **Mover con propósito.** La animación explica un cambio de estado; si no explica nada, se quita.

## 2. Dónde viven los tokens
| Capa | Archivo | Para qué |
|---|---|---|
| Marca y páginas públicas (landing, login, registro) | `@theme` en `frontend/src/index.css` (`primary`, `violet`, `obsidian`, `border`…) | Estilo oscuro original |
| Zona privada `/app`, con tema claro y oscuro | variables `--app-*` + utilidades `canvas`, `surface`, `ink`, `brand`, `positive`, `negative`, `caution`… | **Todo lo nuevo en `/app` usa estas** |

El tema se cambia con `data-theme="light|dark"` en un contenedor. Fuera de `/app` las mismas variables dan el diseño oscuro.

## 3. Color (zona privada)
| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `canvas` | `#F5F4F9` | `#0C0B11` | fondo de página |
| `surface` | `#FFFFFF` | `#15141C` | tarjetas y paneles |
| `surface-muted` | `#EFEDF6` | `#1E1C27` | zonas hundidas, filas |
| `ink` | `#16141F` | `#F2F1F7` | texto; bordes y textos secundarios con opacidad (`border-ink/10`, `text-ink/60`) |
| `field` / `field-line` | `#FFFFFF` / `#D9D6E4` | `#0F0E15` / `#2D2B38` | campos de formulario |
| `brand` | `#5B3DF5` | `#9B85FF` | acción principal, selección, enlaces |
| `brand-soft` | `#ECE8FF` | violeta 18 % | fondo de acento suave |
| `positive` | `#087A59` | `#34D6A5` | ingresos, cumplido |
| `negative` | `#C8321F` | `#FF7A6B` | gastos, errores, excedido |
| `caution` | `#9A5B00` | `#FBBF24` | avisos, cerca del límite |
| `chart-income` / `chart-expense` | `#087A59` / `#C8321F` | `#1FA77E` / `#E5594A` | barras (tonos más profundos que el texto) |
| `chart-cat-1…8`, `chart-other` | ver `index.css` | ver `index.css` | categorías en gráficos |

Reglas:
- El violeta de marca es `#6142FF`. En el tema claro de la app se usa `#5B3DF5`, un poco más oscuro, para cumplir contraste AA sobre blanco. No se inventa un tercer violeta.
- El verde `#2FD6A3` del logo es solo de la moneda del logo. Dentro de la app lo "positivo" usa `positive`.
- Las paletas de categorías están validadas para daltonismo y **siempre llevan el nombre al lado**.
- Los tonos de Tailwind en `@theme` (amber, rose, sky…) existen solo para íconos de categorías y avisos. Están en hex a propósito (iOS < 15.4 no entiende `oklch`). Si hace falta otro tono, se agrega ahí.
- No uses colores en hex sueltos dentro de componentes.

## 4. Tipografía
- Familia única: **Inter Tight Variable** (`font-sans`). El nombre "rinde" del logo está dibujado; nunca se escribe con fuente.
- Escala en uso (por frecuencia): `text-sm` 14 px (cuerpo de la app), `text-xs` 12 px (solo apoyo), `text-[15px]` (controles), `text-lg`, `text-xl`, `text-2xl` (títulos), `text-[28px]`/`text-[42px]` (cifras protagonistas).
- Jerarquía de una pantalla: una cifra o título dominante, un nivel intermedio, y apoyo en `text-ink/60`.
- Cifras de dinero: formato con `lib/money.js`; en columnas, números tabulares.
- Texto de apoyo mínimo recomendado: 12 px y solo cuando no sea información decisiva.

## 5. Forma, espacio y profundidad
- **Radios:** `rounded-xl` 12 px (botones, campos, controles), `rounded-2xl` 16 px (paneles, tarjetas), `rounded-3xl` 24 px (superficies grandes, ventanas), `rounded-full` (chips, avatares, píldoras).
- **Panel** (`components/layout/Panel.jsx`): `rounded-2xl border border-ink/10 bg-surface p-5 md:p-6`. Es la tarjeta estándar; no recrearla.
- **Espacio:** múltiplos de 4 px de Tailwind; gutter de página `px-4 sm:px-6 lg:px-8`, ancho máximo `container-page` 1200 px.
- **Sombras:** `shadow-card`, `shadow-elevated`, `shadow-violet-glow` existen para landing y ventanas. En `/app` prefiere borde suave a sombra.
- **Degradados y vidrio** (`bg-gradient-violet`, `bg-glass`): solo en páginas públicas. No usar en `/app` como decoración.

## 6. Componentes base
| Componente | Archivo | Reglas |
|---|---|---|
| **Button** | `ui/button.jsx` | Variantes: `default` (acción principal, una por pantalla), `soft` (secundaria con marca), `outline`, `ghost`, `dark`, `outline-light`, `link`. Tamaños: `default` 44 px, `sm` 36 px, `lg` 48 px, `icon` 40 px |
| **Input / Select / Checkbox / Label** | `ui/` | Campo de 48 px, borde rojo con `aria-invalid`, anillo de foco violeta |
| **Panel** | `layout/Panel.jsx` | Tarjeta base |
| **ChipGroup** | `common/ChipGroup.jsx` | Pastillas de una sola opción (radios) o de varias con `multiple` (casillas). Elegida: borde `brand`, fondo `brand-soft` |
| **ReminderBlock** | `common/ReminderBlock.jsx` | Bloque "Avisarme" (FT-0063): días de anticipación (varios), hora y canal, con una frase que resume lo elegido. Es el único bloque de avisos de la app: se usa igual en cuentas, tarjetas, suscripciones y calendario; no se copia ni se rediseña por pantalla. Sin días elegidos esconde hora y canal. Si se elige WhatsApp sin tenerlo conectado, avisa en `caution` con enlace a Cuenta |
| **AdjustmentRow** | `money/AdjustmentRow.jsx` | Fila gris de "Ajuste de saldo" en el historial (FT-0062): no es ingreso ni gasto, por eso no usa `positive` ni `negative` |
| **MonthGrid** | `common/MonthGrid.jsx` | Cuadrícula de un mes. Con `onSelect` cada día es un botón de 48 px de alto con su texto para lector de pantalla; `footer` lleva la leyenda |
| **Segmented** | `common/Segmented.jsx` | Opciones excluyentes en una franja (Gasto/Ingreso, Semana/Mes/Año); 44 px de alto |
| **Selector de acceso** | `auth/AuthLayout.jsx` (`mode`) | Franja "Iniciar sesión \| Crear cuenta" arriba del formulario en `/login` y `/registro`. Son enlaces (no botones) de 44 px; la elegida lleva `aria-current` y la pieza clara. Es la versión para páginas públicas de `Segmented`; no usar en `/app` |
| **Sheet** | `common/Sheet.jsx` | Ventana que sube desde abajo en celular y se centra desde tablet; arrastrable, atrapa el foco, Escape cierra, devuelve el foco al abrir |
| **ConfirmButton** | `common/ConfirmButton.jsx` | Confirmación en dos pasos para acciones destructivas |
| **CountrySelect / CountrySettings** | `account/` | País de la persona: `<select>` nativo con los nombres en su idioma (orden alfabético). `CountrySettings` es la fila «País» de Cuenta; el paso del país al empezar va en `onboarding/CountryStep.jsx` |
| **OnboardingShell** (`StepTitle`, `StepAction`) | `onboarding/OnboardingShell.jsx` | Marco de la bienvenida (sección 13): Atrás, avance y Omitir arriba; una sola acción abajo. No se usa dentro de `AppShell` |
| **Lista de casillas** | `money/IncomeSourcesFields.jsx` | Varias opciones que se pueden marcar a la vez, con preguntas propias: un solo bloque `rounded-3xl bg-surface` con divisores, ícono en ficha de color (`tone`, tonos de categorías), y a la derecha una casilla **cuadrada** (`role="checkbox"`); la redonda queda para «solo una». Marcada: casilla llena + visto + fondo `brand-soft/50` (nunca solo el color). Sus preguntas se abren debajo y se acercan a la vista |
| **RindeLine** | `common/RindeLine.jsx` | Línea que rinde (barra con la moneda verde). Es el avance de la bienvenida, de metas y de deudas. Decorativa y sin toques (`pointer-events-none`): quien la usa dice el avance en texto o con `role="progressbar"` |
| **Rin** | `rin/Rin.jsx` | La mascota. Solo dibuja; emoción y gesto se le pasan. Reglas de uso en la sección 13 |
| **Gráficos** | `charts/`, `dashboard/` | Ver sección 8 |

Estados obligatorios de todo control: reposo, hover, `:focus-visible` (contorno violeta de 2 px con separación de 2 px), activo, deshabilitado (opacidad 50 %) y, si aplica, error y cargando.

## 7. Movimiento
Tokens en `@theme` (`--animate-*`). Curvas: salida `cubic-bezier(0.22, 1, 0.36, 1)`, pantallas `cubic-bezier(0.32, 0.72, 0, 1)`.
| Animación | Duración | Uso |
|---|---|---|
| `page-in` / `page-back` | 240 ms | cambio de pantalla, desde la derecha al avanzar y desde la izquierda al volver |
| `switch-in` | 240 ms | la pieza del selector de acceso llega desde la otra opción; el formulario entra con `page-in` |
| `screen-up` | 340 ms | pantalla completa que sube |
| `pop` | 420 ms | confirmación de éxito |
| `row-in` | 900 ms | movimiento recién agregado: se abre y queda resaltado |
| `bar-in`, `ring-in` | 600–700 ms | entrada de gráficos |
| `voice-ring`, `voice-wave` | continuo | solo mientras el micrófono escucha |
| `rise` | 420 ms | bloques de una pantalla de primera vez que llegan en cascada (50 ms entre uno y otro, con `animationDelay` en línea) |
| `swap-in` | 220 ms | un dato que cambia en su sitio (la moneda al elegir país): llega con un desenfoque leve |
| `fade-up`, `float` | 600 ms / 6 s | solo páginas públicas |
| velo del recorrido con voz | 200 ms entra + 350 ms sale | cambio de sección en la landing durante el recorrido: un velo del color de la sección que llega tapa, la página cambia debajo y el velo se retira; los bloques de la sección entran con `rise` (80 ms entre uno y otro). Hero → «Qué es» → «Cómo funciona» bajan de corrido (1,1 s) porque comparten el logo |
| reproductor del recorrido | 240 ms | en celular (menos de 640 px de ancho o 500 px de alto) arranca minimizado: barra de 56 px con pausa, sección, avance, ampliar y cerrar; ampliado muestra subtítulos, anterior/siguiente y tramos. El recorrido ubica cada sección entre la barra de arriba (64 px en celular, 80 en escritorio) y el reproductor, midiendo los dos |

Reglas: respetar `prefers-reduced-motion` (`motion-safe:`, `MotionConfig reducedMotion="user"`); animar `transform` y `opacity`; nada de movimiento en acciones repetidas de teclado.

## 8. Gráficos y cifras
- Cada gráfico responde **una pregunta** (¿en qué gasto?, ¿cuánto me queda?, ¿voy dentro del presupuesto?). Si no la responde, no se pone.
- Ingresos y gastos usan `chart-income` / `chart-expense`; categorías usan `chart-cat-*`, con nombre y valor visibles.
- Lo estimado o proyectado se rotula y no se presenta como dato cierto.
- **Dinero según el país (17-nov-2026):** todo monto pasa por `formatMoney` o `formatMoneyCompact` (`transactions/format.js`) y todo campo de monto por `MoneyInput`. Nunca escribir `$` ni `'es-CO'` a mano: el símbolo, los separadores y los centavos salen de `lib/region.js` (`$ 12.500` en Colombia, `$12,500.50` en Estados Unidos, `R$ 1.234,56` en Brasil). Los números van como en la casa de la moneda principal, aunque la persona viaje o use otro idioma.
- **De viaje (fase 2):** si el país actual tiene otra moneda, Anotar muestra junto a «Monto» un `Segmented` con las dos monedas (la de allá elegida). Debajo va una línea de 13 px «≈ $ 35.830 · 1 MXN = $ 179,15 · Corregir tasa»; la tasa se corrige en una casilla aparte. Las otras monedas se escriben con `formatIn` (desde Colombia `MXN 200`, con el código, para no confundirlas con el `$` del peso) y el detalle del movimiento muestra la fila «Pagado allá». Los avisos de «¿faltan ceros?» solo valen en pesos colombianos.
- **Reportes exportados (Excel y PDF) y su vista previa en Exportar (FT-0012):** ingresos en `positive` y gastos en el violeta de marca; las categorías van todas en violeta, distinguidas por nombre y largo de barra, no por un color cada una. El rojo queda solo para alertas (presupuesto excedido, balance negativo). Es una excepción aprobada el 13-nov-2026 para los documentos; dentro de la app los gráficos siguen con `chart-income` / `chart-expense`. El logo va a color sobre `#F5F4F9`. Componente: `export/ReportPreview.jsx`.
- **Semáforo del calendario (FT-0069):** `positive` te alcanza con holgura, `caution` te queda poco, `negative` no alcanza o está atrasado. Sale de lo que queda después de los pagos del día. Siempre con leyenda visible; el rojo lleva además el signo `!`. Un pago sin saldo calculado va en `ink/60` y lo que entra en `brand`, para no confundirlos con el verde.

## 9. Estados que toda pantalla debe resolver
| Estado | Patrón existente |
|---|---|
| Vacío / primera vez | `dashboard/DashboardEmpty.jsx`: ícono en `brand-soft`, título, una frase, acción principal y vista previa de lo que verá |
| Cargando | esqueletos con `animate-pulse` (ya usados en el inicio, balance y gráficos) |
| Error | mensaje que dice qué pasó y qué hacer, con la acción de reintentar; nunca solo "Error" |
| Éxito | `pop` + texto de confirmación |
| Sin conexión / lento | `layout/SyncStatus.jsx` y la cola `offline/` |
| Datos extremos | probar con nombres largos, montos de 10 dígitos, cero y miles de ítems (`MAX_AMOUNT` en `lib/money.js`) |
| Destructivo | `ConfirmButton`, y avisar lo que se pierde. Para eliminar un movimiento (lista y detalle): botón `outline` rojo, centrado y del ancho de la acción principal, que abre `Sheet` con lo que se borra y «Sí, eliminar» en `negative` |
| Formulario con datos que faltan | El botón de guardar no se apaga ni se vuelve un aviso: al tocarlo lleva el foco a la casilla vacía, la marca con `aria-invalid` y dice qué escribir. Cada dato que se pide tiene su casilla visible con etiqueta; nada depende de una regla que el usuario no ve (Anotar: «Monto» y «¿En qué fue?», 17-nov-2026) |

## 10. Responsive y accesibilidad
- Se diseña de móvil hacia arriba: celular pequeño (≈ 360 px), celular, tablet (`md`), portátil y escritorio (`lg`+). No es el escritorio encogido: en móvil hay inicio propio (`MobileHome`) y ventanas que suben desde abajo.
- Objetivo táctil: **mínimo 44 px**. Hoy `Button size="sm"` (36 px) y `size="icon"` (40 px) no llegan; en móvil usar `default` o dar zona táctil de 44 px.
- Contraste AA en ambos temas; los colores del tema claro ya están calculados para eso.
- Foco visible siempre, navegación por teclado completa, `aria-label` en controles con solo ícono, `aria-invalid` en campos con error.
- Cifras importantes nunca dependen solo del color: signo (+/−), texto o ícono.

## 11. Deuda de diseño conocida (nov-2026)
Se registra para corregir sin romper la identidad; no es un cambio aprobado.
1. `Button` `sm` e `icon` están por debajo de 44 px (sección 10). Las pastillas de `ChipGroup` miden 36 px.
2. Hay ≈ 100 usos de `text-xs` (12 px) y ≈ 10 de `text-[13px]`: revisar que no cargue información decisiva.
3. El comentario de `index.css` aún dice "plantilla Revio"; el nombre es Rinde (no tocar identificadores internos).
4. `--color-card`, `--color-muted`, etc. del `@theme` son del sistema público; en `/app` no se usan: no mezclar.
5. No existe documentación de componentes de dominio (tarjetas de tarjeta de crédito, metas, vacas): agregar al crecer.

## 12. Bienvenida (18-nov-2026)
`/app/bienvenida`: lo primero que ve una persona. Una sola secuencia, con una sola cuenta de pasos.

| # | Pantalla | Archivo | Qué resuelve |
|---|---|---|---|
| 0 | Saludo | `onboarding/WelcomeIntro.jsx` | Marca, Rin que saluda y la promesa. Sin barra de avance. «Empezar» o «Ahora no» (entra a la app sin responder) |
| 1 | País e idioma | `onboarding/CountryStep.jsx` | El país propone moneda e idioma; el idioma se elige aparte y, si la persona lo toca, el país ya no lo cambia. La ficha violeta muestra cómo se escribirá su plata |
| 2–6 | Cómo funciona | `onboarding/HowItWorksTour.jsx` | Cinco ejemplos en un escenario `brand-soft` rotulado «Ejemplo» (nada se anota). No avanza solo: botón o deslizar. Se puede repetir |
| 7–9 | Tres preguntas | `pages/app/Welcome.jsx` | Ingresos (lista de casillas), plata de hoy y pagos del mes. Todas opcionales |

Reglas:
- **Un solo avance:** la `RindeLine` del marco cuenta las nueve pantallas. No hay «Paso 1 de 3» por tramo. El lector de pantalla oye «Paso 4 de 9».
- **Los controles no se mueven:** Atrás a la izquierda, Omitir a la derecha (omite esa pantalla, o el recorrido entero, sin borrar lo respondido en las demás) y un único botón principal abajo, de 48 px.
- **Nada es obligatorio ni se convierte en movimiento:** lo que se responde aquí son datos para planear. La pregunta de plata dice para qué se pide.
- **No se pierde lo respondido:** se guarda en el dispositivo (`lib/onboardingDraft.js`) hasta terminar; recargar, cambiar de idioma o quedarse sin conexión devuelve a la misma pantalla. Guardar no se envía dos veces.
- **Ejemplos en la moneda de la persona:** en pesos colombianos se habla en miles («gasolina 40 mil» → `$ 40.000`); en las demás, el número solo («gas 40» → `$40`).
- **Rin aparece dos veces y no más:** saluda en la pantalla 0 y explica por qué se pregunta por los ingresos. No da puntos ni premios, no interrumpe y no se repite en cada pantalla. Se usa el dibujo oficial (`rin/Rin.jsx`), sin versiones nuevas.
- **Movimiento:** las pantallas llegan con `page-in` / `page-back`; el saludo, con `rise`. Con movimiento reducido el ejemplo de voz se ve completo de una vez y no hay botón de repetir.
- Quien vuelve desde el inicio a responder entra con `?paso=preguntas`: solo las tres preguntas, «Paso 1 de 3», y Atrás lo devuelve al inicio.

## 13. Cómo se cambia este manual
1. Cambio de bajo riesgo (ajuste de espacio, estado, microinteracción): se hace y se documenta aquí.
2. Cambio que afecte la identidad (paleta, letra, logo, forma de la navegación) o una regla de negocio: se propone a David antes.
3. Un componente nuevo se agrega a la sección 6 con sus estados; un token nuevo, a `index.css` y a la sección 3.
