from rest_framework import serializers

class addServiceSerializer(serializers.Serializer):
    srv_image = serializers.ImageField(required=True)
    srv_name = serializers.CharField(required=True)
    srv_ip = serializers.CharField(required=True)
    srv_desc = serializers.CharField(required=True)
    srv_category = serializers.IntegerField(required=False)
    
class updateServiceSerializer(serializers.Serializer):
    srv_image = serializers.ImageField(required=False)
    srv_name = serializers.CharField(required=False)
    srv_ip = serializers.CharField(required=False)
    srv_desc = serializers.CharField(required=False)
    srv_category = serializers.IntegerField(required=False)


