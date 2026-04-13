from backend.database import SessionLocal
from backend.models import User
from backend.auth import get_password_hash

db = SessionLocal()

user = User(
    name="Admin",
    email="adminA@arkivo.com",
    hashed_password=get_password_hash("Arkivo_Admin_2026"),
    role="super_admin"
)

db.add(user)
db.commit()

print("✅ Super admin created")
