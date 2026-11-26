# BookHaven — Online Bookstore

A responsive online bookstore built with **React + TypeScript + Vite** and **FastAPI**.

## Features
### Customer storefront
- Browse books, cover images, descriptions and stock availability
- Search by title, author or category; filter and sort the catalogue
- Shopping bag with quantity controls
- Checkout form and order confirmation
- Customer registration and login

### Admin
- Separate admin login and protected admin dashboard
- Dashboard summary: books, orders, customers and low-stock count
- Add, edit and delete books
- Manage title, author, category, price, rating, description, cover URL and stock

### Backend
- FastAPI REST API with SQLAlchemy
- SQLite locally; PostgreSQL supported through `DATABASE_URL`
- Password hashing with PBKDF2 and signed bearer-token sessions
- Admin-only endpoints protected by role checks

## Run locally

### Backend (terminal 1)
```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\\Scripts\\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
fastapi dev main.py
```
API docs: http://localhost:8000/docs

### Frontend (terminal 2)
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

## Demo administrator login
- Email: `admin@bookhaven.com`
- Password: `Admin123!`

The demo admin is created automatically on first database initialization. Change these credentials before public deployment by setting `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables. Also set a long random `BOOKHAVEN_SECRET` value. If the database already has the demo admin account, update that account's password in the database or create a fresh database after changing the environment variables.

## Database and Vercel
Without `DATABASE_URL`, the app uses a local SQLite database (`backend/bookstore.db`). SQLite files are not durable storage on serverless hosting. For production, configure hosted PostgreSQL and set `DATABASE_URL`, `BOOKHAVEN_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in Vercel Project Settings → Environment Variables.

Example:
`postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE`

Push the project to GitHub, import it at https://vercel.com/new, keep the root directory as `./`, configure environment variables, then deploy. `vercel.json` routes `/api/*` to FastAPI and all other paths to the Vite frontend.

## API overview
- `GET /api/health`
- `GET /api/books`
- `GET /api/categories`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/admin/stats` (admin only)
- `POST /api/admin/books` (admin only)
- `PUT /api/admin/books/{book_id}` (admin only)
- `DELETE /api/admin/books/{book_id}` (admin only)
- `POST /api/orders`
- `GET /api/orders/{order_id}`

Checkout records an order but does not process real payments or send delivery notifications. The storefront is a starter project, not a production-hardened commerce platform; add rate limiting, HTTPS, CSRF-aware deployment choices, email verification and payment processing before accepting real customer transactions.
