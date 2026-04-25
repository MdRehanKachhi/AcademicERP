# Academic ERP

This project now includes a Django backend configured for PostgreSQL, alongside the existing static frontend.

## Backend stack

- Python
- Django
- Django REST Framework
- PostgreSQL

## Backend setup

1. Install PostgreSQL and create the database:

```powershell
psql -U postgres -c "CREATE DATABASE academic_erp;"
```

If you need a dedicated user, create one and grant privileges:

```powershell
psql -U postgres -c "CREATE USER academic_user WITH PASSWORD 'postgres';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE academic_erp TO academic_user;"
```

2. Create and activate a virtual environment:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

3. Create `backend/.env` from `backend/.env.example` and fill in your database settings:

```powershell
cd backend
Copy-Item .env.example .env
```

Example `backend/.env` for local PostgreSQL:

```text
DJANGO_SECRET_KEY=change-me
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost

DB_NAME=academic_erp
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=127.0.0.1
DB_PORT=5432
```

You can still override these with environment variables in PowerShell if needed:

```powershell
$env:DB_NAME="academic_erp"
$env:DB_USER="postgres"
$env:DB_PASSWORD="postgres"
$env:DB_HOST="127.0.0.1"
$env:DB_PORT="5432"
```

4. Run migrations and start the server:

```powershell
python manage.py makemigrations
python manage.py migrate
python manage.py runserver
```

5. Verify the API:

```text
http://127.0.0.1:8000/api/health/
```

## Deployment notes

- `requirements.txt` includes `psycopg2-binary` for the PostgreSQL adapter and `gunicorn` for production.
- On Render or another host, set these environment variables:
  - `DB_NAME`
  - `DB_USER`
  - `DB_PASSWORD`
  - `DB_HOST`
  - `DB_PORT`
  - `DJANGO_SECRET_KEY`
  - `DJANGO_DEBUG=False`
  - `DJANGO_ALLOWED_HOSTS` to your deployed domain
- Use `gunicorn academic_erp.wsgi:application` as the production entry point.

## API routes

- `/api/classes/`
- `/api/students/`
- `/api/faculty/`
- `/api/subjects/`
- `/api/assignments/`
- `/api/leaves/`
- `/api/marks/`
- `/api/student-attendance/`
- `/api/staff-attendance/`

## Frontend bridge

`frontend/js/api.js` contains fetch helpers for connecting the existing frontend to the Django API.
