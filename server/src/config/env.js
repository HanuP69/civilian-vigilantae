import 'dotenv/config';

/**
 * @typedef {Object} AppConfig
 * @property {number}  port               - HTTP server port
 * @property {string}  nodeEnv            - Runtime environment (development | production | test)
 * @property {string}  clientUrl          - Allowed CORS origin for the frontend
 * @property {string}  llmBackend         - Active LLM provider ('gemini' | 'ollama')
 * @property {string}  geminiApiKey       - Google Gemini API key
 * @property {string}  googleMapsApiKey   - Google Maps Platform API key
 * @property {string}  firebaseProjectId  - Firebase project identifier
 * @property {string}  firebaseClientEmail - Firebase service-account email
 * @property {string}  firebasePrivateKey  - Firebase service-account private key (PEM)
 * @property {string}  firebaseStorageBucket - Cloud Storage bucket name
 * @property {string}  ollamaBaseUrl      - Ollama REST API base URL
 * @property {string}  ollamaModel        - Default Ollama model name
 */

const normalizePrivateKey = (value = '') => {
  if (!value) return '';
  return value
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n');
};

/** @type {AppConfig} */
const config = Object.freeze({
  // Server
  port:                 parseInt(process.env.PORT, 10) || 3001,
  nodeEnv:              process.env.NODE_ENV            || 'development',
  clientUrl:            process.env.CLIENT_URL           || 'http://localhost:5173',

  // LLM
  llmBackend:           process.env.LLM_BACKEND          || 'ollama',

  // Gemini
  geminiApiKey:         process.env.GEMINI_API_KEY        || '',

  // Google Maps
  googleMapsApiKey:     process.env.GOOGLE_MAPS_API_KEY   || '',

  // Firebase
  firebaseProjectId:    process.env.FIREBASE_PROJECT_ID       || '',
  firebaseClientEmail:  process.env.FIREBASE_CLIENT_EMAIL     || '',
  firebasePrivateKey:   normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET  || '',

  // Ollama
  ollamaBaseUrl:        process.env.OLLAMA_BASE_URL       || 'http://localhost:11434',
  ollamaModel:          process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct-q4_K_M',
});

export default config;
