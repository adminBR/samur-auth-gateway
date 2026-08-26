from django.urls import path

from .builder import (
    NginxConfigDeployStreamView,
    NginxConfigDeployView,
    NginxConfigGeneratorView,
    NginxConfigPublishView,
    NginxConfigRestoreStreamView,
    NginxConfigRestoreView,
)

urlpatterns = [
    path('config/', NginxConfigGeneratorView.as_view(), name='nginx-config'),
    path('publish/', NginxConfigPublishView.as_view(), name='nginx-config-publish'),
    path('deploy/', NginxConfigDeployView.as_view(), name='nginx-config-deploy'),
    path('deploy/stream/', NginxConfigDeployStreamView.as_view(), name='nginx-config-deploy-stream'),
    path('restore/', NginxConfigRestoreView.as_view(), name='nginx-config-restore'),
    path('restore/stream/', NginxConfigRestoreStreamView.as_view(), name='nginx-config-restore-stream'),
]
