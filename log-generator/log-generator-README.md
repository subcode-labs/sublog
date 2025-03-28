# Sublog Log Generator

A simple Node.js script to generate random log entries and send them to Sublog.

## Requirements

- Node.js 14+ installed

## Usage

```bash
# Basic usage (sends 1 log entry per second to localhost:8080)
./log-generator.js

# Send 5 logs every 2 seconds for 30 seconds
./log-generator.js --batch-size 5 --interval 2000 --run-time 30

# Send logs to a custom host and port
./log-generator.js --host 192.168.1.100 --port 8888

# Show help
./log-generator.js --help
```

## Options

- `--host <host>`: Host to send logs to (default: localhost)
- `--port <port>`: Port to send logs to (default: 8080)
- `--interval <ms>`: Interval between log batches in milliseconds (default: 1000)
- `--batch-size <size>`: Number of logs to send in each batch (default: 1)
- `--run-time <seconds>`: How long to run in seconds (default: 0 = indefinitely)
- `--help`: Display help message

## Log Types

The generator creates various types of log entries with different log levels:

- **debug**: System metrics, database queries, etc.
- **info**: User logins, order creations, etc.
- **warn**: Failed login attempts, rate limit warnings, etc.
- **error**: Service failures, database errors, etc.

Each log contains:

- A message based on templates
- Random metadata appropriate to the message type
- Timestamp
- Log level

## Examples

Here are some examples of the generated logs:

```log
[INFO] User user-1234 logged in from 192.168.1.105
[DEBUG] Database query took 125ms
[WARN] Rate limit exceeded for API key api-a7b2c9d8
[ERROR] Database connection failed: Connection timeout
```
