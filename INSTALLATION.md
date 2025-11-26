# NEXUS Installation Guide

Complete step-by-step instructions to get your NEXUS application running.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

1. **Node.js** (version 18 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`
   - Should show v18.x.x or higher

2. **npm** (comes with Node.js) or **yarn**
   - Verify npm: `npm --version`
   - Or install yarn: `npm install -g yarn`

3. **Git** (optional, for version control)
   - Download from: https://git-scm.com/

### Recommended Tools

- **VS Code** - https://code.visualstudio.com/
- **VS Code Extensions**:
  - ESLint
  - Tailwind CSS IntelliSense
  - ES7+ React/Redux/React-Native snippets

## 🚀 Installation Steps

### Step 1: Extract Project Files

Extract the NEXUS project folder to your desired location:

```bash
# Example locations:
# Windows: C:\Projects\nexus-app
# Mac/Linux: ~/Projects/nexus-app
```

### Step 2: Open Terminal/Command Prompt

Navigate to the project directory:

```bash
cd path/to/nexus-app
```

### Step 3: Install Dependencies

Run one of the following commands:

```bash
# Using npm
npm install

# OR using yarn
yarn install
```

**This will install all required packages** (~5-10 minutes depending on your internet speed)

Expected output:
```
added XXX packages, and audited XXX packages in XXs
```

### Step 4: Configure Environment

1. Copy the example environment file:

```bash
# Windows (Command Prompt)
copy .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env

# Mac/Linux
cp .env.example .env
```

2. Edit `.env` file (optional for development):

```env
# For development - skip email verification
VITE_SKIP_EMAIL_VERIFICATION=true

# For production - enable email verification
# VITE_SKIP_EMAIL_VERIFICATION=false
```

### Step 5: Start Development Server

```bash
# Using npm
npm run dev

# OR using yarn
yarn dev
```

Expected output:
```
  VITE v5.0.11  ready in 500 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### Step 6: Open in Browser

The application should automatically open in your default browser at:
```
http://localhost:3000
```

If it doesn't open automatically, manually navigate to the URL above.

## ✅ Verify Installation

You should see the NEXUS login/register screen with:
- Dark background with animated gradients
- "NEXUS" logo in the top-left
- Login and Register buttons

### Test the Application

1. **Create a test account**:
   - Click "Register"
   - Enter email: `test@example.com`
   - Enter username: `testuser`
   - Enter password: `Password123` (or any password meeting requirements)
   - Confirm password
   - Click "Create Account"

2. **Verify you're logged in**:
   - You should be redirected to the Dashboard
   - You'll see "MY CLUBS" page
   - No clubs initially (this is expected)

3. **Access Dev Tools** (if you're an Admin):
   - Look for "🔧 Dev Tools" button in bottom-right corner
   - This provides quick testing utilities

## 🔧 Troubleshooting

### Issue: Dependencies won't install

**Error**: `npm ERR! code ERESOLVE`

**Solution**:
```bash
npm install --legacy-peer-deps
```

### Issue: Port 3000 is already in use

**Error**: `Port 3000 is in use`

**Solution 1** - Use a different port:
```bash
# Edit vite.config.js and change port to 3001, 3002, etc.
```

**Solution 2** - Kill the process using port 3000:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

### Issue: Blank white screen

**Causes**:
- JavaScript error in browser console
- Missing dependencies

**Solutions**:
1. Open browser DevTools (F12) and check Console tab for errors
2. Try clearing browser cache (Ctrl+Shift+Delete)
3. Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: Styles not loading

**Symptom**: Plain HTML without styling

**Solution**:
```bash
# Rebuild Tailwind CSS
npm run dev
```

If issue persists:
```bash
# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

### Issue: "Module not found" errors

**Solution**:
Verify all files are present in `src/` directory:
```
src/
├── api/
├── components/
├── contexts/
├── data/
├── pages/
├── utils/
├── App.jsx
├── index.css
└── main.jsx
```

If files are missing, re-extract the project archive.

## 🌍 Building for Production

When ready to deploy:

### Step 1: Build the project

```bash
npm run build
# or
yarn build
```

This creates optimized files in the `dist/` folder.

### Step 2: Preview the production build

```bash
npm run preview
# or
yarn preview
```

### Step 3: Deploy

Upload the contents of the `dist/` folder to your web hosting service:
- Netlify
- Vercel
- AWS S3 + CloudFront
- GitHub Pages
- Any static hosting service

**Important**: Make sure to:
1. Set `VITE_SKIP_EMAIL_VERIFICATION=false` for production
2. Configure environment variables in your hosting platform
3. Set up a real backend API (current version uses localStorage)

## 📱 Mobile Development

To test on mobile devices on the same network:

### Step 1: Find your computer's IP address

```bash
# Windows
ipconfig

# Mac/Linux
ifconfig
# or
ip addr show
```

Look for your local IP (usually 192.168.x.x)

### Step 2: Start dev server with network access

```bash
npm run dev -- --host
# or
yarn dev --host
```

### Step 3: Access from mobile

On your mobile device, navigate to:
```
http://YOUR_IP_ADDRESS:3000
```

Example: `http://192.168.1.100:3000`

## 🎓 Next Steps

Now that you have NEXUS running:

1. **Read the README.md** for full feature documentation
2. **Explore the UI** and test different user roles
3. **Use Dev Helper** (Admin only) to create test data quickly
4. **Check the Project Structure** in README.md to understand the codebase
5. **Start customizing** for your specific needs

## 📚 Additional Resources

- **React Documentation**: https://react.dev/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **React Router**: https://reactrouter.com/
- **React Query**: https://tanstack.com/query/latest

## 🆘 Getting Help

If you encounter issues not covered here:

1. Check browser console for errors (F12 → Console tab)
2. Check terminal/command prompt for build errors
3. Review the code comments in the source files
4. Ensure all dependencies are installed correctly

## 🎉 Success Checklist

- [ ] Node.js 18+ installed
- [ ] Dependencies installed (`node_modules` folder exists)
- [ ] `.env` file created
- [ ] Development server running (`npm run dev`)
- [ ] Application opens in browser
- [ ] Can create and login with test account
- [ ] Dashboard loads successfully

If all checks pass - congratulations! You're ready to use NEXUS! 🚀

---

**Happy coding!** If you need to restart the development server at any time, press `Ctrl+C` in the terminal, then run `npm run dev` again.
