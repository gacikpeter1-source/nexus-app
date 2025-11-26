# NEXUS Project Structure

## 📁 Complete File Tree

```
nexus-app/
│
├── 📄 README.md                    # Main documentation (comprehensive)
├── 📄 INSTALLATION.md              # Setup instructions (step-by-step)
├── 📄 QUICKSTART.md                # 5-minute quick start
├── 📄 CHANGES.md                   # Transformation details
│
├── ⚙️  package.json                 # Dependencies & scripts
├── ⚙️  vite.config.js               # Build configuration
├── ⚙️  tailwind.config.js           # NEXUS design tokens
├── ⚙️  postcss.config.js            # CSS processing
├── 🔒 .env.example                 # Environment variables template
├── 🔒 .gitignore                   # Git exclusions
├── 🌐 index.html                   # Entry HTML file
│
└── 📂 src/                         # Source code
    │
    ├── 🎨 index.css                # Global styles (NEXUS design system)
    ├── ⚛️  App.jsx                  # Main application component
    ├── ⚛️  main.jsx                 # Application entry point
    │
    ├── 📂 api/                     # Data layer & API
    │   ├── apiClient.js           # Axios HTTP client
    │   ├── localApi.js            # LocalStorage data handlers
    │   ├── mockServer.js          # Mock backend functions
    │   └── teams.js               # Team-specific API calls
    │
    ├── 📂 components/              # Reusable UI components
    │   ├── CreateClub.jsx         # Club creation form
    │   ├── DevHelper.jsx          # Development tools panel
    │   ├── ProtectedRoute.jsx     # Route authentication wrapper
    │   └── TeamCard.jsx           # Team display card
    │
    ├── 📂 contexts/                # React Context providers
    │   ├── AuthContext.jsx        # Authentication & user management
    │   └── ToastContext.jsx       # Toast notification system
    │
    ├── 📂 data/                    # Mock/static data
    │   ├── currentUser.json       # Current user data
    │   ├── events.json            # Sample events
    │   ├── teams.json             # Sample teams
    │   └── users.json             # Sample users
    │
    ├── 📂 pages/                   # Route page components
    │   ├── AdminUsers.jsx         # Admin user management
    │   ├── Calendar.jsx           # Calendar view & event management
    │   ├── ClubManagement.jsx     # Club administration
    │   ├── ClubsDashboard.jsx     # Main dashboard (transformed ✨)
    │   ├── CompleteRegistration.jsx # Registration completion
    │   ├── Event.jsx              # Single event detail view
    │   ├── Login.jsx              # Login page
    │   ├── NewEvent.jsx           # Event creation form
    │   ├── Register.jsx           # User registration
    │   ├── Team.jsx               # Single team view
    │   └── Teams.jsx              # Teams list
    │
    └── 📂 utils/                   # Utility functions
        └── mailbox.js             # Email simulation helpers
```

## 📊 File Statistics

### By Category

| Category | Files | Description |
|----------|-------|-------------|
| **Documentation** | 4 | README, guides, changelogs |
| **Configuration** | 6 | Build, styling, environment |
| **Source Code** | 29 | React components & logic |
| **Total** | 39 | Complete project files |

### By Type

| Type | Count | Purpose |
|------|-------|---------|
| `.jsx` | 20 | React components |
| `.js` | 5 | JavaScript utilities |
| `.json` | 5 | Data & configuration |
| `.css` | 1 | Global styles |
| `.md` | 4 | Documentation |
| `.html` | 1 | Entry point |
| Config | 3 | Build configuration |

### Code Distribution

```
Components:  20 files  (~2,000 lines)
Styles:       1 file   (~500 lines)
API:          4 files  (~400 lines)
Utils:        1 file   (~50 lines)
Data:         4 files  (~100 lines)
Config:       6 files  (~200 lines)
Docs:         4 files  (~1,500 lines)
────────────────────────────────────
Total:       40 files  (~4,750 lines)
```

## 🗂️ Key Directories Explained

### `/src/api/`
**Purpose**: Data access layer
- Handles all data operations
- LocalStorage wrapper functions
- Ready for backend API integration
- Mock server for development

### `/src/components/`
**Purpose**: Reusable UI pieces
- Small, focused components
- Shared across multiple pages
- Includes protected route wrapper
- Dev tools for testing

### `/src/contexts/`
**Purpose**: Global state management
- Authentication state
- Toast notifications
- Accessible throughout app
- Reduces prop drilling

### `/src/pages/`
**Purpose**: Route-level components
- One page per route
- Main application screens
- Composed of smaller components
- Handle page-specific logic

### `/src/data/`
**Purpose**: Mock/sample data
- Development data files
- Used when no backend exists
- Helps with prototyping
- Will be replaced by API calls

### `/src/utils/`
**Purpose**: Helper functions
- Shared utility code
- Email simulation
- Data formatting
- Validation helpers

## 🎯 Important Files

### Must Read First
1. **QUICKSTART.md** - Get running fast
2. **README.md** - Understand features
3. **src/App.jsx** - Application structure
4. **src/index.css** - Design system

### For Customization
1. **tailwind.config.js** - Colors & fonts
2. **src/index.css** - Animations & styles
3. **src/pages/ClubsDashboard.jsx** - Main UI
4. **src/contexts/AuthContext.jsx** - User logic

### For Development
1. **vite.config.js** - Build settings
2. **.env.example** - Environment vars
3. **package.json** - Dependencies
4. **src/components/DevHelper.jsx** - Testing tools

## 📝 File Naming Conventions

### Components (`.jsx`)
- **PascalCase**: `ClubsDashboard.jsx`
- **Purpose-based**: `ProtectedRoute.jsx`
- **Feature-based**: `CreateClub.jsx`

### Utilities (`.js`)
- **camelCase**: `mailbox.js`
- **Purpose-based**: `apiClient.js`
- **Descriptive**: `localApi.js`

### Data (`.json`)
- **camelCase**: `currentUser.json`
- **Plural for collections**: `teams.json`, `events.json`
- **Singular for single items**: `currentUser.json`

## 🔄 Data Flow

```
User Interaction
      ↓
   Component
      ↓
Context (if needed)
      ↓
   API Layer
      ↓
  LocalStorage
      ↓
    Update UI
```

## 🚀 Build Output

When you run `npm run build`:

```
dist/
├── assets/
│   ├── index.[hash].js    # Bundled JavaScript
│   └── index.[hash].css   # Bundled styles
└── index.html             # Entry HTML
```

**Production files**: Minified, optimized, ready for deployment

## 📦 Dependencies

### Core
- `react` - UI library
- `react-dom` - React renderer
- `react-router-dom` - Routing

### State & Data
- `@tanstack/react-query` - Data fetching
- `axios` - HTTP client

### Styling
- `tailwindcss` - Utility CSS
- `postcss` - CSS processing
- `autoprefixer` - Browser compatibility

### Build
- `vite` - Build tool
- `@vitejs/plugin-react` - React support

## 🎨 Design System Files

### Colors & Typography
- `tailwind.config.js` - Design tokens
- `src/index.css` - Custom properties

### Animations
- `src/index.css` - Keyframes & transitions

### Components
- Utility classes in Tailwind
- Custom classes for special effects

## 🔐 Sensitive Files

**Never commit to git**:
- `.env` - Local environment variables
- `node_modules/` - Dependencies
- `dist/` - Build output

**Safe to commit**:
- `.env.example` - Template without secrets
- `src/` - All source code
- Docs - All markdown files

## 📱 Responsive Files

All pages and components are responsive:
- Mobile-first design
- Breakpoints in Tailwind
- Tested on all devices

## 🧪 Test-Friendly Structure

- Components are isolated
- Props are well-defined
- Context is mockable
- API layer is swappable

## 🎯 Next Steps

1. **Explore**: Start with `src/App.jsx`
2. **Customize**: Edit `tailwind.config.js`
3. **Extend**: Add new pages in `src/pages/`
4. **Deploy**: Run `npm run build`

---

**Total Lines of Code**: ~4,750
**File Count**: 40
**Components**: 20
**Pages**: 11

*This structure supports easy navigation, maintenance, and scaling!*
