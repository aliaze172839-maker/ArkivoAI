import os
from sqlalchemy.orm import Session
from database import engine, get_db, Base
from models import User, Organization, Document
from auth import get_password_hash

from sqlalchemy import text

def migrate():
    Base.metadata.create_all(bind=engine)
    db = next(get_db())

    # Add organization_id column to existing documents table
    try:
        db.execute(text("ALTER TABLE documents ADD COLUMN organization_id INTEGER REFERENCES organizations(id)"))
        db.commit()
        print("Added organization_id column to documents table.")
    except Exception as e:
        db.rollback()
        print("Column organization_id may already exist or error:", e)

    # Check if Default Organization exists
    org = db.query(Organization).filter(Organization.name == "Default Organization").first()
    if not org:
        org = Organization(name="Default Organization", invite_code="DEFAULT-ORG-INVITE")
        db.add(org)
        db.commit()
        db.refresh(org)
        print(f"Created Default Organization with ID {org.id}")

    # Check if Default Admin exists
    admin = db.query(User).filter(User.email == "admin@example.com").first()
    if not admin:
        admin = User(
            name="Admin User",
            email="admin@example.com",
            hashed_password=get_password_hash("admin123"),
            role="admin",
            organization_id=org.id
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        print(f"Created Admin User with ID {admin.id}")

    # Migrate existing documents
    unassigned_docs = db.query(Document).filter(Document.organization_id == None).all()
    count = 0
    for doc in unassigned_docs:
        doc.organization_id = org.id
        count += 1
    
    if count > 0:
        db.commit()
        print(f"Migrated {count} existing documents to Default Organization.")
    else:
        print("No documents needed migration.")
        
if __name__ == "__main__":
    migrate()
