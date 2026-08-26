from django.urls import path

from .views import (
    FormManagerNginxPublishView,
    FormManagerPageDetailView,
    FormManagerPagesView,
    FormManagerUserPageAccessView,
    FormManagerUsersView,
)


urlpatterns = [
    path("formmanager/users/", FormManagerUsersView.as_view(), name="formmanager-users"),
    path("formmanager/pages/", FormManagerPagesView.as_view(), name="formmanager-pages"),
    path(
        "formmanager/pages/<int:service_id>/",
        FormManagerPageDetailView.as_view(),
        name="formmanager-page-detail",
    ),
    path(
        "formmanager/users/<int:user_id>/pages/<int:service_id>/",
        FormManagerUserPageAccessView.as_view(),
        name="formmanager-user-page-access",
    ),
    path(
        "formmanager/nginx/publish/",
        FormManagerNginxPublishView.as_view(),
        name="formmanager-nginx-publish",
    ),
]
