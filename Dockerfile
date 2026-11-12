FROM node:24-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV HOST=0.0.0.0 PORT=3019 DATA_DIR=/data
# Required at run time: APP_PASSWORD, PUBLIC_URL (https://your.domain). Mount a volume at /data.
VOLUME /data
EXPOSE 3019
CMD ["node", "server.js"]
