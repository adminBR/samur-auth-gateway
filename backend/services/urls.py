from django.contrib import admin
from django.urls import path,include
from .views import ServiceCategoriesManager, ServicesManager, ServicesManagerUpdate


urlpatterns = [
    path('categories/', ServiceCategoriesManager.as_view(), name='service-categories'),
    path('', ServicesManager.as_view(), name='services'),
    path('<int:service_id>', ServicesManagerUpdate.as_view(), name='service-detail')
]
