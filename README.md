# Levelo 🎮

**Levelo** is an AI-first web game builder and IDE. Describe your game. Levelo builds it. Play it instantly. Build, play, and live-edit interactive Phaser 3 games in real-time with an in-browser sandboxed runtime, Monaco code editor, and cloud persistence.

---

## 🚀 Key Features

- **🎮 Playable Phaser 3 Starter**: New projects automatically launch with a complete, playable 2D arcade platformer featuring smooth keyboard controls, physics, star collection, particle effects, and touch-screen D-pad controls.
- **🖥️ Sandboxed Live Preview**:
  - Sandboxed `<iframe>` running with `sandbox="allow-scripts allow-modals allow-pointer-lock"`.
  - Responsive **Device Switcher**: Mobile (390×844), Tablet (820×1180), and Desktop (fit-to-panel).
  - CSS `transform: scale(...)` auto-scaling ensures the game canvas fits on any screen size.
  - Device rotation (portrait / landscape), fullscreen mode, external tab runner, and embedded runtime console.
- **⚡ Monaco Code Editor**:
  - Full-featured code editor powered by `@monaco-editor/react`.
  - Real-time debounced auto-save directly to Firestore / local state.
  - Document formatting, reset to starter game template, copy code, line & character counters.
- **💬 Levelo AI Chat Panel**:
  - Interactive chat panel powered by real Gemini streaming AI generation.
  - Quick-action prompts (e.g. *🚀 Space Shooter*, *🐦 Flappy Bird*, *🧱 Brick Breaker*, *🏃 Endless Jumper*).
  - Step progression indicator (*Planning* → *Writing code* → *Applying*) and interactive Stop button.
- **🔒 Firebase Auth & Cloud Firestore**:
  - Google Sign-In & Email/Password authentication.
  - Cloud Firestore collection for project files, titles, and timestamps with owner-based security rules.
  - Zero-friction **Local Mode Fallback**: If Firebase environment variables are not yet configured, the app seamlessly runs using browser `localStorage` and provides a setup guide.
- **🧠 Gemini AI Settings with Live Validation**:
  - Client-side Gemini API key input stored strictly in browser `localStorage`.
  - Real validation call to Google Gemini's `models.list` API endpoint to verify key validity and dynamically populate available models (e.g. `gemini-2.5-flash`, `gemini-2.5-pro`).
- **📱 Ultra-Responsive & Adaptive Layout**:
  - **Desktop (≥1024px)**: Resizable split-view with drag handle between Chat and Workspace tabs.
  - **Tablet**: Collapsible chat panel.
  - **Mobile (<1024px)**: Full-screen single panel with 100dvh viewport, 44px+ touch targets, and a bottom tab bar (*Chat* | *Preview* | *Code*).
  - Dark mode default with light mode toggle persisted across sessions.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (Strict mode)
- **Styling**: Tailwind CSS v4
- **Game Engine**: Phaser v3.80.1 (Arcade Physics)
- **Code Editor**: `@monaco-editor/react`
- **State Management**: Zustand
- **Database & Auth**: Firebase Auth + Cloud Firestore
- **AI Integration**: Google Gemini API (`@google/genai`)
- **Icons**: Lucide React

---

## ⚙️ Setup & Configuration

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables (.env.local)
Create a `.env.local` file in the root directory:

```env
# Optional Gemini server proxy key
GEMINI_API_KEY="your-gemini-api-key"

# Firebase Client Configuration (From Firebase Console > Project Settings > Web App)
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-app.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-app.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
```

*(Note: If you run without Firebase credentials, Levelo automatically enables Local Storage Mode so you can develop and test immediately!)*

### 3. Deploy Firestore Security Rules
Deploy `firestore.rules` using the Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

Or copy the contents of `firestore.rules` directly into your **Firebase Console > Firestore Database > Rules** tab:
```cel
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId} {
      allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.ownerId == request.auth.uid;
      allow update: if request.auth != null && resource.data.ownerId == request.auth.uid && request.resource.data.ownerId == request.auth.uid;
      allow delete: if request.auth != null && resource.data.ownerId == request.auth.uid;
    }
  }
}
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to start building games.

---

## 📂 Project Structure

```
├── app/
│   ├── api/gemini/validate/route.ts  # Real server-side validation for Gemini API keys
│   ├── api/generate/route.ts        # Streaming AI game generation endpoint
│   ├── dashboard/page.tsx           # Projects list, New Game modal, rename, delete
│   ├── login/page.tsx               # Google & Email/Password authentication
│   ├── project/[id]/page.tsx        # Workspace: Split view, Preview, Monaco, Chat
│   ├── settings/page.tsx            # Gemini API Key management & model selector
│   ├── globals.css                  # Tailwind styles & theme variables
│   ├── layout.tsx                   # Root layout, theme script, ToastProvider
│   ├── icon.svg                     # Levelo SVG favicon
│   ├── manifest.ts                  # PWA manifest
│   └── page.tsx                     # Entry redirector
├── components/
│   ├── Logo.tsx                     # Levelo Wordmark & icon component
│   ├── dashboard/                   # Project creation, rename, and delete modals
│   ├── workspace/                   # PreviewPanel, CodeEditor, ChatPanel, FilesPanel
│   ├── FirebaseNotice.tsx           # Setup notice banner & helper modal
│   ├── Navbar.tsx                   # Top Bar Contract navigation with Logo
│   └── Toast.tsx                    # Toast notifications system
├── lib/
│   ├── firebase.ts                  # Firebase Auth & Firestore client with local fallback
│   ├── parse-ai-response.ts         # Code fence and explanation parser
│   ├── starter-game.ts              # Playable Phaser 3 starter code
│   ├── storage-migration.ts         # One-time legacy key migration helper
│   ├── store.ts                     # Zustand application store
│   ├── types.ts                     # TypeScript definitions
│   └── utils.ts                     # Tailwind class merging helper
└── firestore.rules                  # Firestore security rules
```
