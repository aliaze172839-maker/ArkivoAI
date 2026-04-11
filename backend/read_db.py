import sqlite3
c = sqlite3.connect('documents.db').cursor()
for row in c.execute('SELECT error_message FROM documents WHERE status="failed"').fetchall():
    print(row[0])
