FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
RUN apk add --no-cache ffmpeg
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# node user has uid/gid 1000, matching the music volume ownership
USER node
EXPOSE 5050
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
