import logging
from datetime import datetime, timedelta

from django.utils.timezone import make_aware
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import WorkOrderRequestSerializer
from .services import execute_db_proxy

logger = logging.getLogger(__name__)


def _date_with_offset(days: int) -> str:
    base = datetime.utcnow()
    target = make_aware(base + timedelta(days=days))
    return target.strftime("%Y/%m/%d %H:%M:%S")


class WorkOrderCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WorkOrderRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payload = serializer.validated_data
        user_name = request.user.username if request.user else ""

        insert_query = self._build_insert_query(payload, user_name)
        try:
            proxy_response = execute_db_proxy(insert_query)
            logger.info("Work order created via proxy for user %s", user_name)
            return Response({"status": "success", "proxy_response": proxy_response})
        except Exception as exc:  # requests.HTTPError, etc.
            logger.exception("Failed to create work order: %s", exc)
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

    @staticmethod
    def _build_insert_query(data, user_name: str) -> str:
        seq_subquery = "(SELECT MAX(NR_SEQUENCIA)+1 FROM MAN_ORDEM_SERVICO)"
        current_ts = _date_with_offset(0)
        desired_end = _date_with_offset(2)

        query = f"""
        INSERT INTO MAN_ORDEM_SERVICO (
            NR_SEQUENCIA,
            NR_SEQ_LOCALIZACAO,
            NR_SEQ_EQUIPAMENTO,
            CD_PESSOA_SOLICITANTE,
            DT_ORDEM_SERVICO,
            IE_PRIORIDADE,
            IE_PARADO,
            DS_DANO_BREVE,
            DT_ATUALIZACAO,
            NM_USUARIO,
            DT_INICIO_DESEJADO,
            DT_CONCLUSAO_DESEJADA,
            DS_DANO,
            IE_TIPO_ORDEM,
            IE_STATUS_ORDEM,
            NR_GRUPO_PLANEJ,
            NR_GRUPO_TRABALHO,
            IE_CLASSIFICACAO,
            DT_ATUALIZACAO_NREC,
            NM_USUARIO_NREC,
            IE_OBRIGA_NEWS,
            IE_OS_RELATORIO,
            IE_ORIGEM_OS,
            IE_ENVOLVE_TREINAMENTO,
            IE_ORIENTACAO_SATISFACAO,
            IE_ATUALIZACAO_MIGRACAO,
            IE_OBRIGAR_AVALIACAO,
            IE_SOLIC_VIP
        ) VALUES (
            {seq_subquery},
            {data['dsLocalizacao']},
            {data['dsEquipamento']},
            Obter_Cod_PF_Usuario('{user_name}'),
            TO_DATE('{current_ts}', 'YYYY/MM/DD HH24:MI:SS'),
            '{data['PrioSel']}',
            '{data['ParadSel']}',
            '{data['dsdano']}',
            TO_DATE('{current_ts}', 'YYYY/MM/DD HH24:MI:SS'),
            '{user_name}',
            TO_DATE('{current_ts}', 'YYYY/MM/DD HH24:MI:SS'),
            TO_DATE('{desired_end}', 'YYYY/MM/DD HH24:MI:SS'),
            '{data['dsDescrib']}',
            1,
            '1',
            22,
            12,
            '{data['ClassSel']}',
            TO_DATE('{current_ts}', 'YYYY/MM/DD HH24:MI:SS'),
            '{user_name}',
            'S',
            'N',
            '4',
            'N',
            'N',
            'P',
            'N',
            'N'
        )
        """
        return " ".join(line.strip() for line in query.strip().splitlines())
