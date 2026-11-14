# Entorno de pruebas en AWS (FT-0064)

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

## Uso

```bash
./infra/aws/aws.sh up equipo@correo.com 10   # crea todo, con tope de USD 10 al mes
./infra/aws/aws.sh status                      # URLs y si la API responde (~5 min la primera vez)
./infra/aws/aws.sh smoke                       # /health y un registro de punta a punta, con tiempos
./infra/aws/aws.sh deploy feat/mi-rama         # llevar otra rama a la instancia
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
