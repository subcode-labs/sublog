package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	_ "github.com/mattn/go-sqlite3" // SQLite driver
)

var db *sql.DB

const createTableSQL = `
CREATE TABLE IF NOT EXISTS logs (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
	level TEXT,
	message TEXT,
	metadata TEXT
);
-- Add indexes for frequent filtering
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs (timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs (level);
`

// LogEntry represents the structure of a log message for storage and transmission.
// Use pointers for optional fields that might be null/missing.
type LogEntry struct {
	ID        int64     `json:"id"`
	Timestamp time.Time `json:"timestamp"`
	Level     *string   `json:"level"`
	Message   *string   `json:"message"`
	Metadata  *string   `json:"metadata"` // Store metadata as a JSON string
}

// WinstonLog represents the expected structure from Winston HTTP transport.
// Be flexible with types as Winston can be configured.
type WinstonLog struct {
	Level     *string                `json:"level"`
	Message   *string                `json:"message"`
	Meta      map[string]interface{} `json:"meta"`      // Capture arbitrary metadata
	Timestamp *string                `json:"timestamp"` // Winston might send string timestamp
}

func initDB(dataSourceName string) error {
	var err error
	// Ensure the directory exists (useful if path is configurable)
	// os.MkdirAll(filepath.Dir(dataSourceName), 0755) // Consider adding this if path is dynamic

	db, err = sql.Open("sqlite3", dataSourceName)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	if _, err = db.Exec(createTableSQL); err != nil {
		return fmt.Errorf("failed to create table: %w", err)
	}

	log.Println("Database initialized successfully")
	return nil
}

// addLogEntry inserts a log entry into the database and returns the full entry with ID/Timestamp.
func addLogEntry(entry WinstonLog) (*LogEntry, error) {
	// Attempt to parse timestamp from Winston, default to now if missing/invalid
	var ts time.Time
	if entry.Timestamp != nil {
		// Try common formats, add more if needed
		parsedTs, err := time.Parse(time.RFC3339Nano, *entry.Timestamp)
		if err != nil {
			// Fallback or log error, here we just default to Now()
			ts = time.Now().UTC()
			log.Printf("Warning: Could not parse timestamp '%s', using current time. Error: %v", *entry.Timestamp, err)
		} else {
			ts = parsedTs.UTC()
		}
	} else {
		ts = time.Now().UTC()
	}

	metadataJSON := "{}" // Default empty JSON object
	if entry.Meta != nil && len(entry.Meta) > 0 {
		metaBytes, err := json.Marshal(entry.Meta)
		if err == nil {
			metadataJSON = string(metaBytes)
		} else {
			log.Printf("Warning: Could not marshal metadata: %v", err)
		}
	}
	metadataStr := metadataJSON // Assign to pointer type later if needed

	// Handle potential nil pointers for level and message
	level := ""
	if entry.Level != nil {
		level = *entry.Level
	}
	message := ""
	if entry.Message != nil {
		message = *entry.Message
	}

	res, err := db.Exec("INSERT INTO logs (timestamp, level, message, metadata) VALUES (?, ?, ?, ?)",
		ts, level, message, metadataStr)
	if err != nil {
		return nil, fmt.Errorf("failed to insert log: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	// Create the full LogEntry to return/broadcast
	fullEntry := &LogEntry{
		ID:        id,
		Timestamp: ts,
		Level:     &level,
		Message:   &message,
		Metadata:  &metadataStr,
	}

	return fullEntry, nil
}

// getRecentLogs retrieves recent log entries from the database up to the specified limit.
func getRecentLogs(limit int) ([]*LogEntry, error) {
	if limit <= 0 {
		limit = 100 // Default limit
	}

	rows, err := db.Query("SELECT id, timestamp, level, message, metadata FROM logs ORDER BY timestamp DESC LIMIT ?", limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query logs: %w", err)
	}
	defer rows.Close()

	var logs []*LogEntry
	for rows.Next() {
		entry := &LogEntry{}
		var timestamp string
		var level, message, metadata string

		err := rows.Scan(&entry.ID, &timestamp, &level, &message, &metadata)
		if err != nil {
			return nil, fmt.Errorf("failed to scan log entry: %w", err)
		}

		// Parse timestamp
		ts, err := time.Parse("2006-01-02 15:04:05.999999999-07:00", timestamp)
		if err != nil {
			// Try another format (SQLite might store it differently)
			ts, err = time.Parse("2006-01-02 15:04:05.999999999Z07:00", timestamp)
			if err != nil {
				// As a last resort, try RFC3339
				ts, err = time.Parse(time.RFC3339Nano, timestamp)
				if err != nil {
					log.Printf("Warning: Could not parse timestamp '%s', using current time", timestamp)
					ts = time.Now()
				}
			}
		}
		entry.Timestamp = ts
		entry.Level = &level
		entry.Message = &message
		entry.Metadata = &metadata

		logs = append(logs, entry)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating log rows: %w", err)
	}

	return logs, nil
}

// getTotalLogCount returns the total number of logs in the database.
func getTotalLogCount() (int, error) {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM logs").Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count logs: %w", err)
	}
	return count, nil
}

// deleteAllLogs deletes all logs from the database.
func deleteAllLogs() error {
	_, err := db.Exec("DELETE FROM logs")
	if err != nil {
		return fmt.Errorf("failed to delete logs: %w", err)
	}
	return nil
}
