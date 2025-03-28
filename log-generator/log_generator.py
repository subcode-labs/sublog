#!/usr/bin/env python3

import argparse
import json
import random
import time
import datetime
import string
import requests
from typing import Dict, List, Any, Optional, Union

# Configuration defaults
DEFAULT_HOST = "localhost"
DEFAULT_PORT = 8080
DEFAULT_ENDPOINT = "/logs"
DEFAULT_INTERVAL = 1.0  # seconds
DEFAULT_BATCH_SIZE = 1
DEFAULT_RUN_TIME = 0  # indefinitely

# Log level definitions
LEVELS = [
    {"name": "debug", "color": "\033[34m", "weight": 40},  # blue
    {"name": "info", "color": "\033[32m", "weight": 30},   # green
    {"name": "warn", "color": "\033[33m", "weight": 20},   # yellow
    {"name": "error", "color": "\033[31m", "weight": 10},  # red
]

# Message templates
MESSAGE_TEMPLATES = [
    {"template": "User {userId} logged in from {ip}", "level": "info"},
    {"template": "Failed login attempt for user {userId} from {ip}", "level": "warn"},
    {"template": "Database query took {queryTime}ms", "level": "debug"},
    {"template": "API request to {endpoint} completed in {responseTime}ms", "level": "info"},
    {"template": "Memory usage at {memoryUsage}MB", "level": "debug"},
    {"template": "CPU usage at {cpuUsage}%", "level": "debug"},
    {"template": "Cache hit ratio: {cacheHitRatio}%", "level": "debug"},
    {"template": "New order #{orderId} created for customer {customerId}", "level": "info"},
    {"template": "Payment of ${amount} received for order #{orderId}", "level": "info"},
    {"template": "Shipment #{shipmentId} dispatched to {address}", "level": "info"},
    {"template": "Rate limit exceeded for API key {apiKey}", "level": "warn"},
    {"template": "Invalid request parameters: {params}", "level": "warn"},
    {"template": "Permission denied for user {userId} accessing {resource}", "level": "warn"},
    {"template": "Database connection failed: {error}", "level": "error"},
    {"template": "Unhandled exception in {service}: {errorMessage}", "level": "error"},
    {"template": "Service {serviceName} is unresponsive", "level": "error"},
    {"template": "Failed to process transaction #{transactionId}: {reason}", "level": "error"},
]

def get_random_int(min_val: int, max_val: int) -> int:
    """Generate a random integer between min_val and max_val (inclusive)."""
    return random.randint(min_val, max_val)

def get_random_item(items: List[Any]) -> Any:
    """Get a random item from a list."""
    return random.choice(items)

def get_random_log_level() -> str:
    """Get a random weighted log level."""
    total_weight = sum(level["weight"] for level in LEVELS)
    rand_val = random.random() * total_weight
    
    for level in LEVELS:
        if rand_val < level["weight"]:
            return level["name"]
        rand_val -= level["weight"]
    
    return "info"  # Default fallback

def get_random_ip() -> str:
    """Generate a random IP address."""
    return f"{get_random_int(1, 255)}.{get_random_int(0, 255)}.{get_random_int(0, 255)}.{get_random_int(0, 255)}"

def get_random_string(length: int = 8) -> str:
    """Generate a random string of specified length."""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def fill_template(template: str) -> str:
    """Replace placeholders in a template with random values."""
    
    def replace_match(match):
        key = match.group(1)
        if key == "userId" or key == "customerId":
            return f"user-{get_random_int(1000, 9999)}"
        elif key == "ip":
            return get_random_ip()
        elif key == "queryTime" or key == "responseTime":
            return str(get_random_int(1, 500))
        elif key == "memoryUsage":
            return str(get_random_int(100, 8000))
        elif key == "cpuUsage":
            return str(get_random_int(5, 95))
        elif key == "cacheHitRatio":
            return str(get_random_int(60, 100))
        elif key in ["orderId", "shipmentId", "transactionId"]:
            return str(get_random_int(10000, 99999))
        elif key == "amount":
            return f"{get_random_int(100, 10000) / 100:.2f}"
        elif key == "address":
            return f"{get_random_int(1, 999)} Main St, Anytown, ST {get_random_int(10000, 99999)}"
        elif key == "apiKey":
            return f"api-{get_random_string(8)}"
        elif key == "params":
            return f"missing required field: {get_random_item(['email', 'name', 'password', 'address', 'phone'])}"
        elif key == "resource":
            return f"/{get_random_item(['users', 'orders', 'products', 'settings', 'admin'])}/{get_random_int(1, 9999)}"
        elif key == "error":
            return get_random_item(["Connection timeout", "Connection refused", "Too many connections", "Auth failure"])
        elif key in ["service", "serviceName"]:
            return get_random_item(["AuthService", "PaymentProcessor", "InventoryManager", "EmailService"])
        elif key == "errorMessage":
            return get_random_item([
                "NullReferenceException",
                "OutOfMemoryException",
                "IndexOutOfRangeException",
                "Cannot read property of undefined"
            ])
        elif key == "reason":
            return get_random_item([
                "Insufficient funds",
                "Card declined",
                "Expired card",
                "Gateway timeout"
            ])
        elif key == "endpoint":
            return f"/{get_random_item(['api', 'auth', 'users', 'orders', 'products'])}/{get_random_item(['create', 'update', 'delete', 'get'])}"
        else:
            return match.group(0)  # Return the original match if no replacement
    
    import re
    return re.sub(r'\{(\w+)\}', replace_match, template)

def generate_log_entry() -> Dict[str, Any]:
    """Generate a random log entry."""
    # Sometimes use random level, sometimes use the level associated with the message
    use_template_level = random.random() > 0.3
    message_template = get_random_item(MESSAGE_TEMPLATES)
    
    # Generate level based on strategy
    level = message_template["level"] if use_template_level else get_random_log_level()
    
    # Fill in the message template with random values
    message = fill_template(message_template["template"])
    
    # Generate some random metadata
    meta = {
        "timestamp": datetime.datetime.now().isoformat(),
        "requestId": f"req-{get_random_string(12)}",
        "sessionId": f"sess-{get_random_string(8)}",
    }
    
    # Add some additional random metadata based on the message type
    if "logged in" in message or "login attempt" in message:
        meta["browser"] = get_random_item(["Chrome", "Firefox", "Safari", "Edge"])
        meta["platform"] = get_random_item(["Windows", "macOS", "Linux", "iOS", "Android"])
    elif "Database" in message:
        meta["dbInstance"] = get_random_item(["primary", "replica-1", "replica-2"])
        meta["queryId"] = f"q-{get_random_string(8)}"
    elif "order" in message:
        meta["orderItems"] = get_random_int(1, 10)
        meta["totalValue"] = round(get_random_int(1000, 100000) / 100, 2)
    
    return {
        "level": level,
        "message": message,
        "meta": meta,
        "timestamp": datetime.datetime.now().isoformat()
    }

def generate_log_batch(size: int = 1) -> List[Dict[str, Any]]:
    """Generate a batch of log entries."""
    return [generate_log_entry() for _ in range(size)]

def send_logs(logs: List[Dict[str, Any]], host: str, port: int, endpoint: str) -> bool:
    """Send logs to the server."""
    url = f"http://{host}:{port}{endpoint}"
    
    # Prepare the request data - either a single log or an array
    post_data = logs[0] if len(logs) == 1 else logs
    
    try:
        # Send the logs
        response = requests.post(
            url,
            json=post_data,
            headers={"Content-Type": "application/json"}
        )
        
        # Check if the request was successful
        if response.status_code >= 200 and response.status_code < 300:
            print(f"✅ Sent {len(logs)} logs successfully.")
            try:
                response_data = response.json()
                print(f"   Server processed {response_data.get('processed_count', '?')} of {response_data.get('received_count', '?')} logs.")
            except json.JSONDecodeError:
                print(f"   Response: {response.text}")
            return True
        else:
            print(f"❌ Error: Server responded with status code {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except requests.RequestException as e:
        print(f"❌ Error sending logs: {e}")
        return False
    finally:
        # Log what we sent
        for log_entry in logs:
            level = log_entry["level"]
            message = log_entry["message"]
            level_color = next((l["color"] for l in LEVELS if l["name"] == level), "")
            print(f"{level_color}[{level.upper()}]\033[0m {message}")

def run_log_generator(args):
    """Run the log generator with the provided arguments."""
    print(f"🚀 Starting log generator - sending to http://{args.host}:{args.port}{args.endpoint}")
    print(f"📊 Configuration: {args.batch_size} logs every {args.interval}s")
    
    start_time = time.time()
    
    if args.run_time > 0:
        print(f"⏱️  Will run for {args.run_time} seconds")
        end_time = start_time + args.run_time
    else:
        print("⏱️  Running indefinitely (Ctrl+C to stop)")
        end_time = float('inf')
    
    try:
        iteration = 0
        while time.time() < end_time:
            iteration += 1
            logs = generate_log_batch(args.batch_size)
            send_logs(logs, args.host, args.port, args.endpoint)
            
            # Sleep until next interval
            next_time = start_time + (iteration * args.interval)
            sleep_time = max(0, next_time - time.time())
            if sleep_time > 0:
                time.sleep(sleep_time)
    
    except KeyboardInterrupt:
        print("\n⏹️  Log generator stopped by user")
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        return 1
    
    print("⏹️  Log generator finished")
    return 0

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Log Generator for Sublog")
    
    parser.add_argument("--host", default=DEFAULT_HOST,
                        help=f"Host to send logs to (default: {DEFAULT_HOST})")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT,
                        help=f"Port to send logs to (default: {DEFAULT_PORT})")
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT,
                        help=f"Logs endpoint (default: {DEFAULT_ENDPOINT})")
    parser.add_argument("--interval", type=float, default=DEFAULT_INTERVAL,
                        help=f"Interval between log batches in seconds (default: {DEFAULT_INTERVAL})")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE,
                        help=f"Number of logs to send in each batch (default: {DEFAULT_BATCH_SIZE})")
    parser.add_argument("--run-time", type=int, default=DEFAULT_RUN_TIME,
                        help=f"How long to run in seconds (default: {DEFAULT_RUN_TIME} = indefinitely)")
    
    return parser.parse_args()

if __name__ == "__main__":
    args = parse_args()
    exit_code = run_log_generator(args)
    exit(exit_code) 