FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
RUN apk add --no-cache ffmpeg && \
    addgroup --system --gid 1000 squidsub && \
    adduser --system --uid 1000 squidsub squidsub
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER squidsub
EXPOSE 5050
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
