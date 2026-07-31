# Missionified - Gamified Task Management Tool

A modern, animated task management platform featuring recurring tasks, dynamic reminders, subtasks, proportional partial scoring, and a gamified point system.

---

## ✨ Features

- 📝 **Detailed Task Cards:** Complete control with title, details, and customizable point values.
- 🧩 **Subtasks System:** Break main tasks into subtasks with live interactive checkboxes and progress bars.
- 📊 **Proportional Partial Scoring:** Option to earn partial XP based on the ratio of completed subtasks.
- ⏰ **Reminder System:** Real-time notifications and audio chimes to keep critical tasks on schedule.
- 🔄 **Recurring Tasks:** Automatic repeating rules (Daily, Weekly, Monthly) for routine assignments.
- 🎯 **Gamification (Points + / -):** Earn positive (+XP) points upon completion or deduct negative (-XP) points for missed tasks.
- 🎨 **Animated Cream UI:** Warm cream theme, soft pastel accents, and deep elevation shadows.
- 🛠 **Full CRUD Management:** Easily create, edit, filter, and delete tasks.

---

## 🛠 Tech Stack

- **Backend:** Python (Flask)
- **Frontend:** HTML5, Vanilla CSS3 (Custom Cream Theme & Keyframe Animations), Modern JavaScript
- **Database:** Turso DB (Distributed SQLite) / Local SQLite3 (WAL Mode)
- **Deployment:** Vercel Serverless ready (`vercel.json`)

---

## 🚀 Quick Start & Installation

### 1. Database Configuration

The application automatically initializes all database tables (`tasks` and `user_stats`) on launch. 

To use **Turso DB** as your cloud database, copy `.env.example` to `.env` and set your credentials:

```env
TURSO_DATABASE_URL=libsql://your-database-name.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
```

*Note: If `.env` is omitted, the application automatically falls back to local `tasks.db` SQLite in WAL mode.*

### 2. Running the Application

```bash
# Install dependencies
pip install -r requirements.txt

# Start the Flask application
python app.py
```

The application will run on **http://127.0.0.1:5000**.

---

## 🌐 Deploying to Vercel

1. Push your repository to GitHub.
2. Import the project in Vercel (it automatically detects `vercel.json` and `requirements.txt`).
3. Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in Vercel **Environment Variables**.
4. Click **Deploy**.

---

## 📂 Data Model (Task Structure)

```json
{
  "id": 1,
  "title": "Morning Workout",
  "details": "Full body routine",
  "reminder": true,
  "reminder_time": "2026-08-01T10:00",
  "repeat": "daily",
  "allow_partial": true,
  "positive_points": 10,
  "negative_points": 5,
  "status": "pending",
  "subtasks": [
    { "title": "Arms", "completed": true },
    { "title": "Core", "completed": false },
    { "title": "Legs", "completed": false }
  ]
}
```
