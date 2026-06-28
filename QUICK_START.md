# ⚡ Quick Start Guide

## 🚀 Start Everything (30 seconds)

### One-Click Start (Easiest)
```bash
start-all.bat
```

### Manual Start
```bash
# Terminal 1 - Backend
cd server
npm install  # First time only
npm start

# Terminal 2 - Frontend
cd client
npm install  # First time only
npm run dev
```

---

## ✅ Verify It Works

1. **Backend:** http://localhost:3001/api/health → Should show `{"status":"ok"}`
2. **Frontend:** http://localhost:5173 → Should load homepage with data

---

## 🎨 What Got Fixed

### 1. Design - No More Cards
- ✅ Removed ALL rounded corners
- ✅ Quest board aesthetic (Stardew Valley inspired)
- ✅ Pixel-art style with drop shadows
- ✅ Wood grain panels, parchment cards

**Main file:** `client/src/styles/no-cards.css`

### 2. Backend Connection
- ✅ Easy startup with `start-all.bat`
- ✅ Status checker: `check-backend.bat`

---

## 🐛 Troubleshooting

### Port 3001 busy?
```bash
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Module errors?
```bash
cd server
rm -rf node_modules
npm install
```

### No data loading?
Check `server/.env` exists with valid Firebase/Gemini credentials

---

## 📁 Key Files

- `client/src/styles/no-cards.css` - Design overrides
- `server/.env` - Backend credentials (REQUIRED)
- `start-all.bat` - Auto-start script
- `check-backend.bat` - Status checker

---

## 📖 More Info

- **DESIGN_IMPROVEMENTS.md** - Complete design guide
- **README_FIRST.txt** - Ultra-quick reference
