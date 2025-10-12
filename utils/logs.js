const fs = require("fs");
const path = require("path");

const LOG_PATH = path.resolve(__dirname, "logs.json");

function loadLogs() {
  try {
    if (!fs.existsSync(LOG_PATH)) return [];
    const content = fs.readFileSync(LOG_PATH, "utf8").trim();
    if (!content) return [];
    return JSON.parse(content);
  } catch (e) {
    console.error("Failed to load logs.json:", e);
    return [];
  }
}

function saveLogs(logs) {
  try {
    fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2));
  } catch (e) {
    console.error("Failed to write logs.json:", e);
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
