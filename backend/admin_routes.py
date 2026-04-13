from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any

from backend.database import get_db
from backend.models import User, Organization, Document
from backend.auth import require_admin, require_super_admin, get_password_hash
from pydantic import BaseModel, EmailStr, Field

# Router for Super Admin endpoints (Global)
admin_router = APIRouter(prefix="/api/admin", tags=["Super Admin"])

# Router for Organization Admin endpoints (Team Level)
org_router = APIRouter(prefix="/api/org", tags=["Organization"])


# ── SUPER ADMIN ROUTES ───────────────────────────────────────────────────────

@admin_router.get("/organizations")
def get_all_organizations(db: Session = Depends(get_db), current_user: User = Depends(require_super_admin)):
    orgs = db.query(Organization).order_by(Organization.created_at.asc()).all()
    all_users = db.query(User).all()
    all_docs = db.query(Document).all()

    result = []
    for org in orgs:
        org_users = [u for u in all_users if u.organization_id == org.id]
        has_admin = any(u.role == "admin" for u in org_users)
        
        # Skip organizations that don't have any 'admin' users (orphaned orgs, or the core super_admin org)
        if not has_admin:
            continue
            
        doc_count = sum(1 for d in all_docs if d.organization_id == org.id)
        result.append({
            "id": org.id,
            "name": org.name,
            "invite_code": org.invite_code,
            "created_at": org.created_at.isoformat() if org.created_at else None,
            "user_count": len(org_users),
            "doc_count": doc_count
        })
    return result

@admin_router.get("/users")
def get_all_users(db: Session = Depends(get_db), current_user: User = Depends(require_super_admin)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    # Group orgs in memory to avoid N+1 database queries
    orgs_map = {org.id: org for org in db.query(Organization).all()}
    
    result = []
    for user in users:
        org = orgs_map.get(user.organization_id)
        result.append({
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "organization": {"id": org.id, "name": org.name} if org else None,
            "created_at": user.created_at.isoformat() if user.created_at else None
        })
    
    # Sort to ensure super_admin is always at the top (stable sort preserves date order)
    result.sort(key=lambda x: 0 if x["role"] == "super_admin" else 1)
    
    return result

@admin_router.get("/organization/{org_id}/users")
def get_org_users(org_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_super_admin)):
    users = db.query(User).filter(User.organization_id == org_id).order_by(User.created_at.desc()).all()
    result = []
    for user in users:
        result.append({
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "created_at": user.created_at.isoformat() if user.created_at else None
        })
    return result

@admin_router.delete("/user/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_super_admin)):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    user_to_delete = db.query(User).filter(User.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user_to_delete.role == "super_admin":
        raise HTTPException(status_code=400, detail="Cannot delete another super_admin")

    db.delete(user_to_delete)
    db.commit()
    return {"message": "User deleted successfully", "id": user_id}

class RoleUpdate(BaseModel):
    role: str = Field(..., pattern="^(member|admin|super_admin)$")

@admin_router.put("/user/{user_id}/role")
def update_user_role(user_id: int, payload: RoleUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_super_admin)):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
        
    user_to_update = db.query(User).filter(User.id == user_id).first()
    if not user_to_update:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user_to_update.role == "super_admin" and payload.role != "super_admin":
        raise HTTPException(status_code=400, detail="Cannot demote another super_admin")

    user_to_update.role = payload.role
    db.commit()
    return {"message": "User role updated successfully", "id": user_id, "role": payload.role}


# ── ORGANIZATION ADMIN ROUTES ────────────────────────────────────────────────

@org_router.get("/team")
def get_team_members(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    org_id = current_user.organization_id
    users = db.query(User).filter(User.organization_id == org_id).order_by(User.created_at.desc()).all()
    result = []
    for user in users:
        result.append({
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "created_at": user.created_at.isoformat() if user.created_at else None
        })
    return result

class NewTeamMember(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field("member", pattern="^(member|admin)$")

@org_router.post("/team")
def add_team_member(payload: NewTeamMember, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    org_id = current_user.organization_id
    
    # Check if email exists
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    new_user = User(
        name=payload.name.strip(),
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
        organization_id=org_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "id": new_user.id,
        "name": new_user.name,
        "email": new_user.email,
        "role": new_user.role,
        "message": "Team member added successfully"
    }

@org_router.delete("/team/{user_id}")
def remove_team_member(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself from the team")
        
    user_to_remove = db.query(User).filter(User.id == user_id, User.organization_id == current_user.organization_id).first()
    if not user_to_remove:
        raise HTTPException(status_code=404, detail="User not found in your organization")
        
    if user_to_remove.role == "super_admin":
        raise HTTPException(status_code=403, detail="Cannot remove a super_admin")

    db.delete(user_to_remove)
    db.commit()
    return {"message": "Team member removed successfully", "id": user_id}

class OrgRoleUpdate(BaseModel):
    role: str = Field(..., pattern="^(member|admin)$")

@org_router.put("/team/{user_id}/role")
def update_team_member_role(user_id: int, payload: OrgRoleUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
        
    user_to_update = db.query(User).filter(User.id == user_id, User.organization_id == current_user.organization_id).first()
    if not user_to_update:
        raise HTTPException(status_code=404, detail="User not found in your organization")
        
    if user_to_update.role == "super_admin":
        raise HTTPException(status_code=403, detail="Cannot modify a super_admin")

    user_to_update.role = payload.role
    db.commit()
    return {"message": "Team member role updated successfully", "id": user_id, "role": payload.role}
