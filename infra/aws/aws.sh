#!/usr/bin/env bash
# Rinde - entorno de pruebas en AWS (FT-0064). Usa tu sesión de la AWS CLI (aws configure / SSO);
# este script nunca pide ni guarda credenciales.
#
#   ./infra/aws/aws.sh up <correo-alertas> [tope-usd]   crear o actualizar la infraestructura
#   ./infra/aws/aws.sh status                           URLs y estado
#   ./infra/aws/aws.sh deploy [rama]                    llevar el código de una rama a la instancia
#   ./infra/aws/aws.sh smoke                            probar /health y el registro de punta a punta
#   ./infra/aws/aws.sh tunnel                           túnel a PostgreSQL en localhost:5435 (para npm test)
#   ./infra/aws/aws.sh cost [desde AAAA-MM-DD]          costo real por servicio desde esa fecha
#   ./infra/aws/aws.sh down                             borrar TODO (bucket incluido)
set -euo pipefail

STACK="${STACK:-rinde-pruebas}"
REGION="${AWS_REGION:-us-east-1}"
HERE="$(cd "$(dirname "$0")" && pwd)"
aws_() { aws --region "$REGION" "$@"; }
output() {
  aws_ cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
# Corre un comando en la instancia con Session Manager y muestra lo que imprimió.
remote() {
  local id cmd
  id="$(output InstanceId)"
  cmd="$(aws_ ssm send-command --instance-ids "$id" --document-name AWS-RunShellScript \
    --parameters "commands=[\"$1\"]" --query Command.CommandId --output text)"
  aws_ ssm wait command-executed --command-id "$cmd" --instance-id "$id" || true
  aws_ ssm get-command-invocation --command-id "$cmd" --instance-id "$id" \
    --query '[Status, StandardOutputContent, StandardErrorContent]' --output text
}

case "${1:-}" in
  up)
    email="${2:?Uso: aws.sh up <correo-alertas> [tope-usd]}"
    aws_ cloudformation deploy --stack-name "$STACK" --template-file "$HERE/template.yaml" \
      --capabilities CAPABILITY_IAM --tags Project="$STACK" \
      --parameter-overrides BudgetEmail="$email" BudgetUsd="${3:-10}"
    echo "Listo. La instancia tarda ~5 min en construir la API la primera vez."
    echo "Confirma el correo de AWS Budgets que llega a $email para activar las alertas."
    "$0" status
    ;;
  status)
    aws_ cloudformation describe-stacks --stack-name "$STACK" \
      --query 'Stacks[0].[StackStatus, Outputs[].[OutputKey, OutputValue]]' --output text
    curl -fsS --max-time 10 "$(output HealthUrl)" && echo || echo "La API todavía no responde."
    ;;
  deploy)
    branch="${2:-main}"
    remote "cd /opt/rinde && git fetch origin $branch && git checkout -B $branch origin/$branch && cd infra/aws && docker compose up -d --build && docker image prune -f"
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
    sed -n '2,12p' "$0"
    exit 1
    ;;
esac
