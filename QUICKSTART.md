# NEXUS Quick Start Guide

Get your NEXUS app running in 5 minutes!

## 🚀 Fast Setup (3 Steps)

### 1. Install Dependencies

```bash
cd nexus-app
npm install
```

**Wait time**: ~5-10 minutes (downloads packages)

### 2. Start the App

```bash
npm run dev
```

**Expected output**:
```
VITE v5.0.11  ready in 500 ms
➜  Local:   http://localhost:3000/
```

### 3. Open Browser

Navigate to: **http://localhost:3000**

## ✨ First Steps

### Create Your First Account

1. Click **"Register"**
2. Enter:
   - Email: `your.email@example.com`
   - Username: `yourname`
   - Password: `Password123` (or your choice - must have uppercase, lowercase, number, 8+ chars)
3. Click **"Create Account"**

You're in! 🎉

### Quick Test with Dev Tools (Admin Only)

If you're logged in as Admin, you'll see a **"🔧 Dev Tools"** button in the bottom-right corner.

**Quick Actions**:
- Create test users instantly
- Generate sample clubs
- Join clubs with codes
- Reset all data if needed

### Create Your First Club

1. From Dashboard, look for **"Request to Join"** or use Dev Tools to create a club
2. Enter club name
3. Get your unique 6-digit code
4. Share with team members!

## 📚 Need More Help?

- **Full Setup Guide**: See `INSTALLATION.md`
- **Feature Documentation**: See `README.md`
- **What Changed**: See `CHANGES.md`

## 🐛 Trouble?

### Port 3000 Already in Use?

Edit `vite.config.js`, change port to 3001:
```javascript
server: {
  port: 3001  // Changed from 3000
}
```

### Dependencies Won't Install?

Try:
```bash
npm install --legacy-peer-deps
```

### Styles Not Loading?

Clear cache and restart:
```bash
rm -rf node_modules/.vite
npm run dev
```

## 🎯 Quick Tips

- **Development mode**: Email verification is skipped (configured in `.env`)
- **Test users**: Use Dev Tools to create accounts instantly
- **Data persistence**: Uses localStorage (data stays until you clear browser cache)
- **Mobile testing**: Access from phone using your computer's IP address

## 📞 Support

Check console (F12) for errors if something doesn't work!

---

**Happy building!** 🏆

Now go to `README.md` for the full feature list and capabilities!
