# Sentinel Civic

Sentinel Civic is a hyperlocal community issue tracker and resolution platform powered by AI. It uses the Gemini API and Cloud Vision to classify citizen reports, deduplicate issues using DBSCAN clustering, and predict SLAs.

## Features
- **AI Agent Orchestration**: A multi-tool agent running on Gemini processes tickets autonomously.
- **DBSCAN Clustering**: Clusters duplicate reports based on geo-location (Haversine distance) and time.
- **SLA Prediction**: Weibull MLE calculates breach probabilities for issue resolution.
- **Leaflet Integration**: An elegant map interface for visualizing civic issues.
- **Security & Scalability**: Firebase Storage integration, Bearer authentication, and rate limiting.

## Quick Start

### 1. Server
```sh
cd server
npm install
npm run dev
```

### 2. Client
```sh
cd client
npm install
npm run dev
```

## Environment Variables
Create a `.env` in the `server` directory:
```
GEMINI_API_KEY=your_key
PORT=3001
CLIENT_URL=http://localhost:3000
```
