#!/usr/bin/env node

const http = require('http');

// Configuration
const config = {
  host: 'localhost',
  port: 8080,
  endpoint: '/logs',
  intervalMs: 1000, // Send logs every second
  batchSize: 1,     // Number of logs to send in each batch
  runTime: 0,       // How long to run in seconds (0 = indefinitely)
};

// Log level definitions with colors
const levels = [
  { name: 'debug', color: '\x1b[34m', weight: 40 }, // blue
  { name: 'info', color: '\x1b[32m', weight: 30 },  // green
  { name: 'warn', color: '\x1b[33m', weight: 20 },  // yellow
  { name: 'error', color: '\x1b[31m', weight: 10 }, // red
];

// Message templates
const messageTemplates = [
  { template: 'User {userId} logged in from {ip}', level: 'info' },
  { template: 'Failed login attempt for user {userId} from {ip}', level: 'warn' },
  { template: 'Database query took {queryTime}ms', level: 'debug' },
  { template: 'API request to {endpoint} completed in {responseTime}ms', level: 'info' },
  { template: 'Memory usage at {memoryUsage}MB', level: 'debug' },
  { template: 'CPU usage at {cpuUsage}%', level: 'debug' },
  { template: 'Cache hit ratio: {cacheHitRatio}%', level: 'debug' },
  { template: 'New order #{orderId} created for customer {customerId}', level: 'info' },
  { template: 'Payment of ${amount} received for order #{orderId}', level: 'info' },
  { template: 'Shipment #{shipmentId} dispatched to {address}', level: 'info' },
  { template: 'Rate limit exceeded for API key {apiKey}', level: 'warn' },
  { template: 'Invalid request parameters: {params}', level: 'warn' },
  { template: 'Permission denied for user {userId} accessing {resource}', level: 'warn' },
  { template: 'Database connection failed: {error}', level: 'error' },
  { template: 'Unhandled exception in {service}: {errorMessage}', level: 'error' },
  { template: 'Service {serviceName} is unresponsive', level: 'error' },
  { template: 'Failed to process transaction #{transactionId}: {reason}', level: 'error' },
];

// Generate a random integer between min and max (inclusive)
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Get random item from an array
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Get a random weighted log level (more info/debug than error)
function getRandomLogLevel() {
  const totalWeight = levels.reduce((sum, level) => sum + level.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const level of levels) {
    if (random < level.weight) {
      return level.name;
    }
    random -= level.weight;
  }
  
  return 'info'; // Default fallback
}

// Generate a random IP address
function getRandomIP() {
  return `${getRandomInt(1, 255)}.${getRandomInt(0, 255)}.${getRandomInt(0, 255)}.${getRandomInt(0, 255)}`;
}

// Replace placeholders in a template with random values
function fillTemplate(template) {
  return template.replace(/{(\w+)}/g, (match, key) => {
    switch (key) {
      case 'userId':
      case 'customerId':
        return `user-${getRandomInt(1000, 9999)}`;
      case 'ip':
        return getRandomIP();
      case 'queryTime':
      case 'responseTime':
        return getRandomInt(1, 500);
      case 'memoryUsage':
        return getRandomInt(100, 8000);
      case 'cpuUsage':
        return getRandomInt(5, 95);
      case 'cacheHitRatio':
        return getRandomInt(60, 100);
      case 'orderId':
      case 'shipmentId':
      case 'transactionId':
        return getRandomInt(10000, 99999);
      case 'amount':
        return (getRandomInt(100, 10000) / 100).toFixed(2);
      case 'address':
        return `${getRandomInt(1, 999)} Main St, Anytown, ST ${getRandomInt(10000, 99999)}`;
      case 'apiKey':
        return `api-${Math.random().toString(36).substring(2, 10)}`;
      case 'params':
        return `missing required field: ${getRandomItem(['email', 'name', 'password', 'address', 'phone'])}`;
      case 'resource':
        return `/${getRandomItem(['users', 'orders', 'products', 'settings', 'admin'])}/${getRandomInt(1, 9999)}`;
      case 'error':
        return getRandomItem(['Connection timeout', 'Connection refused', 'Too many connections', 'Auth failure']);
      case 'service':
      case 'serviceName':
        return getRandomItem(['AuthService', 'PaymentProcessor', 'InventoryManager', 'EmailService']);
      case 'errorMessage':
        return getRandomItem([
          'NullReferenceException', 
          'OutOfMemoryException', 
          'IndexOutOfRangeException',
          'Cannot read property of undefined'
        ]);
      case 'reason':
        return getRandomItem([
          'Insufficient funds', 
          'Card declined', 
          'Expired card',
          'Gateway timeout'
        ]);
      case 'endpoint':
        return `/${getRandomItem(['api', 'auth', 'users', 'orders', 'products'])}/${getRandomItem(['create', 'update', 'delete', 'get'])}`;
      default:
        return match;
    }
  });
}

// Generate a random log entry
function generateLogEntry() {
  // Sometimes use random level, sometimes use the level associated with the message
  const useTemplateLevel = Math.random() > 0.3;
  const messageTemplate = getRandomItem(messageTemplates);
  
  // Generate level based on strategy
  const level = useTemplateLevel ? messageTemplate.level : getRandomLogLevel();
  
  // Fill in the message template with random values
  const message = fillTemplate(messageTemplate.template);
  
  // Generate some random metadata
  const meta = {
    timestamp: new Date().toISOString(),
    requestId: `req-${Math.random().toString(36).substring(2, 15)}`,
    sessionId: `sess-${Math.random().toString(36).substring(2, 10)}`,
  };
  
  // Add some additional random metadata based on the message type
  if (message.includes('logged in') || message.includes('login attempt')) {
    meta.browser = getRandomItem(['Chrome', 'Firefox', 'Safari', 'Edge']);
    meta.platform = getRandomItem(['Windows', 'macOS', 'Linux', 'iOS', 'Android']);
  } else if (message.includes('Database')) {
    meta.dbInstance = getRandomItem(['primary', 'replica-1', 'replica-2']);
    meta.queryId = `q-${Math.random().toString(36).substring(2, 10)}`;
  } else if (message.includes('order')) {
    meta.orderItems = getRandomInt(1, 10);
    meta.totalValue = parseFloat((getRandomInt(1000, 100000) / 100).toFixed(2));
  }
  
  return {
    level,
    message,
    meta,
    timestamp: new Date().toISOString()
  };
}

// Generate a batch of log entries
function generateLogBatch(size = 1) {
  const batch = [];
  for (let i = 0; i < size; i++) {
    batch.push(generateLogEntry());
  }
  return batch;
}

// Send logs to the server
function sendLogs(logs) {
  return new Promise((resolve, reject) => {
    // Prepare the request options
    const options = {
      hostname: config.host,
      port: config.port,
      path: config.endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    // Create the request
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ Sent ${logs.length} logs successfully.`);
          try {
            const response = JSON.parse(data);
            console.log(`   Server processed ${response.processed_count} of ${response.received_count} logs.`);
            resolve(response);
          } catch (e) {
            console.log(`   Response: ${data}`);
            resolve(data);
          }
        } else {
          console.error(`❌ Error: Server responded with status code ${res.statusCode}`);
          console.error(`   Response: ${data}`);
          reject(new Error(`HTTP error ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`❌ Error sending logs: ${error.message}`);
      reject(error);
    });
    
    // Send the request with the log data
    const postData = logs.length === 1 ? logs[0] : logs;
    req.write(JSON.stringify(postData));
    req.end();
    
    // Log what we're sending
    logs.forEach(log => {
      const levelColor = levels.find(l => l.name === log.level)?.color || '';
      console.log(`${levelColor}[${log.level.toUpperCase()}]\x1b[0m ${log.message}`);
    });
  });
}

// Main function to run the log generator
async function runLogGenerator() {
  console.log(`🚀 Starting log generator - sending to http://${config.host}:${config.port}${config.endpoint}`);
  console.log(`📊 Configuration: ${config.batchSize} logs every ${config.intervalMs}ms`);
  
  if (config.runTime > 0) {
    console.log(`⏱️  Will run for ${config.runTime} seconds`);
    setTimeout(() => {
      console.log('⏹️  Shutting down log generator');
      clearInterval(interval);
      process.exit(0);
    }, config.runTime * 1000);
  } else {
    console.log('⏱️  Running indefinitely (Ctrl+C to stop)');
  }
  
  // Set up the interval to send logs
  const interval = setInterval(async () => {
    try {
      const logs = generateLogBatch(config.batchSize);
      await sendLogs(logs);
    } catch (error) {
      console.error(`Error in log generation interval: ${error.message}`);
    }
  }, config.intervalMs);
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--host':
        config.host = args[++i];
        break;
      case '--port':
        config.port = parseInt(args[++i], 10);
        break;
      case '--interval':
        config.intervalMs = parseInt(args[++i], 10);
        break;
      case '--batch-size':
        config.batchSize = parseInt(args[++i], 10);
        break;
      case '--run-time':
        config.runTime = parseInt(args[++i], 10);
        break;
      case '--help':
        console.log(`
Log Generator for Sublog

Options:
  --host <host>           Host to send logs to (default: ${config.host})
  --port <port>           Port to send logs to (default: ${config.port})
  --interval <ms>         Interval between log batches in milliseconds (default: ${config.intervalMs})
  --batch-size <size>     Number of logs to send in each batch (default: ${config.batchSize})
  --run-time <seconds>    How long to run in seconds (default: 0 = indefinitely)
  --help                  Display this help message
        `);
        process.exit(0);
        break;
    }
  }
}

// Start the program
parseArgs();
runLogGenerator().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 