from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .managers import SshManager

# Create your views here.

class SshTestView(APIView):
    """Test nginx syntax on remote server via SSH."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        ssh_manager = SshManager(
            hostname="192.168.1.64",
            username="ti",
            password="123Mudar"
        )
        result = ssh_manager.test_nginx_syntax()
        
        return Response({
            "syntax_status": result["syntax_status"],
            "test_status": result["test_status"]
        })
