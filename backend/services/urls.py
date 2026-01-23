from django.contrib import admin
from django.urls import path,include
from .views import ServicesManager, ServicesManagerUpdate, NginxConfigGenerator

urlpatterns = [
    path('', ServicesManager.as_view(), name='services'),
    path('<int:service_id>', ServicesManagerUpdate.as_view(), name='service-detail'),
    path('nginx/config/', NginxConfigGenerator.as_view(), name='nginx-config'),
]