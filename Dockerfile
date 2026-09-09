FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
