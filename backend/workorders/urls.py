from django.urls import path
from .views import WorkOrderCreateView

urlpatterns = [
    path('ordens/', WorkOrderCreateView.as_view(), name='workorder-create'),
]
