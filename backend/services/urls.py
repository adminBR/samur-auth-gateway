from django.contrib import admin
from django.urls import path,include
from .views import (
    ServiceCategoriesManager,
    ServiceFavoriteManager,
    ServiceNextIdManager,
    ServicesManager,
    ServicesManagerUpdate,
)


urlpatterns = [
    path('categories/', ServiceCategoriesManager.as_view(), name='service-categories'),
    path('next-id/', ServiceNextIdManager.as_view(), name='service-next-id'),
    path('<int:service_id>/favorite', ServiceFavoriteManager.as_view(), name='service-favorite'),
    path('', ServicesManager.as_view(), name='services'),
    path('<int:service_id>', ServicesManagerUpdate.as_view(), name='service-detail')
]
