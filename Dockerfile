# Stage 1: Build the Go application
FROM golang:1.24-alpine AS builder

# Install build dependencies needed for CGO (gcc, musl-dev, sqlite-dev)
RUN apk add --no-cache build-base sqlite-dev

WORKDIR /app

# Copy go mod and sum files to download dependencies
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copy the backend source code
COPY backend/ ./

# Build the Go application - REMOVED CGO_ENABLED=0
# CGO IS NOW ENABLED BY DEFAULT
RUN go build -ldflags="-w -s" -o /sublog main.go db.go websocket.go handlers.go

# Stage 2: Create the final lightweight image
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies for SQLite (shared libraries)
# --- ADD THIS LINE ---
RUN apk add --no-cache sqlite-libs
# --- / ADD THIS LINE ---

# Copy the static binary from the builder stage
COPY --from=builder /sublog /usr/local/bin/sublog

# Copy the frontend static files
COPY frontend/ ./frontend/

# Create a non-root user for security
RUN addgroup -S subloggroup && adduser -S subloguser -G subloggroup
# Ensure the /data directory exists and is owned by the user
RUN mkdir /data && chown subloguser:subloggroup /data
RUN chown -R subloguser:subloggroup /app

USER subloguser

# Expose the port the app runs on (default 8080)
EXPOSE 8080

# Set environment variables (can be overridden in docker-compose)
ENV PORT=8080
ENV SQLITE_PATH=/data/sublog.db

# Command to run the application
CMD ["/usr/local/bin/sublog"]