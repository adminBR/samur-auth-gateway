from django.contrib import admin
from django.urls import path,include
from .builder import NginxConfigGeneratorView

urlpatterns = [
    path('config/', NginxConfigGeneratorView.as_view(), name='nginx-config'),
]