# Ambiente de pruebas (QA) en AWS (FT-0064, FT-0072)

Copia de la API para pruebas internas, **separada de producción** (Render + Supabase + Vercel).

| Pieza | En AWS |
|---|---|
| API | EC2 `t4g.small` (ARM) con Docker, detrás de Caddy con HTTPS automático en `https://<ip>.sslip.io` |
| Base de datos | PostgreSQL 16 en la misma instancia, solo accesible desde adentro (túnel para las pruebas) |
| Soportes de pago | Bucket S3 privado, cifrado, solo HTTPS, se vacía solo a los 30 días |
| Costos | AWS Budgets con avisos al 50 %, 80 %, 100 % y por pronóstico |
| Acceso | Sin SSH ni puerto 22: Session Manager. La instancia solo puede tocar su bucket |

Los secretos (clave de la BD y `JWT_SECRET`) se generan dentro de la instancia al arrancar; no pasan por
el repo, la plantilla ni la consola. Los recordatorios están apagados para no mandar push ni WhatsApp a nadie.

## Antes de empezar (una sola vez)

1. AWS CLI v2 con sesión iniciada (`aws configure sso` o `aws configure`) y el
   [plugin de Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html).
2. Un usuario con permisos para CloudFormation, EC2, S3, IAM, SSM y Budgets. No uses la cuenta raíz.

## Cómo se conecta con los otros ambientes

| | Desarrollo | Pruebas (QA) | Producción |
|---|---|---|---|
| Rama | `feat/*`, `fix/*` | `develop` | `main` |
| API | `npm run dev` | esta instancia (`https://<ip>.sslip.io`) | Render |
| Base | Docker local (5434) | PostgreSQL en esta instancia | Supabase |
| Frontend | `localhost:5173` | Vercel, vista previa de `develop` | Vercel producción |
| Despliegue | cada uno | automático: job `deploy-qa` del CI, al pasar las pruebas en `develop` | automático al fusionar en `main` |

### Activar el despliegue automático (una vez)

1. `./infra/aws/aws.sh status` y copiar `DeployRoleArn`.
2. GitHub > Settings > Secrets and variables > Actions > **Variables**: `AWS_DEPLOY_ROLE_ARN` = ese valor.
   Es una variable, no un secreto: el rol no sirve fuera de la rama `develop` de este repo.

### Frontend de pruebas (Vercel, una vez)

1. Vercel > Settings > Environment Variables: `VITE_API_URL` = la `ApiUrl` de QA, solo para
   **Preview** y la rama **develop**.
2. La URL fija de la rama es `https://<proyecto>-git-develop-<equipo>.vercel.app` (o un dominio como
   `pruebas.<dominio>` asignado a la rama `develop` en Settings > Domains).
3. `./infra/aws/aws.sh cors https://<esa-url>,http://localhost:5173`

### QA igual a producción: variables y claves

La API de QA lee las mismas variables que producción tiene en Render, guardadas en **AWS Parameter
Store** bajo `/rinde-pruebas/` (las secretas, cifradas). Nunca pasan por el repo ni por el chat.

```bash
./infra/aws/aws.sh config GOOGLE_CLIENT_ID 123-abc.apps.googleusercontent.com   # no secretas
./infra/aws/aws.sh secret EMAIL_API_KEY                                         # secretas: la pide sin mostrarla
./infra/aws/aws.sh env                                                          # qué hay (solo nombres)
./infra/aws/aws.sh reload                                                       # aplicar sin redesplegar
```

| Igual a producción | Distinto a propósito |
|---|---|
| Código, Node, parches de la base, Google, correos (Brevo), IA (Gemini y Groq), recordatorios, administradores | Base de datos y `JWT_SECRET` propios; llaves push propias (`aws.sh vapid`); soportes en S3 (no Supabase); sin bot de WhatsApp (un número solo admite un webhook); dominio `sslip.io` |

Google: en Google Cloud > Credentials > el cliente OAuth web, agregar el frontend de QA en
*Authorized JavaScript origins* y `<ApiUrl>/api/v1/auth/google/redirect` en *Authorized redirect URIs*.

### Cuentas de prueba

Con `EMAIL_API_KEY` QA manda los correos como producción. Para saltarte la verificación con una
cuenta de prueba: `./infra/aws/aws.sh verify <correo>`. Para tener datos: `./infra/aws/aws.sh seed` (imprime la clave).

## Uso

```bash
./infra/aws/aws.sh up equipo@correo.com 10   # crea todo, con tope de USD 10 al mes
./infra/aws/aws.sh status                      # URLs y si la API responde (~5 min la primera vez)
./infra/aws/aws.sh smoke                       # /health y un registro de punta a punta, con tiempos
./infra/aws/aws.sh deploy feat/mi-rama         # llevar otra rama a mano (por defecto develop)
./infra/aws/aws.sh logs 200                    # log de la API
./infra/aws/aws.sh verify correo@prueba.test   # verificar una cuenta de prueba
./infra/aws/aws.sh seed                        # cuenta demo con 3 meses de datos
./infra/aws/aws.sh tunnel                      # PostgreSQL en localhost:5435 para correr npm test
./infra/aws/aws.sh cost 2026-11-12             # costo real por servicio desde esa fecha
./infra/aws/aws.sh down                        # borrar TODO, bucket incluido
```

Después de `up`, **confirma el correo de AWS Budgets** o las alertas no llegan.

### Correr las pruebas del backend contra AWS

```bash
./infra/aws/aws.sh dbpass                      # muestra la clave de la BD de pruebas
./infra/aws/aws.sh tunnel                      # déjalo abierto
# en otra terminal:
cd backend && DATABASE_URL="postgresql://rinde:<clave>@localhost:5435/rinde" AUTH_RATE_LIMIT_MAX=500 npm test
```

### Probar el frontend contra esta API

`./infra/aws/aws.sh up` crea la API con `CORS_ORIGIN=http://localhost:5173`. Corre el frontend con
`VITE_API_URL=https://<ip>.sslip.io npm run dev`.

> **Vistas previas de Vercel (auditoría H10).** QA solo acepta los orígenes de `CORS_ORIGIN`: el alias
> estable de `develop` y `localhost:5173`. La URL única de cada vista previa de un PR queda bloqueada
> a propósito (es lo seguro): para probar un PR contra QA usa el alias de `develop` o el frontend local.

## Costo esperado (us-east-1, precios de lista)

| Recurso | Al mes |
|---|---|
| EC2 `t4g.small` encendida 24/7 | ~USD 12,3 |
| Disco gp3 20 GB | ~USD 1,6 |
| IP pública (IPv4) | ~USD 3,6 |
| S3 (pocos MB) | < USD 0,1 |
| **Total** | **~USD 17,5** (~USD 4 por semana) |

Con `t4g.micro` baja a ~USD 11. Las cuentas nuevas tienen crédito del plan gratuito, que cubre
la semana de prueba. Para medir el costo real, deja el entorno una semana y corre `aws.sh cost <día de inicio>`
(Cost Explorer tarda hasta 24 h en mostrar el gasto).

**Al terminar las pruebas, `./infra/aws/aws.sh down`.** La instancia y la IP cobran aunque nadie las use.
