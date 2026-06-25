# SENTINEL-CIVIC

A full-stack hyperlocal problem-solving platform enabling citizens to identify, report, validate, track, and resolve community issues. The project uses Google Gemini API for intelligent multimodal categorization, Google Maps for geographic intelligence, and advanced mathematical forecasting models to predict infrastructural failures and optimize priority.

---

## Key Features

1. **AI-Powered Issue Categorization**: Multimodal classification of image and video reports using Google Gemini.
2. **Geo-location & Mapping**: Interactive mapping centered in Lucknow, Uttar Pradesh.
3. **Dynamic Priority Engine**: A 5-term prioritization formula balancing severity, community votes, reports volume, SLA urgency, and safety risk.
4. **Predictive Insights**: Weibull survival analysis to forecast recurrence risk of civic failures in each ward.
5. **Gamification Hub**: Citizen rewards system with XP points and custom badge awards to incentivize accurate verification.
6. **Animated Agent Trace**: A live visualization showing the autonomous agent's exact decision steps and tool executions.

---

## Math Engine & Formulas

### 1. Composite Distance Metric (DBSCAN)
Used to cluster reports and identify duplicates:
$$d(p_1, p_2) = \alpha \cdot d_{haversine}(p_1, p_2) + \beta \cdot |t_1 - t_2| + \gamma \cdot (1 - \text{sim}_{cat}(p_1, p_2))$$
Where:
* $\alpha = 0.4$ (spatial distance weight)
* $\beta = 0.35$ (temporal distance weight)
* $\gamma = 0.25$ (category similarity weight)

### 2. Dynamic Priority Score
Blends five parameters to assign a priority score between 0 and 100:
$$\text{Priority} = w_1 \cdot S_{vis} + w_2 \cdot \log(1 + N_{reports}) + w_3 \cdot \frac{V_{up} - V_{down}}{V_{up} + V_{down} + 1} + w_4 \cdot \frac{\Delta t_{elapsed}}{\Delta t_{SLA}} + w_5 \cdot R_{safety}$$

### 3. Weibull SLA Probability
Estimates probability of resolution before the SLA deadline:
$$P(\text{resolved by } t) = 1 - e^{-(t/\lambda)^k}$$

### 4. Recurrence-Risk Survival Model
Models the hazard rate of new reports appearing within each ward:
$$h(t \mid \text{ward}, \text{category}) = \frac{k}{\lambda}\left(\frac{t}{\lambda}\right)^{k-1}$$

---

## Technology Stack

* **Frontend**: React (Vite), React Router, Chart.js
* **Backend**: Node.js, Express, Server-Sent Events (SSE)
* **AI/Vision**: Google Gemini API, Cloud Vision API
* **Database**: Firestore (with zero-config in-memory mock fallback)

---

## Setup & Running

### Environment Variables
Create a `.env` file in the root or set variables in your environment:
```env
PORT=3001
CLIENT_URL=http://localhost:5173
NODE_ENV=development

# Optional Google / Firebase credentials (falls back to mock/free configurations automatically)
GEMINI_API_KEY=your_gemini_api_key
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

### Installation

1. Install backend dependencies:
   ```bash
   cd server
   npm install
   ```

2. Install frontend dependencies:
   ```bash
   cd ../client
   npm install
   ```

### Running the Application

1. Start the API backend:
   ```bash
   cd server
   npm run dev
   ```

2. Start the Vite React client:
   ```bash
   cd client
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:5173`.

---

## Running Unit Tests

Run the math engine unit tests (covering Haversine, DBSCAN, Priority, Weibull, and Recurrence Risk calculations):
```bash
cd server
npm test
```
