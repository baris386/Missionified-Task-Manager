# Task & Todo Management Tool

A modern task management platform featuring recurring tasks, dynamic reminders, and a gamified point system.

---

## ✨ Features

- 📝 **Detailed Task Cards:** Complete control with title and task details.
- ⏰ **Reminder System:** Notifications to keep critical tasks on schedule.
- 🔄 **Recurring Tasks:** Automatic repeating rules for routine assignments.
- 🎯 **Gamification (Points + / -):** Earn positive (+) points upon completion or deduct negative (-) points for missed tasks.
- 🛠 **Full CRUD Management:** Easily create, **edit**, and **delete** tasks.

---

## 🛠 Tech Stack

- **Frontend / Backend:** Python (Streamlit / Flask), SQLite / LibSQL
- **Database:** Turso DB (Distributed SQLite)

---

## 🚀 Installation & Hosting

To host this tool, **Turso DB** must be used as the primary database.

### 1. Database Setup

Set up your database instance using the provided `tasksdb` template in the repository:

```bash
# Create a new database via Turso CLI
turso db create tasksdb

# Load the database schema using the tasksdb file in the repository
turso db shell tasksdb < tasksdb
```

### 2. Environment Variables

Check the `.env.example` file for required configuration parameters and add them to your environment variables or local `.env` file:

```env
TURSO_DATABASE_URL=libsql://your-database-name.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
```

### 3. Running the Application

```bash
# Install dependencies
pip install -r requirements.txt

# Start the application
python app.py
```

---

## 📂 Data Model (Task Structure)

```json
{
  "id": "task-001",
  "title": "Title",
  "details": "Details go here",
  "reminder": true,
  "repeat": false,
  "points": {
    "positive": 10,
    "negative": 5
  }
}
```
