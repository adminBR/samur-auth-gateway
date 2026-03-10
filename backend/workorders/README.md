# Workorders App

Provides endpoints to create "ordem de serviço" records via the Oracle DB proxy at `192.168.1.16:1111`.

## Endpoint

`POST /api_gateway/v1/workorders/ordens/`

### Headers

- `Authorization: Bearer <JWT>`
- `Content-Type: application/json`

### Body

```
{
  "ClassSel": "",
  "ParadSel": "",
  "PrioSel": "",
  "dsdano": "",
  "dsDescrib": "",
  "dsLocalizacao": 0,
  "dsEquipamento": 0
}
```

### Response

```
{
  "status": "success",
  "proxy_response": {}
}
```
