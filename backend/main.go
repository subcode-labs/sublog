package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // Default port
	}

	dbPath := os.Getenv("SQLITE_PATH")
	if dbPath == "" {
		// Default path within container, assuming /data is mounted volume
		dbPath = "/data/sublog.db"
	}
	// Ensure the directory for the DB file exists
	dbDir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dbDir, 0750); err != nil {
		log.Fatalf("Failed to create database directory '%s': %v", dbDir, err)
	}

	// Initialize Database
	if err := initDB(dbPath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Create and run WebSocket Hub
	hub := newHub()
	go hub.run()

	// Setup static file server
	// Assume 'frontend' directory is relative to executable or CWD
	// In Docker, we'll copy it next to the executable.
	staticHandler := createStaticFileServer("./frontend")

	// Setup routes
	mux := http.NewServeMux()
	mux.HandleFunc("/logs", handleLogs(hub))                             // Log ingestion endpoint
	mux.HandleFunc("/logs/recent", handleGetLogs())                      // Endpoint to retrieve recent logs
	mux.HandleFunc("/logs/count", handleGetLogCount())                   // Endpoint to get total log count
	mux.HandleFunc("/logs/all", handleDeleteAllLogs(hub))                // Endpoint to delete all logs
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) { // WebSocket endpoint
		serveWs(hub, w, r)
	})
	mux.Handle("/", staticHandler) // Serve frontend files

	// Create server with timeouts
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      logRequest(mux), // Wrap mux with request logger
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  15 * time.Second,
	}

	log.Printf("Starting Sublog server on port %s...", port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Could not listen on %s: %v\n", port, err)
	}

	log.Println("Server stopped")
	// Add graceful shutdown handling here if needed
}
