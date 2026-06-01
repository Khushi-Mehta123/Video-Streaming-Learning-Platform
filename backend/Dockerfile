FROM node:18-alpine

# Install ffmpeg for video processing
RUN apk add --no-cache ffmpeg openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Generate Prisma client
RUN npx prisma generate

RUN npm run build

EXPOSE 5000

CMD ["sh", "-c", "npx prisma db push && npm run start"]
