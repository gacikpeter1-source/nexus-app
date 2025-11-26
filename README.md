# NEXUS - Club & Team Management Platform

A comprehensive web application for managing sports clubs and teams, built with React and featuring a bold sports-editorial design aesthetic.

## 🎯 Project Overview

NEXUS is a platform that allows clubs and teams to centralize their operations in one place, making it easy for parents to handle multiple activities of their kids through a single interface.

### Key Features

- **Multi-Role User System**: Admin, Trainer, Assistant, Athlete, and Parent roles
- **Club & Team Management**: Create and manage multiple clubs, each with multiple teams
- **Calendar System**: Advanced event scheduling with recurring events, RSVP tracking
- **Join Request System**: Users can request to join clubs/teams with approval workflow
- **Parent-Athlete Linking**: Parents can manage their children's activities
- **Attendance Tracking**: Track participation in events and training sessions
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

## 🎨 Design Philosophy

NEXUS features a distinctive **sports-editorial aesthetic** with:
- **Typography**: Anton (display), Bebas Neue (titles), Work Sans (body)
- **Color Palette**: 
  - Primary: Vibrant Red (#FF3366)
  - Accent: Electric Blue (#00D9FF)
  - Secondary: Gold (#FFD700)
  - Dark backgrounds for modern, high-contrast UI
- **Animations**: Smooth transitions, hover effects, and micro-interactions
- **Glass Morphism**: Subtle backdrop blur effects for depth

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. **Clone or extract the project**
```bash
cd nexus-app
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` and configure as needed:
- `VITE_SKIP_EMAIL_VERIFICATION=true` for development (skips email verification)
- Set to `false` in production to require email verification

4. **Start the development server**
```bash
npm run dev
# or
yarn dev
```

5. **Open your browser**
Navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
# or
yarn build
```

The built files will be in the `dist/` directory.

## 👥 User Roles & Permissions

### 1. Admin
- Full access to all clubs, teams, and users
- Can create/modify/delete any entity
- User management capabilities
- Access to admin dashboard

### 2. Trainer (Club Owner)
- Create and manage clubs
- Create teams within their clubs
- Manage team members and events
- Approve/deny join requests
- **SuperTrainer**: First trainer who creates a club has access to all teams in that club

### 3. Assistant
- Same rights as Trainer but limited to specific team(s)
- Can be nominated by Trainer
- Approve membership requests
- Create/modify/delete events for their team(s)
- Cannot create clubs

### 4. Athlete (User)
- View calendar events for their teams
- RSVP to events (confirm/decline attendance)
- Access team chat
- Must be approved by Trainer/Assistant to join teams
- Can link Parent account for oversight

### 5. Parent
- Represent children in the application
- View child's schedule and progress
- Confirm/decline event attendance on child's behalf
- Access to team chat involving their child
- Must be linked to Athlete account via request system

## 🏗️ Architecture

### Tech Stack

- **Frontend Framework**: React 18
- **Routing**: React Router v6
- **State Management**: React Query (TanStack Query)
- **Styling**: Tailwind CSS with custom design tokens
- **Data Persistence**: localStorage (development), ready for backend integration
- **Build Tool**: Vite

### Project Structure

```
nexus-app/
├── src/
│   ├── api/              # API client and mock data handlers
│   │   ├── apiClient.js
│   │   ├── localApi.js
│   │   ├── mockServer.js
│   │   └── teams.js
│   ├── components/       # Reusable React components
│   │   ├── CreateClub.jsx
│   │   ├── DevHelper.jsx
│   │   ├── ProtectedRoute.jsx
│   │   └── TeamCard.jsx
│   ├── contexts/         # React Context providers
│   │   ├── AuthContext.jsx
│   │   └── ToastContext.jsx
│   ├── data/             # Static/mock data files
│   │   ├── currentUser.json
│   │   ├── events.json
│   │   ├── teams.json
│   │   └── users.json
│   ├── pages/            # Page components (routes)
│   │   ├── AdminUsers.jsx
│   │   ├── Calendar.jsx
│   │   ├── ClubManagement.jsx
│   │   ├── ClubsDashboard.jsx
│   │   ├── CompleteRegistration.jsx
│   │   ├── Event.jsx
│   │   ├── Login.jsx
│   │   ├── NewEvent.jsx
│   │   ├── Register.jsx
│   │   ├── Team.jsx
│   │   └── Teams.jsx
│   ├── utils/            # Utility functions
│   │   └── mailbox.js
│   ├── App.jsx           # Main application component
│   ├── index.css         # Global styles and design tokens
│   └── main.jsx          # Application entry point
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

## 📋 Core Workflows

### Creating a Club

1. User registers and logs in
2. Navigate to Dashboard
3. Click "Create Club" (available for Trainers)
4. Enter club name and optionally create first team
5. Club receives unique 6-digit code
6. Share code with other trainers to join

### Joining a Club/Team

1. User logs in
2. Click "Request to Join" from Dashboard
3. Select club and optionally a specific team
4. Request appears in Trainer's pending requests
5. Trainer approves/denies the request
6. User receives notification via email simulation

### Creating Events

1. Trainer/Assistant navigates to Calendar
2. Click "New Event"
3. Fill in event details:
   - Title, Type (Training/Game/Tournament/Custom)
   - Date and Time
   - Location
   - Team
   - Recurrence (None/Daily/Weekly/Monthly)
   - Number of occurrences or end date
4. Event appears in team's calendar
5. Team members can RSVP

### Parent-Athlete Linking

1. Parent creates account
2. Parent sends link request to Athlete (via email search)
3. Athlete approves the request
4. Parent gains visibility into Athlete's schedule and can act on their behalf

## 🔧 Development Features

### Dev Helper Tool

A development panel (visible to Admins) provides quick access to:
- Create test users with different roles
- Quick club creation
- Join club by code
- Nominate assistants
- Clear all data (reset)

**Access**: Click "🔧 Dev Tools" button in bottom-right corner (Admin only)

### Test Credentials

Create test users instantly via Dev Helper:
- Email: `[role]@test.com` (e.g., `trainer@test.com`)
- Password: `Password123`

Roles: admin, trainer, assistant, user, parent

## 📅 Calendar Features

### Event Types
- Training
- Game/Match
- Tournament
- Meeting
- Custom

### Recurring Events
- Daily, Weekly, Monthly patterns
- Specify number of occurrences OR end date
- Automatic generation of event instances

### RSVP System
- Confirmed / Declined / Maybe status
- Visible to Trainers/Assistants for attendance tracking
- Notifications sent to users

## 🎯 Subscription Model (Planned)

Currently disabled during development phase. Future implementation:

### Free Tier
- Calendar access
- Team chat
- Basic event RSVP

### Paid Subscription (Yearly)
- Club registration and management
- Multiple teams per club (unlimited)
- Up to 2 trainers + 2 assistants per team
- Unlimited trainers per club
- Advanced statistics and reporting

### Premium Add-ons
- SuperTrainer access (view all club teams)
- Community features (club-to-club collaboration)
- Shared training library
- Advanced analytics

## 🔐 Security Features

- Email verification for new accounts
- Password requirements:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
- Username validation (3-20 characters, alphanumeric + underscore)
- Role-based access control (RBAC)
- Protected routes with automatic redirection

## 🌐 Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 📱 Responsive Breakpoints

- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 🐛 Known Issues & Limitations

### Current Development Phase

- **Data Persistence**: Uses localStorage (data cleared on browser cache clear)
- **Email System**: Simulated via localStorage "mailbox" (no real emails sent)
- **No Backend**: All logic runs client-side
- **File Uploads**: Not yet implemented (training library feature)
- **Payment Integration**: Subscription system UI only (no payment processing)

### Planned Improvements

- [ ] Backend API integration (Node.js/Express or Python/Django)
- [ ] Real database (PostgreSQL/MongoDB)
- [ ] Real email service (SendGrid/AWS SES)
- [ ] File upload system for training materials
- [ ] Mobile app (React Native)
- [ ] Push notifications
- [ ] Advanced statistics dashboard
- [ ] Export reports (PDF/Excel)

## 🤝 Contributing

### Development Workflow

1. Create feature branch: `git checkout -b feature/your-feature-name`
2. Make changes and test thoroughly
3. Commit with descriptive messages
4. Push and create pull request

### Code Style

- Use functional React components with hooks
- Follow existing naming conventions (PascalCase for components, camelCase for functions)
- Add comments for complex logic
- Keep components small and focused
- Use Tailwind CSS utility classes (avoid custom CSS unless necessary)

## 📄 License

Proprietary - All rights reserved

## 📧 Support

For issues or questions during development:
- Check console for error messages
- Use Dev Helper to reset data if needed
- Review localStorage in browser DevTools

## 🎉 Acknowledgments

- Design inspiration: Modern sports platforms and editorial layouts
- Typography: Google Fonts (Anton, Bebas Neue, Work Sans)
- Icons: Native emoji set for cross-platform compatibility

---

**Built with ❤️ for sports clubs and teams worldwide**

Version: 1.0.0  
Last Updated: November 2024
