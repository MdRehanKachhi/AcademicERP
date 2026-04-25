from django.contrib import admin
from django.urls import include, path

from core.views import home, login_view, dashboard, student, faculty, render_page

urlpatterns = [
    path('', home, name='home'),
    path('login/', login_view, name='login'),
    path('dashboard/', dashboard, name='dashboard'),
    path('student/', student, name='student'),
    path('faculty/', faculty, name='faculty'),
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    path('<slug:page_name>/', render_page, name='render_page'),
]
