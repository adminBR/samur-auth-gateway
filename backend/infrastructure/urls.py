from django.contrib import admin
from django.urls import path,include
from .views import SshTestView

urlpatterns = [
    # Infrastructure (was SshManager)
    path('api/ssh/test/', SshTestView.as_view(), name='ssh-test'),
    
]