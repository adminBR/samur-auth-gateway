from django.contrib import admin
from django.urls import path,include

from .views import UserRegister,UserLogin,ValidateToken,RefreshToken,UserLogout,AdminAllUsersOperations, AdminSingleUserOperations,AdminListAllServicesView,UserMe

urlpatterns = [
    #path('register/',UserRegister.as_view()),
    path('login/',UserLogin.as_view()),
    path('me/', UserMe.as_view(), name='user-me'),
    path('logout',UserLogout.as_view()),
    path('validate',ValidateToken.as_view()),
    path('refresh/', RefreshToken.as_view()),
    path('admin/', AdminAllUsersOperations.as_view(), name='admin-users-list-create'),
    path('admin/<int:target_user_id>/', AdminSingleUserOperations.as_view(), name='admin-user-detail-operations'),
     path('admin/services/all/', AdminListAllServicesView.as_view(), name='admin-list-all-services'),
]
