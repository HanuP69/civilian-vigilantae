# Stage 1: Build the React client
FROM node:20-slim AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Set up the Express server
FROM node:20-slim
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --only=production
COPY server/ ./
# Copy built client assets into Express working dir
COPY --from=client-builder /app/client/dist ./client-dist

# Create uploads directory
RUN mkdir -p uploads && chmod 777 uploads

# Expose port and run
EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

CMD ["npm", "start"]
