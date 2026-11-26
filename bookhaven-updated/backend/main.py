import os, base64, hashlib, hmac, secrets, json, time
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, String, Integer, Float, DateTime, ForeignKey, or_, Boolean
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./bookstore.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(300))
    role: Mapped[str] = mapped_column(String(20), default="customer")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Book(Base):
    __tablename__ = "books"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    author: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(80), index=True)
    price: Mapped[float] = mapped_column(Float)
    rating: Mapped[float] = mapped_column(Float, default=4.5)
    description: Mapped[str] = mapped_column(String(1200))
    cover: Mapped[str] = mapped_column(String(500))
    stock: Mapped[int] = mapped_column(Integer, default=10)

class Order(Base):
    __tablename__ = "orders"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    customer_name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(200))
    address: Mapped[str] = mapped_column(String(500))
    total: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(40), default="Received")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    book_id: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[float] = mapped_column(Float)
    order: Mapped[Order] = relationship(back_populates="items")

Base.metadata.create_all(bind=engine)

SEED = [
    ("Atomic Habits", "James Clear", "Self Development", 18.99, 4.8, "A practical guide to building good habits, breaking bad ones, and making small changes that deliver remarkable results.", "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg", 18),
    ("The Psychology of Money", "Morgan Housel", "Business", 16.50, 4.7, "Timeless lessons on wealth, greed, happiness, and the way people think about money.", "https://covers.openlibrary.org/b/isbn/9780857197689-L.jpg", 12),
    ("Ikigai", "Héctor García & Francesc Miralles", "Lifestyle", 14.25, 4.5, "Discover the Japanese secret to a long and happy life through purpose, community, and balance.", "https://covers.openlibrary.org/b/isbn/9780143130727-L.jpg", 9),
    ("Clean Code", "Robert C. Martin", "Technology", 32.00, 4.6, "A handbook of agile software craftsmanship and writing readable, maintainable code.", "https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg", 7),
    ("The Alchemist", "Paulo Coelho", "Fiction", 13.99, 4.7, "A magical story about following your dreams and listening to your heart.", "https://covers.openlibrary.org/b/isbn/9780061122415-L.jpg", 20),
    ("Deep Work", "Cal Newport", "Self Development", 17.75, 4.6, "Rules for focused success in a distracted world.", "https://covers.openlibrary.org/b/isbn/9781455586691-L.jpg", 11),
    ("The Pragmatic Programmer", "David Thomas & Andrew Hunt", "Technology", 29.50, 4.8, "A collection of practical techniques for becoming a better and more effective programmer.", "https://covers.openlibrary.org/b/isbn/9780135957059-L.jpg", 6),
    ("Sapiens", "Yuval Noah Harari", "History", 21.00, 4.6, "A brief and thought-provoking history of humankind, from early humans to the modern age.", "https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg", 14),
]

app = FastAPI(title="BookHaven API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def seed_books():
    with SessionLocal() as db:
        if db.query(Book).count() == 0:
            for row in SEED:
                db.add(Book(title=row[0], author=row[1], category=row[2], price=row[3],
                            rating=row[4], description=row[5], cover=row[6], stock=row[7]))
            db.commit()

seed_books()


# Passwords use PBKDF2 and sessions use signed bearer tokens.
SECRET_KEY = os.getenv("BOOKHAVEN_SECRET", "change-this-secret-before-production")
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 210_000)
    return base64.urlsafe_b64encode(salt + digest).decode()

def verify_password(password: str, encoded: str) -> bool:
    try:
        raw = base64.urlsafe_b64decode(encoded.encode())
        salt, expected = raw[:16], raw[16:]
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 210_000)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False

def make_token(user: User) -> str:
    payload = {"sub": user.id, "email": user.email, "role": user.role,
               "exp": int(time.time()) + 60 * 60 * 24 * 7}
    body = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
    sig = hmac.new(SECRET_KEY.encode(), body.encode(), hashlib.sha256).digest()
    signature = base64.urlsafe_b64encode(sig).decode().rstrip("=")
    return body + "." + signature

def current_user(authorization: str = Header(default="")):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Please log in")
    try:
        body, signature = authorization[7:].split(".", 1)
        expected = base64.urlsafe_b64encode(
            hmac.new(SECRET_KEY.encode(), body.encode(), hashlib.sha256).digest()
        ).decode().rstrip("=")
        if not hmac.compare_digest(signature, expected):
            raise ValueError("Invalid signature")
        payload = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
        if payload["exp"] < int(time.time()):
            raise ValueError("Expired token")
        with SessionLocal() as db:
            user = db.get(User, int(payload["sub"]))
            if not user:
                raise ValueError("Unknown user")
            return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired login session")

def require_admin(user=Depends(current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def seed_admin():
    with SessionLocal() as db:
        email = os.getenv("ADMIN_EMAIL", "admin@bookhaven.com").lower()
        if not db.query(User).filter(User.email == email).first():
            db.add(User(name="BookHaven Admin", email=email,
                        password_hash=hash_password(os.getenv("ADMIN_PASSWORD", "Admin123!")),
                        role="admin"))
            db.commit()

seed_admin()

def book_dict(book: Book):
    return {"id": book.id, "title": book.title, "author": book.author,
            "category": book.category, "price": book.price, "rating": book.rating,
            "description": book.description, "cover": book.cover, "stock": book.stock}


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    email: str
    password: str = Field(min_length=8, max_length=128)

class LoginRequest(BaseModel):
    email: str
    password: str

class BookCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    author: str = Field(min_length=1, max_length=160)
    category: str = Field(min_length=1, max_length=80)
    price: float = Field(gt=0)
    rating: float = Field(default=4.5, ge=0, le=5)
    description: str = Field(min_length=1, max_length=1200)
    cover: str = Field(min_length=1, max_length=500)
    stock: int = Field(default=0, ge=0)

@app.post("/api/auth/register", status_code=201)
def register(payload: RegisterRequest):
    email = payload.email.strip().lower()
    with SessionLocal() as db:
        if db.query(User).filter(User.email == email).first():
            raise HTTPException(status_code=409, detail="An account with this email already exists")
        user = User(name=payload.name.strip(), email=email,
                    password_hash=hash_password(payload.password), role="customer")
        db.add(user); db.commit(); db.refresh(user)
        return {"token": make_token(user), "user": {"id": user.id, "name": user.name,
                "email": user.email, "role": user.role}}

@app.post("/api/auth/login")
def login(payload: LoginRequest):
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
        if not user or not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Incorrect email or password")
        return {"token": make_token(user), "user": {"id": user.id, "name": user.name,
                "email": user.email, "role": user.role}}

@app.get("/api/auth/me")
def me(user=Depends(current_user)):
    return user

@app.get("/api/admin/stats")
def admin_stats(admin=Depends(require_admin)):
    with SessionLocal() as db:
        return {"books": db.query(Book).count(), "orders": db.query(Order).count(),
                "customers": db.query(User).filter(User.role == "customer").count(),
                "low_stock": db.query(Book).filter(Book.stock < 5).count()}

@app.post("/api/admin/books", status_code=201)
def admin_create_book(payload: BookCreate, admin=Depends(require_admin)):
    with SessionLocal() as db:
        book = Book(**payload.model_dump())
        db.add(book); db.commit(); db.refresh(book)
        return book_dict(book)

@app.put("/api/admin/books/{book_id}")
def admin_update_book(book_id: int, payload: BookCreate, admin=Depends(require_admin)):
    with SessionLocal() as db:
        book = db.get(Book, book_id)
        if not book: raise HTTPException(status_code=404, detail="Book not found")
        for key, value in payload.model_dump().items(): setattr(book, key, value)
        db.commit(); db.refresh(book)
        return book_dict(book)

@app.delete("/api/admin/books/{book_id}")
def admin_delete_book(book_id: int, admin=Depends(require_admin)):
    with SessionLocal() as db:
        book = db.get(Book, book_id)
        if not book: raise HTTPException(status_code=404, detail="Book not found")
        db.delete(book); db.commit()
        return {"message": "Book deleted"}

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "BookHaven API"}

@app.get("/api/books")
def get_books(search: Optional[str] = None, category: Optional[str] = None,
              sort: str = Query("featured", pattern="^(featured|price_asc|price_desc|rating)$")):
    with SessionLocal() as db:
        query = db.query(Book)
        if search:
            term = f"%{search.strip()}%"
            query = query.filter(or_(Book.title.ilike(term), Book.author.ilike(term), Book.category.ilike(term)))
        if category and category != "All":
            query = query.filter(Book.category == category)
        if sort == "price_asc": query = query.order_by(Book.price.asc())
        elif sort == "price_desc": query = query.order_by(Book.price.desc())
        elif sort == "rating": query = query.order_by(Book.rating.desc())
        else: query = query.order_by(Book.id.asc())
        return [book_dict(book) for book in query.all()]

@app.get("/api/categories")
def get_categories():
    with SessionLocal() as db:
        return ["All"] + [row[0] for row in db.query(Book.category).distinct().order_by(Book.category).all()]

class CheckoutItem(BaseModel):
    book_id: int
    quantity: int = Field(ge=1, le=50)

class CheckoutRequest(BaseModel):
    customer_name: str = Field(min_length=2, max_length=160)
    email: str
    address: str = Field(min_length=5, max_length=500)
    items: list[CheckoutItem] = Field(min_length=1)

@app.post("/api/orders", status_code=201)
def create_order(payload: CheckoutRequest):
    with SessionLocal() as db:
        order_items = []
        total = 0.0
        for item in payload.items:
            book = db.get(Book, item.book_id)
            if not book:
                raise HTTPException(status_code=404, detail=f"Book {item.book_id} was not found")
            if book.stock < item.quantity:
                raise HTTPException(status_code=400, detail=f"Not enough stock for {book.title}")
            total += book.price * item.quantity
            order_items.append((book, item.quantity))
        order = Order(customer_name=payload.customer_name, email=payload.email,
                      address=payload.address, total=round(total, 2))
        db.add(order)
        db.flush()
        for book, quantity in order_items:
            book.stock -= quantity
            db.add(OrderItem(order_id=order.id, book_id=book.id, title=book.title,
                             quantity=quantity, unit_price=book.price))
        db.commit()
        return {"order_id": order.id, "total": round(total, 2), "status": order.status,
                "message": "Your order has been placed successfully."}

@app.get("/api/orders/{order_id}")
def get_order(order_id: int):
    with SessionLocal() as db:
        order = db.get(Order, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        return {"id": order.id, "customer_name": order.customer_name, "email": order.email,
                "address": order.address, "total": order.total, "status": order.status,
                "created_at": order.created_at.isoformat(),
                "items": [{"book_id": i.book_id, "title": i.title, "quantity": i.quantity,
                           "unit_price": i.unit_price} for i in order.items]}
