import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'documents.db')

def migrate():
    if not os.path.exists(DB_PATH):
        print("Database not found, skipping migration.")
        return
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if parent_id exists
        cursor.execute("PRAGMA table_info(documents)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "parent_id" not in columns:
            print("Adding parent_id column...")
            cursor.execute("ALTER TABLE documents ADD COLUMN parent_id INTEGER;")
            cursor.execute("CREATE INDEX IF NOT EXISTS ix_documents_parent_id ON documents (parent_id);")
            conn.commit()
            print("Migration successful.")
        else:
            print("Column parent_id already exists.")
            
    except Exception as e:
        print(f"Migration error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
