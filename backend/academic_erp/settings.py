import os
from pathlib import Path
from corsheaders.defaults import default_headers

# ==============================
# BASE CONFIG
# ==============================
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"


# ==============================
# LOAD ENV FILE
# ==============================
def load_env_file(env_path):
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


load_env_file(ENV_FILE)


def get_env(name, default=None):
    return os.environ.get(name, default)


# ==============================
# SECURITY
# ==============================
SECRET_KEY = get_env("DJANGO_SECRET_KEY", "django-insecure-dev-key")

DEBUG = get_env("DJANGO_DEBUG", "True").lower() == "true"

ALLOWED_HOSTS = [
    host.strip()
    for host in get_env("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")
    if host.strip()
]


# ==============================
# INSTALLED APPS
# ==============================
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    "corsheaders",
    "rest_framework",

    "core",   # your app
]


# ==============================
# MIDDLEWARE (FIXED)
# ==============================
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",

    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",

    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",

    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


# ==============================
# URLS / WSGI
# ==============================
ROOT_URLCONF = "academic_erp.urls"

WSGI_APPLICATION = "academic_erp.wsgi.application"
ASGI_APPLICATION = "academic_erp.asgi.application"


# ==============================
# TEMPLATES
# ==============================
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# ==============================
# DATABASE (POSTGRESQL)
# ==============================
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": get_env("DB_NAME", "academic_erp"),
        "USER": get_env("DB_USER", "postgres"),
        "PASSWORD": get_env("DB_PASSWORD", ""),
        "HOST": get_env("DB_HOST", "127.0.0.1"),
        "PORT": get_env("DB_PORT", "5432"),
    }
}


# ==============================
# PASSWORD VALIDATION
# ==============================
AUTH_PASSWORD_VALIDATORS = []


# ==============================
# INTERNATIONALIZATION
# ==============================
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True


# ==============================
# STATIC FILES
# ==============================
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"


# ==============================
# DEFAULT PRIMARY KEY
# ==============================
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ==============================
# CORS SETTINGS
# ==============================
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_HEADERS = list(default_headers) + [
    "x-student-email",
]


# ==============================
# DRF SETTINGS
# ==============================
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
}