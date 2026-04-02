from django.urls import path

from .views import AdminAuthAccessAnalyticsView


urlpatterns = [
    path(
        "auth-access/",
        AdminAuthAccessAnalyticsView.as_view(),
        name="admin-auth-access-analytics",
    ),
]

