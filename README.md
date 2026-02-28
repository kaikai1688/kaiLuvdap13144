# TeamFit — Hackathon MVP (React + Firebase + Prototype Gemini)

TeamFit is a browser-based web app to help students form better teams for group assignments / FYP by matching workstyle traits, supporting connection requests, real-time chat, and peer ratings.

✅ **Current implementation is serverless (no custom backend)**  
- Frontend: **React 19 + Vite + React Router**  
- Backend services: **Firebase Authentication + Cloud Firestore + Firestore Security Rules**  
- Deployment: **Firebase Hosting (static web app)**  
- AI (prototype only): **Google Gemini API via `@google/genai` called from the client**

---

## Tech Stack (What’s inside this repo)

### Frontend
- **React 19** (SPA UI)
- **React Router DOM** (routing & navigation)
- **Vite** (dev server, build, HMR)
- **ESLint** (linting)

### Google Developer Technologies
- **Firebase Authentication**
  - Google Sign-In via `signInWithPopup(auth, googleProvider)`
  - Session tracking via `onAuthStateChanged(auth, ...)`
  - Sign out via `signOut(auth)`
- **Cloud Firestore**
  - Main database for users/projects/requests/messages/ratings/models/config
  - Real-time updates using `onSnapshot(...)`
- **Firestore Security Rules**
  - Acts as “backend-style access control” since Firestore is accessed directly by the client
- **Firebase Hosting**
  - Hosts the production build (`dist/`) as a static SPA

### AI (Prototype)
- **Google Gemini API** (prototype / client-side)
  - Implemented using **`@google/genai`**
  - API key provided through **Vite environment variable**: `VITE_GEMINI_API_KEY`
  - ⚠️ Prototype only: for production, move Gemini calls behind **Cloud Run / Cloud Functions** to protect keys and control cost

---

## Current Architecture (Judge-friendly summary)

### 1) React SPA (Browser)
Users interact with a single-page application. Routing is handled by React Router (`BrowserRouter` in `src/main.jsx`). Core route layout and navigation is in `src/App.jsx`.

### 2) Authentication (Firebase Auth)
User logs in with Google. Firebase returns a signed-in session and a UID (`request.auth.uid`) which is used for access control in Firestore rules.

### 3) Database (Cloud Firestore)
The React app directly reads/writes Firestore using the Firebase Web SDK. Real-time features are implemented using `onSnapshot` listeners.

### 4) Security (Firestore Rules)
Firestore Security Rules validate each read/write (signed-in check, ownership checks, admin checks, project membership checks).

### 5) AI (Gemini prototype only)
Gemini is not part of the backend. In this build, Gemini calls (if enabled) happen from the browser via `@google/genai` using a Vite client env key.

---

## Repository Structure (Key files)
public/
vite.svg

src/
main.jsx # React entry + BrowserRouter
App.jsx # Routes + auth/session + main UI layout
firebase.js # Firebase init: Auth + Firestore
HomePage.jsx
ProfilePage.jsx
AssessmentPage.jsx
ProjectsPage.jsx
CreateProjectPage.jsx
MessagesPage.jsx
RatingPage.jsx
RequireReady.jsx
adminCompute.js # admin logic / helper tooling (also references Gemini prototype usage)
AppShell.css / App.css / index.css / Login.css

vite.config.js
package.json
.firebaserc # points to Firebase project "teamfit-2d658"


---

## Firestore Data Model (Collections used)

The app uses these Firestore collections / subcollections:

- `users/{uid}`
  - `traitHistory/{projectId}`
- `projects/{projectId}`
- `connectionRequests/{rid}`
- `chats/{chatId}`
  - `messages/{messageId}`
- `projectRatings/{projectId}`
  - `submissions/{raterUid}`
- `traitModels/{bucketId}`
- `config/admins`

---

## Security Rules Summary (High level)

Your rules follow these principles:

- **Default deny** for everything not explicitly allowed:
  - `match /{document=**} { allow read, write: if false; }`
- **Signed-in gating**: most reads/writes require `request.auth != null`
- **Admin access** is controlled by:
  - `config/admins.adminMap[uid] == true`
- **Ownership checks** are applied for:
  - `users/{uid}` updates/deletes
  - `connectionRequests` (sender creates, receiver updates, only parties read)
  - `projectRatings/submissions` (only rater writes own submission)
- ⚠️ Note for hackathon MVP: `projects` and `chats` currently allow `read/write` for any signed-in user. This is acceptable for MVP speed, but should be tightened for production.

---

## Getting Started (Local Development)

### 1) Install dependencies
```bash
npm install
2) Run the app
npm run dev
3) Build for production
npm run build
npm run preview

Environment Variables (Gemini prototype)

Create a .env file at project root:
VITE_GEMINI_API_KEY=YOUR_GEMINI_KEY
⚠️ Important: Vite exposes VITE_* variables to the browser.
This is okay for prototype/demo, but for production you should move Gemini calls behind Cloud Run/Functions.

Firebase Setup (Using your own project)

This repo initializes Firebase in src/firebase.js:

initializeApp(firebaseConfig)

getAuth(app) + GoogleAuthProvider()

getFirestore(app)

To use your own Firebase project:

Create a Firebase project

Enable Authentication → Google

Create Firestore Database

Replace firebaseConfig in src/firebase.js with your Firebase web config

Deployment (Firebase Hosting)

Typical hosting flow:
npm run build
firebase init hosting
firebase deploy

You should configure Hosting to serve the Vite build output folder:

dist/

FAQ
What is node_modules/? Should it be in the diagram?

node_modules/ is where NPM stores installed libraries (React, Firebase SDK, etc.).

✅ Do not include it in architecture diagrams (it’s not a system component)

✅ Do not commit it to GitHub (keep it in .gitignore)

Do you have a backend server?

Not in the current implementation. Firebase managed services act as the backend:

Firebase Auth

Cloud Firestore

Firestore Security Rules

License

Hackathon / educational use.

If you paste your **`firebase.json`** + confirm whether you already ran `firebase init hosting`, I can make the **Deployment section 100% exact** (what folder you deploy, SPA rewrites, and commands that will work on judges’ machines).
