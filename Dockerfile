FROM node:24-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV HOST=0.0.0.0 DATA_DIR=/data
# Required at run time: APP_PASSWORD and PUBLIC_URL (https://your.domain). Mount a volume at /data.
EXPOSE 3019
CMD ["node", "server.js"]
