# Study Buddy AI 📚

Study Buddy AI is an intelligent, AI-powered study assistant that transforms your raw syllabus or study materials into perfectly structured, exam-ready notes in seconds. Built with React, Vite, Tailwind CSS, and powered by Supabase and Google Gemini.

## ✨ Features

- **Auth System:** Secure Email/Password and Google OAuth login via Supabase.
- **Smart Notes Generation:** Paste your syllabus text or upload a file to automatically generate structured notes.
- **Customizable Detail Levels:** Choose from Short Notes, Exam Ready (5-8 marks), Deep Explanation (10-15 marks), or Teaching Mode.
- **Multilingual Support:** Generate notes in English, Hinglish, and more.
- **Rich Text & Exporting:** View your notes in a clean markdown viewer and easily export them to DOCX format.
- **Read Aloud:** Built-in text-to-speech feature to listen to your notes.
- **Notes History:** Automatically saves your generated notes to your personal dashboard so you can revisit them anytime.

---

## 📸 Screenshots

*(Add your screenshots to a `docs` folder and uncomment these lines)*

<!--
### Welcome / Login Screen
![Login Screen](./docs/login.png)

### Dashboard & Syllabus Upload
![Dashboard](./docs/dashboard.png)

### Generated Notes View
![Notes View](./docs/notes.png)
-->

---

## 🚀 Getting Started

Follow these steps to set up the project locally.

### 1. Prerequisites
- [Node.js](https://nodejs.org/) & npm installed.
- A [Supabase](https://supabase.com) account (for database, auth, and edge functions).
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey).

### 2. Local Setup

Clone the repository and install dependencies:

```sh
git clone <YOUR_GIT_URL>
cd study-buddy-ai
npm install
```

### 3. Environment Variables

Create a `.env` file in the root directory and add your Supabase project details (You can find these in your Supabase Dashboard under **Settings > API**):

```env
VITE_SUPABASE_PROJECT_ID="your_supabase_project_id"
VITE_SUPABASE_URL="https://your_supabase_project_id.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your_supabase_anon_public_key"
```

### 4. Supabase Backend Setup (Database & AI Functions)

Since this app uses Supabase Edge Functions for communicating with Gemini AI, you need to push the backend code to your Supabase project.

1. **Login to Supabase CLI:**
   ```sh
   npx supabase login
   ```
2. **Link your project:**
   ```sh
   npx supabase link --project-ref your_supabase_project_id
   ```
3. **Push the Database Schema:**
   ```sh
   npx supabase db push
   ```
4. **Set your Gemini API Key as a Secret:**
   This allows the Edge Functions to access the AI.
   ```sh
   npx supabase secrets set GEMINI_API_KEY="AIzaSy...your_gemini_key"
   ```
5. **Deploy the Edge Functions:**
   ```sh
   npx supabase functions deploy
   ```

### 5. Run the App

Start the development server:

```sh
npm run dev
```
Open [http://localhost:8080](http://localhost:8080) in your browser to see the app!

---

## 📖 User Guide

### Generating Notes
1. **Login** to the application using your account.
2. On the main dashboard, **paste your syllabus text** into the input box (or upload a `.txt`/`.md` file).
3. **Select Detail Level**: Choose how in-depth you want the notes. For exam prep, "Exam Ready" is recommended.
4. **Select Language**: Pick the language for the output (e.g., English or Hinglish).
5. Click **Generate Notes**. The AI will process the syllabus and stream the structured notes to your screen.

### Managing Notes
- Click the **History** button to view all your previously generated study sessions.
- Use the **Read Aloud** button to listen to the notes.
- Use the **Export** button to download your notes as a DOCX file for offline viewing or printing.

---

## 🛠️ Technologies Used

- **Frontend:** React, Vite, TypeScript, Tailwind CSS, shadcn-ui, Framer Motion
- **Backend & Auth:** Supabase (PostgreSQL, Auth, Edge Functions)
- **AI Integration:** Google Gemini 3.6 Flash (via Edge Functions)
- **Markdown parsing:** react-markdown, marked
