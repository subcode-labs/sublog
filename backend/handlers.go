package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Log request details
func logRequest(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		log.Printf("%s %s %s", r.RemoteAddr, r.Method, r.URL)
		handler.ServeHTTP(w, r)
		log.Printf("Request completed in %v", time.Since(start))
	})
}

// handleLogs handles incoming log entries via POST request.
func handleLogs(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if r.Body == nil {
			http.Error(w, "Please send a request body", http.StatusBadRequest)
			return
		}

		var logs []WinstonLog

		// Read the entire body first to analyze its format
		var bodyBytes []byte
		var err error
		bodyBytes, err = io.ReadAll(r.Body)
		if err != nil {
			log.Printf("Failed to read request body: %v", err)
			http.Error(w, "Failed to read request body", http.StatusBadRequest)
			return
		}
		// Close the body - we have the bytes now
		defer r.Body.Close()

		// Detect if the JSON is an object or an array by checking first character
		if len(bodyBytes) > 0 {
			// Trim any whitespace that might exist before the JSON content
			trimmedBody := strings.TrimSpace(string(bodyBytes))
			if len(trimmedBody) == 0 {
				http.Error(w, "Empty JSON after trimming whitespace", http.StatusBadRequest)
				return
			}

			firstChar := trimmedBody[0]

			if firstChar == '[' {
				// It's an array, decode as array of logs
				err = json.Unmarshal(bodyBytes, &logs)
				if err != nil {
					log.Printf("Failed to decode log array: %v", err)
					http.Error(w, "Invalid JSON array format", http.StatusBadRequest)
					return
				}
			} else if firstChar == '{' {
				// It's a single object, decode as single log
				var singleLog WinstonLog
				err = json.Unmarshal(bodyBytes, &singleLog)
				if err != nil {
					log.Printf("Failed to decode single log: %v", err)
					http.Error(w, "Invalid JSON object format", http.StatusBadRequest)
					return
				}
				// Add the single log to our logs slice
				logs = append(logs, singleLog)
			} else {
				log.Printf("Invalid JSON format, expected object or array but got: %c", firstChar)
				http.Error(w, "Invalid JSON format. Expected object or array.", http.StatusBadRequest)
				return
			}
		} else {
			// If we received an empty body
			http.Error(w, "Empty request body", http.StatusBadRequest)
			return
		}

		if len(logs) == 0 {
			// If we still have no logs after parsing
			http.Error(w, "No logs found in request", http.StatusBadRequest)
			return
		}

		processedCount := 0
		for _, logEntry := range logs {
			dbEntry, err := addLogEntry(logEntry)
			if err != nil {
				log.Printf("Error adding log entry: %v", err)
				// Decide if you want to stop processing batch on error, or continue
				continue // Continue processing other logs in the batch
			}
			// Broadcast the successfully saved log entry
			hub.broadcast <- dbEntry
			processedCount++
		}

		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message":         "Logs received",
			"received_count":  len(logs),
			"processed_count": processedCount,
		})
	}
}

// createStaticFileServer serves static files from the frontend directory.
func createStaticFileServer(frontendDir string) http.Handler {
	// Check if frontend directory exists
	if _, err := os.Stat(frontendDir); os.IsNotExist(err) {
		log.Fatalf("Frontend directory '%s' not found!", frontendDir)
	} else {
		log.Printf("Serving static files from %s", frontendDir)
	}

	fs := http.FileServer(http.Dir(frontendDir))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set cache control headers for static assets? Maybe later.
		// w.Header().Set("Cache-Control", "public, max-age=3600") // Example: 1 hour

		// If the requested file exists, serve it.
		// Otherwise, serve index.html (for SPA-like behavior if needed, though not strictly necessary here)
		filePath := filepath.Join(frontendDir, filepath.Clean(r.URL.Path))
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			// If file doesn't exist, serve index.html
			http.ServeFile(w, r, filepath.Join(frontendDir, "index.html"))
			return
		}

		// Serve the existing file
		fs.ServeHTTP(w, r)
	})
}

// handleGetLogs handles requests to retrieve recent logs.
func handleGetLogs() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Parse limit parameter, default to 100 if not provided
		limitStr := r.URL.Query().Get("limit")
		limit := 100
		if limitStr != "" {
			var err error
			limit, err = parseInt(limitStr, 1, 1000)
			if err != nil {
				http.Error(w, "Invalid limit parameter", http.StatusBadRequest)
				return
			}
		}

		logs, err := getRecentLogs(limit)
		if err != nil {
			log.Printf("Error retrieving logs: %v", err)
			http.Error(w, "Failed to retrieve logs", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(logs); err != nil {
			log.Printf("Error encoding logs response: %v", err)
			http.Error(w, "Error encoding response", http.StatusInternalServerError)
			return
		}
	}
}

// handleGetLogCount handles requests to get the total log count.
func handleGetLogCount() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		count, err := getTotalLogCount()
		if err != nil {
			log.Printf("Error retrieving log count: %v", err)
			http.Error(w, "Failed to retrieve log count", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]interface{}{
			"count": count,
		}); err != nil {
			log.Printf("Error encoding log count response: %v", err)
			http.Error(w, "Error encoding response", http.StatusInternalServerError)
			return
		}
	}
}

// handleDeleteAllLogs handles requests to delete all logs.
func handleDeleteAllLogs(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		err := deleteAllLogs()
		if err != nil {
			log.Printf("Error deleting logs: %v", err)
			http.Error(w, "Failed to delete logs", http.StatusInternalServerError)
			return
		}

		// Send notification that all logs have been deleted
		hub.broadcast <- &LogEntry{
			ID:        -1, // Use a special ID to indicate this is a system message
			Timestamp: time.Now(),
			Level:     nil,
			Message:   nil,
			Metadata:  nil,
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "All logs deleted",
		}); err != nil {
			log.Printf("Error encoding delete logs response: %v", err)
			http.Error(w, "Error encoding response", http.StatusInternalServerError)
			return
		}
	}
}

// parseInt parses an integer from a string with bounds checking
func parseInt(s string, min, max int) (int, error) {
	val, err := parseInt64(s, int64(min), int64(max))
	return int(val), err
}

// parseInt64 parses an int64 from a string with bounds checking
func parseInt64(s string, min, max int64) (int64, error) {
	i, err := json.Number(s).Int64()
	if err != nil {
		return 0, fmt.Errorf("invalid integer: %w", err)
	}
	if i < min {
		return 0, fmt.Errorf("value %d is below minimum %d", i, min)
	}
	if i > max {
		return 0, fmt.Errorf("value %d is above maximum %d", i, max)
	}
	return i, nil
}
