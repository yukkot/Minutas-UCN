FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Primero solo las dependencias, para aprovechar la caché de Docker
COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

EXPOSE 3000

# Aplica las migraciones pendientes y luego levanta la API
CMD ["sh", "-c", "node src/db/migrate.js && node src/server.js"]
