from database import SessionLocal
from models import User, Organization
from auth import get_password_hash

db = SessionLocal()

# Check if admin org exists or create
org = db.query(Organization).filter(Organization.name == "Arkivo Core").first()
if not org:
    org = Organization(name="Arkivo Core", invite_code="ARKIVO-CORE")
    db.add(org)
    db.commit()
    db.refresh(org)

# Check if adminA exists
user = db.query(User).filter(User.email == "adminA@arkivo.com").first()
if not user:
    user = User(
        name="adminA",
        email="adminA@arkivo.com",
        hashed_password=get_password_hash("Arkivo_Admin_2026"),
        role="super_admin",
        organization_id=org.id
    )
    db.add(user)
    db.commit()
    print("Super Admin created successfully!")
else:
    user.role = "super_admin"
    user.hashed_password = get_password_hash("Arkivo_Admin_2026")
    db.commit()
    print("Super Admin updated successfully!")

db.close()
