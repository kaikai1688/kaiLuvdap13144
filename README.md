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

### 1) Install dependencies
```bash
npm install

### 2) Run the app locally
```bash
npm install

3) Save `README.md`.

That’s it.

If your README already has a section like `## Getting Started`, just paste this **under that header** and delete the duplicated `npm install` in the run step.
