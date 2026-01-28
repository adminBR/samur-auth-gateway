from django.contrib import admin
from django.urls import path,include
from .builder import NginxConfigGeneratorView, NginxConfigDeployView,NginxConfigRestoreView

urlpatterns = [
    path('config/', NginxConfigGeneratorView.as_view(), name='nginx-config'),
    path('deploy/', NginxConfigDeployView.as_view(), name='nginx-config-deploy'),
    path('restore/', NginxConfigRestoreView.as_view(), name='nginx-config-restore'),
]