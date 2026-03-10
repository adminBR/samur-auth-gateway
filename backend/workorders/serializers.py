from rest_framework import serializers


class WorkOrderRequestSerializer(serializers.Serializer):
    ClassSel = serializers.CharField(max_length=10)
    ParadSel = serializers.CharField(max_length=10)
    PrioSel = serializers.CharField(max_length=10)
    dsdano = serializers.CharField(max_length=255)
    dsDescrib = serializers.CharField()
    dsLocalizacao = serializers.IntegerField()
    dsEquipamento = serializers.IntegerField()
