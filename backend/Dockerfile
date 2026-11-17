# Imagen del backend de FinTrack (docker compose local y ambiente de pruebas en AWS).
FROM node:20-alpine

WORKDIR /app

# Primero las dependencias, para aprovechar la caché de capas de Docker.
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
# Scripts de apoyo (p. ej. la cuenta demo del ambiente de pruebas: infra/aws/aws.sh seed).
COPY scripts ./scripts

ENV NODE_ENV=production
EXPOSE 3000

# Ejecutar como usuario sin privilegios.
USER node

CMD ["node", "src/server.js"]
