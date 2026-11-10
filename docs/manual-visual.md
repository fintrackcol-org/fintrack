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
| **Sheet** | `common/Sheet.jsx` | Ventana que sube desde abajo en celular y se centra desde tablet; arrastrable, atrapa el foco, Escape cierra, devuelve el foco al abrir |
| **ConfirmButton** | `common/ConfirmButton.jsx` | Confirmación en dos pasos para acciones destructivas |
| **Gráficos** | `charts/`, `dashboard/` | Ver sección 8 |

Estados obligatorios de todo control: reposo, hover, `:focus-visible` (contorno violeta de 2 px con separación de 2 px), activo, deshabilitado (opacidad 50 %) y, si aplica, error y cargando.

## 7. Movimiento
Tokens en `@theme` (`--animate-*`). Curvas: salida `cubic-bezier(0.22, 1, 0.36, 1)`, pantallas `cubic-bezier(0.32, 0.72, 0, 1)`.
| Animación | Duración | Uso |
|---|---|---|
| `page-in` / `page-back` | 240 ms | cambio de pantalla, desde la derecha al avanzar y desde la izquierda al volver |
| `screen-up` | 340 ms | pantalla completa que sube |
| `pop` | 420 ms | confirmación de éxito |
| `row-in` | 900 ms | movimiento recién agregado: se abre y queda resaltado |
| `bar-in`, `ring-in` | 600–700 ms | entrada de gráficos |
| `voice-ring`, `voice-wave` | continuo | solo mientras el micrófono escucha |
| `fade-up`, `float` | 600 ms / 6 s | solo páginas públicas |

Reglas: respetar `prefers-reduced-motion` (`motion-safe:`, `MotionConfig reducedMotion="user"`); animar `transform` y `opacity`; nada de movimiento en acciones repetidas de teclado.

## 8. Gráficos y cifras
- Cada gráfico responde **una pregunta** (¿en qué gasto?, ¿cuánto me queda?, ¿voy dentro del presupuesto?). Si no la responde, no se pone.
- Ingresos y gastos usan `chart-income` / `chart-expense`; categorías usan `chart-cat-*`, con nombre y valor visibles.
- Lo estimado o proyectado se rotula y no se presenta como dato cierto.
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
| Destructivo | `ConfirmButton`, y avisar lo que se pierde |

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

## 12. Cómo se cambia este manual
1. Cambio de bajo riesgo (ajuste de espacio, estado, microinteracción): se hace y se documenta aquí.
2. Cambio que afecte la identidad (paleta, letra, logo, forma de la navegación) o una regla de negocio: se propone a David antes.
3. Un componente nuevo se agrega a la sección 6 con sus estados; un token nuevo, a `index.css` y a la sección 3.
