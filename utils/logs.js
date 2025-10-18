const fs = require("fs");
const path = require("path");

// Check if we're in a read-only environment (like Vercel)
const isReadOnlyEnvironment = process.env.VERCEL || process.env.NODE_ENV === 'production';

const LOG_PATH = path.resolve(__dirname, "logs.json");

// In-memory logs storage for read-only environments
let inMemoryLogs = [];

function loadLogs() {
  try {
    // In read-only environments, use in-memory storage
    if (isReadOnlyEnvironment) {
      return inMemoryLogs;
    }
    
    if (!fs.existsSync(LOG_PATH)) return [];
    const content = fs.readFileSync(LOG_PATH, "utf8").trim();
    if (!content) return [];
    return JSON.parse(content);
  } catch (e) {
    console.error("Failed to load logs.json:", e);
    return isReadOnlyEnvironment ? inMemoryLogs : [];
  }
}

function saveLogs(logs) {
  try {
    // In read-only environments, store in memory
    if (isReadOnlyEnvironment) {
      inMemoryLogs = logs;
      return;
    }
    
    fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2));
  } catch (e) {
    console.error("Failed to write logs.json:", e);
    // Fallback to in-memory storage if file write fails
    if (!isReadOnlyEnvironment) {
      inMemoryLogs = logs;
    }
  }
}

const insertLog = async ({
  level,
  message,
  userId = null,
  requestMethod = null,
  requestUrl = null,
  additionalData = null,
  errorDetails = null,
  requestResponse = null
} = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    user_id: userId,
    request_method: requestMethod,
    request_url: requestUrl,
    additional_data: additionalData ?? null,
    error_details: errorDetails ?? null,
    request_response: requestResponse ?? null
  };

  const logs = loadLogs();

  logs.unshift(logEntry);
  saveLogs(logs);
};

const getLogs = () => loadLogs();

module.exports = { insertLog, getLogs };
