# _sublog Log Generators

This project includes two log generators to help you test _sublog. You can use either one depending on your preference or environment.

## Comparison

| Feature | Node.js Version | Python Version |
|---------|----------------|---------------|
| File | `log-generator.js` | `log_generator.py` |
| Requirements | Node.js 14+ | Python 3.6+, requests library |
| Command Line Options | ✅ Yes | ✅ Yes |
| Colored Output | ✅ Yes | ✅ Yes |
| Random Log Generation | ✅ Yes | ✅ Yes |
| Weighted Log Levels | ✅ Yes | ✅ Yes |
| Batch Sending | ✅ Yes | ✅ Yes |
| Timed Execution | ✅ Yes | ✅ Yes |

## Which One Should I Use?

- **Node.js Version**: If you already have Node.js installed or are more comfortable with JavaScript
- **Python Version**: If you prefer Python or don't have Node.js installed

Both generators have the same features and produce similar log entries. They can be used interchangeably to test Sublog.

## Quick Start

### Node.js Version

```bash
# Make executable
chmod +x log-generator.js

# Run with default settings
./log-generator.js

# See available options
./log-generator.js --help
```

### Python Version

```bash
# Install required dependency
pip install requests

# Make executable
chmod +x log_generator.py

# Run with default settings
./log_generator.py

# See available options
./log_generator.py --help
```

## Documentation

Each generator has its own detailed README file:

- Node.js: [log-generator-README.md](log-generator-README.md)
- Python: [log_generator_python_README.md](log_generator_python_README.md)

## Examples

Both generators can be used with similar commands and options:

```bash
# Send 10 logs every 500ms for 1 minute
./log-generator.js --batch-size 10 --interval 500 --run-time 60
./log_generator.py --batch-size 10 --interval 0.5 --run-time 60

# Send to a custom host and port
./log-generator.js --host 192.168.0.100 --port 9000
./log_generator.py --host 192.168.0.100 --port 9000
```
