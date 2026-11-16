#!/usr/bin/env bash
# Rinde - ambiente de pruebas (QA) en AWS (FT-0064, FT-0072). Usa tu sesión de la AWS CLI
# (aws configure / SSO); este script nunca pide ni guarda credenciales.
#
#   ./infra/aws/aws.sh up <correo-alertas> [tope-usd]   crear o actualizar la infraestructura
#   ./infra/aws/aws.sh status                           URLs y estado
#   ./infra/aws/aws.sh deploy [rama]                    llevar una rama a la instancia (por defecto develop)
#   ./infra/aws/aws.sh smoke                            probar /health y el registro de punta a punta
#   ./infra/aws/aws.sh cors <origen1,origen2>           qué frontends pueden llamar a la API de pruebas
#   ./infra/aws/aws.sh config <NOMBRE> <valor>          variable NO secreta para la API de QA (p. ej. GOOGLE_CLIENT_ID)
#   ./infra/aws/aws.sh secret <NOMBRE>                  variable secreta: la pide sin mostrarla (p. ej. EMAIL_API_KEY)
#   ./infra/aws/aws.sh vapid                            par de llaves nuevo para las notificaciones push de QA
#   ./infra/aws/aws.sh env                              qué variables tiene QA (solo los nombres)
#   ./infra/aws/aws.sh unset <NOMBRE>                   quitar una variable
#   ./infra/aws/aws.sh reload                           aplicar las variables sin redesplegar el código
#   ./infra/aws/aws.sh verify <correo>                  verificar una cuenta de prueba sin abrir el correo
#   ./infra/aws/aws.sh seed                             cuenta demo con 3 meses de datos
#   ./infra/aws/aws.sh logs [líneas]                    últimas líneas del log de la API
#   ./infra/aws/aws.sh tunnel                           túnel a PostgreSQL en localhost:5435 (para npm test)
#   ./infra/aws/aws.sh dbpass                           clave de la base de pruebas
#   ./infra/aws/aws.sh cost [desde AAAA-MM-DD]          costo real por servicio desde esa fecha
#   ./infra/aws/aws.sh down                             borrar TODO (bucket incluido)
#
# Variables opcionales: STACK (rinde-pruebas), AWS_REGION (us-east-1), CORS_ORIGIN (para `up`) y
# CREATE_OIDC=false si la cuenta ya tiene el proveedor OIDC de GitHub.
set -euo pipefail

STACK="${STACK:-rinde-pruebas}"
REGION="${AWS_REGION:-us-east-1}"
# En Git Bash (Windows): ruta con letra de unidad para aws.exe y sin convertir /rinde-pruebas/... en
# una ruta de Windows.
HERE="$(cd "$(dirname "$0")" && (pwd -W 2>/dev/null || pwd))"
export MSYS_NO_PATHCONV=1
PARAM_PATH="/$STACK"
aws_() { aws --region "$REGION" "$@"; }
output() {
  aws_ cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

# Corre un script en la instancia con Session Manager (sin SSH), espera hasta 15 min, muestra lo que
# imprimió y falla si el script falló. Viaja en base64 para no pelear con comillas.
remote() {
  local id cmd b64 status=Pending
  id="$(output InstanceId)"
  b64="$(printf '%s' "$1" | base64 | tr -d '\n')"
  cmd="$(aws_ ssm send-command --instance-ids "$id" --document-name AWS-RunShellScript \
    --timeout-seconds 900 --parameters "commands=[\"echo $b64 | base64 -d | bash\"]" \
    --query Command.CommandId --output text)"
  for _ in $(seq 1 180); do
    sleep 5
    status="$(aws_ ssm get-command-invocation --command-id "$cmd" --instance-id "$id" \
      --query Status --output text 2>/dev/null || echo Pending)"
    case "$status" in Pending | InProgress | Delayed) ;; *) break ;; esac
  done
  aws_ ssm get-command-invocation --command-id "$cmd" --instance-id "$id" \
    --query '[StandardOutputContent, StandardErrorContent]' --output text
  [ "$status" = "Success" ] || { echo "El comando terminó en: $status" >&2; return 1; }
}

# Script (en la instancia) que arma infra/aws/secrets.env con lo guardado en Parameter Store.
# Sin REMINDERS_ENABLED explícito, los recordatorios quedan apagados.
WRITE_SECRETS="set -o pipefail
cd /opt/rinde/infra/aws
umask 077
aws ssm get-parameters-by-path --region $REGION --path $PARAM_PATH --with-decryption \\
  --query 'Parameters[].[Name,Value]' --output text | sed 's#^$PARAM_PATH/##; s#\t#=#' > secrets.env.new
grep -q '^REMINDERS_ENABLED=' secrets.env.new || echo REMINDERS_ENABLED=false >> secrets.env.new
mv secrets.env.new secrets.env
echo Variables de QA: \$(cut -d= -f1 secrets.env | sort | tr '\n' ' ')"

valid_name() {
  [[ "$1" =~ ^[A-Z][A-Z0-9_]*$ ]] || { echo "Nombre inválido: usa MAYUSCULAS_CON_GUIONES" >&2; exit 1; }
  case "$1" in
    DATABASE_URL | JWT_SECRET | PORT | NODE_ENV | S3_BUCKET | AWS_REGION | CORS_ORIGIN | TRUST_PROXY)
      echo "$1 lo maneja la plantilla (o 'aws.sh cors'); no se cambia aquí." >&2
      exit 1
      ;;
  esac
}
put_param() { # nombre tipo valor
  aws_ ssm put-parameter --name "$PARAM_PATH/$1" --type "$2" --value "$3" --overwrite >/dev/null
  echo "$1 guardada ($2). Aplica con: ./infra/aws/aws.sh reload"
}

case "${1:-}" in
  up)
    email="${2:?Uso: aws.sh up <correo-alertas> [tope-usd]}"
    params=(BudgetEmail="$email" BudgetUsd="${3:-10}" CreateGitHubOidcProvider="${CREATE_OIDC:-true}")
    [ -n "${CORS_ORIGIN:-}" ] && params+=(CorsOrigin="$CORS_ORIGIN")
    aws_ cloudformation deploy --stack-name "$STACK" --template-file "$HERE/template.yaml" \
      --capabilities CAPABILITY_IAM --tags Project="$STACK" --parameter-overrides "${params[@]}"
    echo "Listo. La instancia tarda ~5 min en construir la API la primera vez."
    echo "Confirma el correo de AWS Budgets que llega a $email para activar las alertas."
    echo "Para el despliegue automático, pon DeployRoleArn en GitHub como variable AWS_DEPLOY_ROLE_ARN."
    "$0" status
    ;;
  status)
    aws_ cloudformation describe-stacks --stack-name "$STACK" \
      --query 'Stacks[0].[StackStatus, Outputs[].[OutputKey, OutputValue]]' --output text
    curl -fsS --max-time 10 "$(output HealthUrl)" && echo || echo "La API todavía no responde."
    ;;
  deploy)
    branch="${2:-develop}"
    [[ "$branch" =~ ^[A-Za-z0-9._/-]+$ ]] || { echo "Nombre de rama inválido" >&2; exit 1; }
    remote "set -e
cd /opt/rinde
git fetch origin $branch
git checkout -B $branch origin/$branch
$WRITE_SECRETS
docker compose up -d --build
docker image prune -f
echo Desplegado: \$(git log -1 --format='%h %s')"
    # La API nueva arranca y aplica los parches de la base: se espera a que responda.
    health="$(output HealthUrl)"
    for _ in $(seq 1 30); do
      curl -fsS --max-time 5 "$health" >/dev/null 2>&1 && { echo "API arriba: $health"; exit 0; }
      sleep 5
    done
    echo "La API no respondió después del despliegue. Revisa: ./infra/aws/aws.sh logs" >&2
    exit 1
    ;;
  smoke)
    api="$(output ApiUrl)"
    start=$(date +%s%3N)
    curl -fsS "$api/health" >/dev/null
    echo "health: $(( $(date +%s%3N) - start )) ms"
    # Registro con un correo .test descartable: comprueba API + base de datos de punta a punta.
    email="smoke-$(date +%s)@pruebas.rinde.test"
    pass="$(openssl rand -hex 12)"
    start=$(date +%s%3N)
    code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$api/api/v1/auth/register" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"$email\",\"password\":\"$pass\",\"acceptTerms\":true}")
    echo "registro: HTTP $code en $(( $(date +%s%3N) - start )) ms"
    [ "$code" = "201" ]
    ;;
  cors)
    origins="${2:?Uso: aws.sh cors https://frontend-de-pruebas,http://localhost:5173}"
    [[ "$origins" =~ ^[A-Za-z0-9.:/,_-]+$ ]] || { echo "Orígenes inválidos" >&2; exit 1; }
    remote "set -e
cd /opt/rinde/infra/aws
sed -i 's#^CORS_ORIGIN=.*#CORS_ORIGIN=$origins#' .env
docker compose up -d api
grep ^CORS_ORIGIN= .env"
    ;;
  config)
    valid_name "${2:?Uso: aws.sh config <NOMBRE> <valor>}"
    put_param "$2" String "${3?Uso: aws.sh config <NOMBRE> <valor>}"
    ;;
  secret)
    valid_name "${2:?Uso: aws.sh secret <NOMBRE>}"
    read -r -s -p "Valor de $2 (no se muestra): " value
    echo
    [ -n "$value" ] || { echo "Vacío: no se guardó." >&2; exit 1; }
    put_param "$2" SecureString "$value"
    ;;
  vapid)
    # Llaves propias de QA: una suscripción de prueba nunca recibe push de producción ni al revés.
    keys="$(cd "$HERE/../../backend" && node -e "console.log(JSON.stringify(require('web-push').generateVAPIDKeys()))")"
    public="$(node -e "console.log(JSON.parse(process.argv[1]).publicKey)" "$keys")"
    private="$(node -e "console.log(JSON.parse(process.argv[1]).privateKey)" "$keys")"
    put_param VAPID_PUBLIC_KEY String "$public"
    put_param VAPID_PRIVATE_KEY SecureString "$private"
    ;;
  env)
    aws_ ssm get-parameters-by-path --path "$PARAM_PATH" \
      --query 'Parameters[].[Name, Type]' --output text | sed "s#^$PARAM_PATH/##" | sort
    ;;
  unset)
    valid_name "${2:?Uso: aws.sh unset <NOMBRE>}"
    aws_ ssm delete-parameter --name "$PARAM_PATH/$2" && echo "$2 eliminada. Aplica con: ./infra/aws/aws.sh reload"
    ;;
  reload)
    remote "set -e
$WRITE_SECRETS
docker compose up -d api"
    ;;
  verify)
    # Para entrar rápido con una cuenta de prueba sin abrir el correo de verificación.
    email="$(printf '%s' "${2:?Uso: aws.sh verify <correo>}" | tr '[:upper:]' '[:lower:]')"
    [[ "$email" =~ ^[a-z0-9._%+-]+@[a-z0-9.-]+$ ]] || { echo "Correo inválido" >&2; exit 1; }
    remote "cd /opt/rinde/infra/aws && docker compose exec -T db psql -U rinde -d rinde -v ON_ERROR_STOP=1 \
-c \"UPDATE usuarios SET email_verificado_at = now() WHERE email = '$email' AND email_verificado_at IS NULL\""
    ;;
  seed)
    # Contraseña nueva cada vez; solo se muestra en tu terminal.
    pass="$(openssl rand -hex 8)"
    remote "cd /opt/rinde/infra/aws && docker compose exec -T -e DEMO_EMAIL=demo@pruebas.rinde.test \
-e DEMO_PASSWORD=$pass api node scripts/seed-demo.js --reset"
    echo "Cuenta demo: demo@pruebas.rinde.test  clave: $pass"
    ;;
  logs)
    lines="${2:-100}"
    [[ "$lines" =~ ^[0-9]+$ ]] || { echo "Uso: aws.sh logs [líneas]" >&2; exit 1; }
    remote "cd /opt/rinde/infra/aws && docker compose logs --no-color --tail $lines api"
    ;;
  tunnel)
    echo "PostgreSQL de pruebas en localhost:5435. En otra terminal:"
    echo "  cd backend && DATABASE_URL=\"postgresql://rinde:<DB_PASSWORD>@localhost:5435/rinde\" npm test"
    echo "La clave: ./infra/aws/aws.sh dbpass"
    aws_ ssm start-session --target "$(output InstanceId)" \
      --document-name AWS-StartPortForwardingSessionToRemoteHost \
      --parameters '{"host":["127.0.0.1"],"portNumber":["5432"],"localPortNumber":["5435"]}'
    ;;
  dbpass)
    remote "grep ^DB_PASSWORD= /opt/rinde/infra/aws/.env | cut -d= -f2"
    ;;
  cost)
    from="${2:-$(date -u +%Y-%m-01)}"
    aws ce get-cost-and-usage --time-period "Start=$from,End=$(date -u -d tomorrow +%F)" \
      --granularity MONTHLY --metrics UnblendedCost --group-by Type=DIMENSION,Key=SERVICE \
      --query 'ResultsByTime[].Groups[?Metrics.UnblendedCost.Amount>`0`].[Keys[0], Metrics.UnblendedCost.Amount]' \
      --output text
    ;;
  down)
    read -r -p "Esto borra la instancia, la base de datos y el bucket de $STACK. ¿Seguro? (escribe borrar) " ok
    [ "$ok" = "borrar" ] || { echo "Cancelado."; exit 1; }
    bucket="$(output BucketName)"
    aws_ s3 rm "s3://$bucket" --recursive
    aws_ cloudformation delete-stack --stack-name "$STACK"
    aws_ cloudformation wait stack-delete-complete --stack-name "$STACK"
    echo "Borrado. Revisa en Billing que no quede nada cobrando."
    ;;
  *)
    sed -n '2,25p' "$0"
    exit 1
    ;;
esac
