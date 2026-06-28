╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║            🚀 COMMUNITY HERO - QUICK START 🚀                ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

HOW TO START (10 seconds):

  1. Double-click: start-all.bat
  2. Wait 10 seconds
  3. Open: http://localhost:5173
  4. Done! ✅

════════════════════════════════════════════════════════════════

WHAT IS THIS?

Your app has 2 parts:
  • Backend (server)  → Port 3001 → API & Database
  • Frontend (client) → Port 5173 → User Interface

Both MUST run for the app to work!

════════════════════════════════════════════════════════════════

MANUAL START:

Terminal 1:
  cd server
  npm install  (first time only)
  npm start

Terminal 2:
  cd client
  npm install  (first time only)
  npm run dev

════════════════════════════════════════════════════════════════

VERIFY IT'S WORKING:

1. Backend: http://localhost:3001/api/health
   Should show: {"status":"ok"}

2. Frontend: http://localhost:5173
   Should show: Homepage with data loading

════════════════════════════════════════════════════════════════

TROUBLESHOOTING:

Problem: Port 3001 busy
Fix: netstat -ano | findstr :3001
     taskkill /PID <PID> /F

Problem: Module errors
Fix: cd server && rm -rf node_modules && npm install

Problem: No data loading
Fix: Check server/.env file exists with valid credentials

════════════════════════════════════════════════════════════════

DESIGN NOTES:

✨ Quest board aesthetic (Stardew Valley inspired)
✨ No rounded corners (pixel-art style)
✨ All styling in: client/src/styles/no-cards.css
✨ Dynamic background reacts to community health

════════════════════════════════════════════════════════════════

IMPORTANT FILES:

📁 server/.env           → Backend credentials (REQUIRED)
📁 start-all.bat         → Auto-start script
📁 check-backend.bat     → Status checker
📁 QUICK_START.md        → Detailed reference
📁 DESIGN_IMPROVEMENTS.md → Design guide

════════════════════════════════════════════════════════════════

Good luck! 🎮
