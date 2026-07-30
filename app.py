import sqlite3
import os
import json
import urllib.request
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tasks.db')

TURSO_DATABASE_URL = os.getenv('TURSO_DATABASE_URL', '').strip()
TURSO_AUTH_TOKEN = os.getenv('TURSO_AUTH_TOKEN', '').strip()

def is_turso_enabled():
    return bool(
        TURSO_DATABASE_URL and 
        TURSO_AUTH_TOKEN and 
        not TURSO_DATABASE_URL.startswith('your-') and 
        not TURSO_AUTH_TOKEN.startswith('your-')
    )

def execute_turso_query(sql, params=None):
    http_url = TURSO_DATABASE_URL.replace('libsql://', 'https://')
    if not http_url.endswith('/v2/pipeline'):
        http_url = http_url.rstrip('/') + '/v2/pipeline'
        
    args = []
    if params:
        for p in params:
            if isinstance(p, bool):
                args.append({"type": "integer", "value": "1" if p else "0"})
            elif isinstance(p, int):
                args.append({"type": "integer", "value": str(p)})
            elif isinstance(p, float):
                args.append({"type": "float", "value": str(p)})
            elif p is None:
                args.append({"type": "null"})
            else:
                args.append({"type": "text", "value": str(p)})
                
    payload = {
        "requests": [
            {"type": "execute", "stmt": {"sql": sql, "args": args}},
            {"type": "close"}
        ]
    }
    
    req = urllib.request.Request(
        http_url,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            "Authorization": f"Bearer {TURSO_AUTH_TOKEN}",
            "Content-Type": "application/json"
        }
    )
    
    with urllib.request.urlopen(req) as resp:
        res_data = json.loads(resp.read().decode('utf-8'))
        
    results = res_data.get("results", [])
    if not results or "response" not in results[0]:
        return [], None
        
    resp_obj = results[0]["response"]
    if resp_obj.get("type") == "error":
        error_msg = resp_obj.get("error", {}).get("message", "Turso error")
        raise Exception(f"Turso Error: {error_msg}")
        
    result_data = resp_obj.get("result", {})
    cols = [c["name"] for c in result_data.get("cols", [])]
    rows = result_data.get("rows", [])
    
    dict_rows = []
    for r in rows:
        row_dict = {}
        for col_name, val_obj in zip(cols, r):
            if isinstance(val_obj, dict):
                v_type = val_obj.get("type")
                val = val_obj.get("value")
                if v_type == "integer" and val is not None:
                    val = int(val)
                elif v_type == "float" and val is not None:
                    val = float(val)
                elif v_type == "null":
                    val = None
                row_dict[col_name] = val
            else:
                row_dict[col_name] = val_obj
        dict_rows.append(row_dict)
        
    last_id = result_data.get("last_insert_rowid")
    if last_id is not None:
        try:
            last_id = int(last_id)
        except (ValueError, TypeError):
            pass
            
    return dict_rows, last_id

def db_query(sql, params=None, fetchone=False, fetchall=False, commit=True):
    if is_turso_enabled():
        rows, last_id = execute_turso_query(sql, params)
        if fetchone:
            return rows[0] if rows else None
        if fetchall:
            return rows
        return last_id
    else:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA journal_mode=WAL;')
        conn.execute('PRAGMA synchronous=NORMAL;')
        cursor = conn.cursor()
        cursor.execute(sql, params or [])
        
        result = None
        if fetchone:
            row = cursor.fetchone()
            result = dict(row) if row else None
        elif fetchall:
            rows = cursor.fetchall()
            result = [dict(r) for r in rows]
        else:
            result = cursor.lastrowid
            
        if commit:
            conn.commit()
        conn.close()
        return result

def init_db():
    if is_turso_enabled():
        db_query('''
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                details TEXT,
                reminder INTEGER DEFAULT 0,
                reminder_time TEXT,
                repeat TEXT DEFAULT 'none',
                positive_points INTEGER DEFAULT 10,
                negative_points INTEGER DEFAULT 5,
                status TEXT DEFAULT 'pending',
                created_at TEXT NOT NULL,
                subtasks TEXT DEFAULT '[]',
                allow_partial INTEGER DEFAULT 0
            )
        ''')
        
        db_query('''
            CREATE TABLE IF NOT EXISTS user_stats (
                id INTEGER PRIMARY KEY,
                total_score INTEGER DEFAULT 0,
                tasks_completed INTEGER DEFAULT 0,
                tasks_failed INTEGER DEFAULT 0
            )
        ''')
        
        stats = db_query('SELECT COUNT(*) as cnt FROM user_stats', fetchone=True)
        if not stats or stats.get('cnt', 0) == 0:
            db_query('INSERT INTO user_stats (id, total_score, tasks_completed, tasks_failed) VALUES (1, 0, 0, 0)')
    else:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('PRAGMA journal_mode=WAL;')
        cursor.execute('PRAGMA synchronous=NORMAL;')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                details TEXT,
                reminder INTEGER DEFAULT 0,
                reminder_time TEXT,
                repeat TEXT DEFAULT 'none',
                positive_points INTEGER DEFAULT 10,
                negative_points INTEGER DEFAULT 5,
                status TEXT DEFAULT 'pending',
                created_at TEXT NOT NULL,
                subtasks TEXT DEFAULT '[]',
                allow_partial INTEGER DEFAULT 0
            )
        ''')
        
        cursor.execute("PRAGMA table_info(tasks)")
        columns = [col[1] for col in cursor.fetchall()]
        if 'subtasks' not in columns:
            cursor.execute("ALTER TABLE tasks ADD COLUMN subtasks TEXT DEFAULT '[]'")
        if 'allow_partial' not in columns:
            cursor.execute("ALTER TABLE tasks ADD COLUMN allow_partial INTEGER DEFAULT 0")

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_stats (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                total_score INTEGER DEFAULT 0,
                tasks_completed INTEGER DEFAULT 0,
                tasks_failed INTEGER DEFAULT 0
            )
        ''')
        
        cursor.execute('SELECT COUNT(*) FROM user_stats')
        if cursor.fetchone()[0] == 0:
            cursor.execute('INSERT INTO user_stats (id, total_score, tasks_completed, tasks_failed) VALUES (1, 0, 0, 0)')
            
        conn.commit()
        conn.close()

init_db()

def parse_task_dict(d):
    if not d:
        return None
    d = dict(d)
    try:
        if isinstance(d.get('subtasks'), str):
            d['subtasks'] = json.loads(d['subtasks']) if d.get('subtasks') else []
        elif not isinstance(d.get('subtasks'), list):
            d['subtasks'] = []
    except Exception:
        d['subtasks'] = []
    d['allow_partial'] = bool(d.get('allow_partial', 0))
    return d

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    tasks = db_query('SELECT * FROM tasks ORDER BY id DESC', fetchall=True)
    task_list = [parse_task_dict(t) for t in (tasks or [])]
    return jsonify(task_list)

@app.route('/api/stats', methods=['GET'])
def get_stats():
    stats = db_query('SELECT total_score, tasks_completed, tasks_failed FROM user_stats WHERE id = 1', fetchone=True)
    if stats:
        return jsonify(stats)
    return jsonify({'total_score': 0, 'tasks_completed': 0, 'tasks_failed': 0})

@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Title is required'}), 400
        
    details = data.get('details', '').strip()
    reminder = 1 if data.get('reminder') else 0
    reminder_time = data.get('reminder_time', '')
    repeat = data.get('repeat', 'none')
    positive_points = int(data.get('positive_points', 10))
    negative_points = int(data.get('negative_points', 5))
    allow_partial = 1 if data.get('allow_partial') else 0
    
    subtasks = data.get('subtasks', [])
    if not isinstance(subtasks, list):
        subtasks = []
    subtasks_json = json.dumps(subtasks)
    
    created_at = datetime.now().isoformat()
    
    task_id = db_query('''
        INSERT INTO tasks (title, details, reminder, reminder_time, repeat, positive_points, negative_points, status, created_at, subtasks, allow_partial)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    ''', (title, details, reminder, reminder_time, repeat, positive_points, negative_points, created_at, subtasks_json, allow_partial))
    
    new_task = db_query('SELECT * FROM tasks WHERE id = ?', (task_id,), fetchone=True)
    return jsonify(parse_task_dict(new_task)), 201

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.get_json() or {}
    existing = db_query('SELECT * FROM tasks WHERE id = ?', (task_id,), fetchone=True)
    if not existing:
        return jsonify({'error': 'Task not found'}), 404
        
    title = data.get('title', existing['title']).strip()
    details = data.get('details', existing['details']).strip()
    reminder = 1 if data.get('reminder', existing['reminder']) else 0
    reminder_time = data.get('reminder_time', existing['reminder_time'])
    repeat = data.get('repeat', existing['repeat'])
    positive_points = int(data.get('positive_points', existing['positive_points']))
    negative_points = int(data.get('negative_points', existing['negative_points']))
    allow_partial = 1 if data.get('allow_partial', existing['allow_partial']) else 0
    
    subtasks = data.get('subtasks')
    if subtasks is None:
        subtasks_json = existing['subtasks']
    else:
        subtasks_json = json.dumps(subtasks)
    
    db_query('''
        UPDATE tasks
        SET title = ?, details = ?, reminder = ?, reminder_time = ?, repeat = ?, positive_points = ?, negative_points = ?, subtasks = ?, allow_partial = ?
        WHERE id = ?
    ''', (title, details, reminder, reminder_time, repeat, positive_points, negative_points, subtasks_json, allow_partial, task_id))
    
    updated = db_query('SELECT * FROM tasks WHERE id = ?', (task_id,), fetchone=True)
    return jsonify(parse_task_dict(updated))

@app.route('/api/tasks/<int:task_id>/toggle_subtask', methods=['POST'])
def toggle_subtask(task_id):
    data = request.get_json() or {}
    subtask_idx = data.get('subtask_index')
    if subtask_idx is None:
        return jsonify({'error': 'subtask_index required'}), 400
        
    task = db_query('SELECT * FROM tasks WHERE id = ?', (task_id,), fetchone=True)
    if not task:
        return jsonify({'error': 'Task not found'}), 404
        
    task_dict = parse_task_dict(task)
    subtasks = task_dict['subtasks']
    
    if 0 <= subtask_idx < len(subtasks):
        subtasks[subtask_idx]['completed'] = not subtasks[subtask_idx].get('completed', False)
        
    db_query('UPDATE tasks SET subtasks = ? WHERE id = ?', (json.dumps(subtasks), task_id))
    
    updated = db_query('SELECT * FROM tasks WHERE id = ?', (task_id,), fetchone=True)
    return jsonify(parse_task_dict(updated))

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    db_query('DELETE FROM tasks WHERE id = ?', (task_id,))
    return jsonify({'success': True, 'id': task_id})

@app.route('/api/tasks/<int:task_id>/complete', methods=['POST'])
def complete_task(task_id):
    task = db_query('SELECT * FROM tasks WHERE id = ?', (task_id,), fetchone=True)
    if not task:
        return jsonify({'error': 'Task not found'}), 404
        
    if task['status'] == 'completed':
        return jsonify({'message': 'Already completed'}), 400
        
    task_dict = parse_task_dict(task)
    subtasks = task_dict['subtasks']
    allow_partial = task_dict['allow_partial']
    pos_points = task['positive_points']
    
    earned_points = pos_points
    if subtasks and len(subtasks) > 0 and allow_partial:
        completed_count = sum(1 for st in subtasks if st.get('completed'))
        ratio = completed_count / len(subtasks)
        earned_points = max(1 if completed_count > 0 else 0, round(ratio * pos_points))
        
    db_query("UPDATE tasks SET status = 'completed' WHERE id = ?", (task_id,))
    db_query('''
        UPDATE user_stats 
        SET total_score = total_score + ?, tasks_completed = tasks_completed + 1
        WHERE id = 1
    ''', (earned_points,))
    
    updated_task = db_query('SELECT * FROM tasks WHERE id = ?', (task_id,), fetchone=True)
    stats = db_query('SELECT total_score, tasks_completed, tasks_failed FROM user_stats WHERE id = 1', fetchone=True)
    
    return jsonify({
        'task': parse_task_dict(updated_task),
        'stats': stats,
        'points_added': earned_points
    })

@app.route('/api/tasks/<int:task_id>/fail', methods=['POST'])
def fail_task(task_id):
    task = db_query('SELECT * FROM tasks WHERE id = ?', (task_id,), fetchone=True)
    if not task:
        return jsonify({'error': 'Task not found'}), 404
        
    if task['status'] == 'failed':
        return jsonify({'message': 'Already marked failed'}), 400
        
    task_dict = parse_task_dict(task)
    subtasks = task_dict['subtasks']
    allow_partial = task_dict['allow_partial']
    neg_points = task['negative_points']
    
    deducted_points = neg_points
    earned_points = 0
    
    if subtasks and len(subtasks) > 0 and allow_partial:
        completed_count = sum(1 for st in subtasks if st.get('completed'))
        total_count = len(subtasks)
        if completed_count > 0:
            earned_ratio = completed_count / total_count
            earned_points = round(earned_ratio * task['positive_points'])
            
            remaining_ratio = (total_count - completed_count) / total_count
            deducted_points = round(remaining_ratio * neg_points)
        
    net_score_change = earned_points - deducted_points
    
    db_query("UPDATE tasks SET status = 'failed' WHERE id = ?", (task_id,))
    db_query('''
        UPDATE user_stats 
        SET total_score = total_score + ?, tasks_failed = tasks_failed + 1
        WHERE id = 1
    ''', (net_score_change,))
    
    updated_task = db_query('SELECT * FROM tasks WHERE id = ?', (task_id,), fetchone=True)
    stats = db_query('SELECT total_score, tasks_completed, tasks_failed FROM user_stats WHERE id = 1', fetchone=True)
    
    return jsonify({
        'task': parse_task_dict(updated_task),
        'stats': stats,
        'points_deducted': deducted_points,
        'points_earned': earned_points,
        'net_change': net_score_change
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
