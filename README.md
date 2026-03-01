# TeamFit — Student Team Matching & Peer Rating (Hackathon MVP)

TeamFit is a web app that helps university students form better teams for **FYP / group assignments / hackathons** by matching teammates using **workstyle compatibility** and **peer ratings** after projects.

This MVP is designed for fast hackathon delivery:
- **No custom backend server**
- Uses **Firebase Authentication + Cloud Firestore** directly from the React client
- Includes a **Gemini Advisor prototype** (client-side only)

---

## 🌟 Key Features

### 1) Google Login (Firebase Auth)
- Sign in with Google using Firebase Authentication
- Each user is identified by a unique Firebase **UID**, used across the app and Firestore rules

### 2) Profile + Assessment (7 Collaboration Traits)
Users complete:
- Profile info (name, username, university, course, year)
- 7 trait ratings (1–5 scale):
  - Communication
  - Conflict Handling
  - Awareness
  - Supportiveness
  - Adaptability
  - Alignment
  - Trustworthiness

### 3) Project Creation + Teammate Matching
Users can create a project with:
- project name
- project type
- team size
- due date

Matching logic:
- Calculates a compatibility score between users based on the 7 traits
- Uses a weighted method that prioritizes “Top 3 priority traits” for each project bucket (project type + term)
- Shows recommended teammates and allows sending **connect requests**

### 4) Connection Requests + Inbox Status
- Users can send connect requests to a candidate for a specific project
- Project Inbox shows status:
  - pending
  - accepted
  - rejected

### 5) Chat Messaging (Firestore)
- Messaging is stored in Firestore under chat threads
- Supports direct chat + message persistence

### 6) End Project → Teammate Rating Flow
- Project owner clicks **End Project**
- This opens a rating session for all members
- Each member rates teammates across all 7 traits
- Submissions are stored under `projectRatings/{projectId}/submissions/{uid}`
- Includes quorum logic and session close/expire structure (MVP approach)

### 7) Gemini Advisor (Prototype Only)
- Provides short “advisor” text output during teammate matching (3–6 lines)
- **Model used:** `gemini-2.5-flash`
- Implemented using `@google/genai` and `VITE_GEMINI_API_KEY`
- ⚠️ Prototype runs client-side (not backend-secured)

---

## 🏗️ Technical Architecture (Current Build)

**Frontend (React + Vite SPA)**
- Routing via `react-router-dom`
- Main pages:
  - Home
  - Profile
  - Assessment
  - Projects
  - Messages
  - Rating

**Backend Services (Firebase)**
- **Firebase Authentication (Google Sign-In)**
- **Cloud Firestore (database + real-time listeners)**  
  Used directly from the frontend via Firebase Web SDK (`getDoc`, `setDoc`, `updateDoc`, `getDocs`, `onSnapshot`, etc.)

**AI (Prototype)**
- Gemini called directly from the client (no Cloud Run / Functions pipeline in this MVP)

**Deployment**
- Firebase Hosting (static hosting for Vite build output)

---

## 🗃️ Firestore Data Model (Collections)

TeamFit stores data in these collections:

- `users/{uid}` — user profile + assessment traits + status flags  
- `projects/{projectId}` — projects (owner, members, type, due date, status)  
- `connectionRequests/{rid}` — project-based connection requests (pending/accepted/rejected)  
- `chats/{chatId}/messages/{messageId}` — chat threads + message history  
- `projectRatings/{projectId}` — rating sessions  
  - `projectRatings/{projectId}/submissions/{uid}` — each user’s rating submission  
- `traitModels/{bucketId}` — bucket model for “Top 3 priority traits”  
- `config/admins` — adminMap for admin privileges

---

## 🔐 Security (Firestore Rules Summary)

Since the MVP has no custom backend server, Firestore Security Rules act as the backend enforcement layer.

Key logic (high-level):
- Require signed-in users (`request.auth != null`)
- Admin role is controlled via `config/admins.adminMap[uid]`
- Project membership is checked via `projects/{projectId}.memberUids`
- Connection requests:
  - Sender creates
  - Receiver updates
  - Only sender/receiver can read
- Ratings:
  - Only project members can read/write rating session & submissions
  - Only rater can write their own submission document

(Full rules are in `firestore.rules`.)

---

## ⚙️ Local Setup (Beginner Steps)

## 1) Install dependencies
```bash
npm install
```
## 2) Run the dev server
```bash
npm run dev
```
Vite will show a local URL (usually http://localhost:5173).

## 3) Build for production
```bash
npm run build
```

## 4) Preview the production build locally
```bash
npm run preview
```
---

## Environment Variables (Gemini Prototype)
Create a .env file in the project root (same folder level as package.json):
```bash
VITE_GEMINI_API_KEY=your_key_here
```
If VITE_GEMINI_API_KEY is missing, your app should fall back to a default advisor message (recommended for demos).

## Firebase Setup (How to run your own copy)
## A) Create Firebase project
1. Go to Firebase Console → Create project

2. Enable Authentication → Google sign-in provider

3. Create Cloud Firestore database

## B) Add your Firebase config
Update src/firebase.js with your own project settings from:
Firebase Console → Project settings → Web app

⚠️ Don’t commit private keys meant for servers.
Firebase web config is okay to be public, but your Gemini key should be kept in .env.

## Firestore Security Rules (Summary)
Your rules follow these key ideas:
### Default deny for unknown collections:
match /{document=**} { allow read, write: if false; }

### A) Signed-in gating: most collections require request.auth != null
### B) Admin role: checked via config/admins.adminMap[uid] == true
### C) Ownership / role-based rules for:
- users (owner/admin)
- connectionRequests (sender creates, receiver updates)
- projectRatings/submissions (only rater can write; project members can read)
*Note: projects and chats are currently read/write: if isSignedIn() — good for hackathon speed; tighten to membership-based access for production.

## Scripts
From package.json:
```bash
npm run dev       # start Vite dev server
npm run build     # build production bundle
npm run preview   # preview production build locally
npm run lint      # run ESLint
```

## Project Structure (Important Files)
src/main.jsx — React entry, wraps <App /> with BrowserRouter
src/App.jsx — main routing + auth gate + layout + navigation
src/firebase.js — Firebase initialization (Auth + Firestore)
src/ProfilePage.jsx — user profile + traits
src/ProjectsPage.jsx — browse projects + matching + (prototype) Gemini calls
src/MessagesPage.jsx — chat & messaging (Firestore real-time)
src/RatingPage.jsx — teammate rating submissions
src/adminCompute.js — admin utilities / prototype logic

## Deployment (Firebase Hosting)
If you’ve set up Firebase Hosting:

```bash
firebase login
firebase init hosting
npm run build
firebase deploy
```
If Hosting isn’t configured yet in firebase.json, add Firebase Hosting init and redeploy.
```bash
firebase init hosting
```

## Notes for Judges
1. This is a serverless MVP: the “backend” is Firebase Auth + Firestore + Rules.
2. Gemini AI is prototype-only (client side) for demo speed and cost control.
3. Production upgrade path:
- Move Gemini calls behind Cloud Run / Cloud Functions
- Tighten Firestore rules for projects/chats/rating membership access
- Add indexing + query optimization for scale

## License
Hackathon / educational use.

