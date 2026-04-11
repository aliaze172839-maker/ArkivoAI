import re

with open('e:/fiverocr/backend/main.py', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("from models import Document", "from models import Document, User, Organization\nfrom auth import get_current_user, create_access_token, verify_password, get_password_hash\nfrom pydantic import EmailStr\nimport string\nimport random")

auth_code = """
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    action: str  # 'create' or 'join'
    org_name: str = None
    invite_code: str = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

def generate_invite_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

@app.post("/api/auth/register")
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    if payload.action == 'create':
        if not payload.org_name:
            raise HTTPException(status_code=400, detail="Organization name is required")
        org = Organization(name=payload.org_name, invite_code=generate_invite_code())
        db.add(org)
        db.commit()
        db.refresh(org)
        role = "admin"
    elif payload.action == 'join':
        if not payload.invite_code:
            raise HTTPException(status_code=400, detail="Invite code is required")
        org = db.query(Organization).filter(Organization.invite_code == payload.invite_code).first()
        if not org:
            raise HTTPException(status_code=404, detail="Invalid invite code")
        role = "member"
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    new_user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=role,
        organization_id=org.id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"message": "User created successfully"}

@app.post("/api/auth/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
        
    access_token = create_access_token(
        data={"sub": str(user.id), "org_id": user.organization_id, "role": user.role}
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me")
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "organization": {"id": org.id, "name": org.name, "invite_code": org.invite_code}
    }

"""

text = text.replace('@app.post("/api/documents/upload")', auth_code + '\n@app.post("/api/documents/upload")')

def patch_route(match):
    s = match.group(0)
    if "/api/auth/" in s or s.startswith('@app.get("/",'):
        return s
    if "current_user: User = Depends(get_current_user)" not in s:
        s = s.replace("db: Session = Depends(get_db)", "db: Session = Depends(get_db), current_user: User = Depends(get_current_user)")
    return s

route_pattern = re.compile(r'@app\.(get|post|put|delete)\(.*?def .*?\(.*?\):', re.DOTALL)
text = route_pattern.sub(patch_route, text)

text = text.replace("db.query(Document).filter(Document.parent_id == None)", "db.query(Document).filter(Document.parent_id == None, Document.organization_id == current_user.organization_id)")
text = text.replace("db.query(Document).filter(Document.file_type != \"folder\")", "db.query(Document).filter(Document.file_type != \"folder\", Document.organization_id == current_user.organization_id)")
text = text.replace("db.query(Document).filter(Document.id == doc_id)", "db.query(Document).filter(Document.id == doc_id, Document.organization_id == current_user.organization_id)")
text = text.replace("db.query(Document).filter(Document.parent_id == doc_id)", "db.query(Document).filter(Document.parent_id == doc_id, Document.organization_id == current_user.organization_id)")

delete_all_auth = """    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete documents")
    """
    
text = text.replace('def delete_all_documents(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):\n    """Delete ALL documents and their files from disk."""\n    try:\n', 'def delete_all_documents(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):\n    """Delete ALL documents and their files from disk."""\n' + delete_all_auth + '    try:\n')

delete_one_auth = """    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete documents")
    """

text = text.replace('def delete_document(doc_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):\n    doc = db.query(Document)', 'def delete_document(doc_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):\n' + delete_one_auth + '    doc = db.query(Document)')

text = text.replace("""doc = Document(
        filename=stored_filename,
        original_filename=file.filename,
        file_type=ext,
        file_size=len(content),
        status="processing",
    )""", """doc = Document(
        filename=stored_filename,
        original_filename=file.filename,
        file_type=ext,
        file_size=len(content),
        status="processing",
        organization_id=current_user.organization_id,
    )""")

text = text.replace("""child_doc = Document(
                    parent_id=doc.id,
                    filename=stored_filename,
                    original_filename=f"{file.filename} - Page {page_data['page']}",
                    file_type="pdf",
                    file_size=len(content),
                    status="completed",
                    extracted_text=page_data["text"],
                    page_count=1,
                    ocr_layout_data=json.dumps([page_data], ensure_ascii=False)
                )""", """child_doc = Document(
                    parent_id=doc.id,
                    filename=stored_filename,
                    original_filename=f"{file.filename} - Page {page_data['page']}",
                    file_type="pdf",
                    file_size=len(content),
                    status="completed",
                    extracted_text=page_data["text"],
                    page_count=1,
                    ocr_layout_data=json.dumps([page_data], ensure_ascii=False),
                    organization_id=current_user.organization_id
                )""")

with open('e:/fiverocr/backend/main.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("Patching complete!")
