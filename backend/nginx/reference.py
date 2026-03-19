HEADER_DEFAULT = """ 
#ip of the django backend
upstream django {
  server 192.168.2.131:1112;
}

server {
  listen 80;
  server_name indicadores.samur.br 192.168.2.131;
  set $dashboards 192.168.1.64;
  proxy_connect_timeout 300s;
  proxy_send_timeout 300s;
  proxy_read_timeout 300s;
  send_timeout 300s;

# ——————————————————————————————
# 1) SPA static or dev server
# ——————————————————————————————
location / {
  proxy_pass http://127.0.0.1:1111;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

# ——————————————————————————————
# 2) Login endpoint (no auth)
# ——————————————————————————————
location = /api_gateway/v1/users/login/ {
  proxy_pass         http://django;
  proxy_set_header   Host $host;
  proxy_set_header   X-Real-IP $remote_addr;
}

# ——————————————————————————————
# 3) Internal validate subrequest
# ——————————————————————————————
location = /_auth {
  internal;
  proxy_pass              http://django/api_gateway/v1/users/validate;
  proxy_pass_request_body off;
  proxy_set_header        Host $host;
  proxy_set_header        X-Service-ID $service_id;
  proxy_set_header        Content-Length "";
  proxy_set_header        Cookie $http_cookie;
}

# Catch-all for other /api routes (like /validate)
location /api_gateway/ {
  proxy_pass         http://django;
  proxy_set_header   Host $host;
  proxy_set_header   X-Real-IP $remote_addr;
  proxy_connect_timeout 300s;
  proxy_send_timeout 300s;
  proxy_read_timeout 300s;
}
"""


FOOTER_DEFAULT = """
# ——————————————————————————————
# unauthenticated interceptor, sending back to login or return a json
# ——————————————————————————————

  error_page 401 = @redirect_login;
  location @redirect_login {
    return 302 /login?next=$request_uri;
  }
# redirect when a host is invalid or offline
  error_page 502 = @invalid_page;
  location @invalid_page {
    default_type application/json;
    return 502 '{"error":"Esta página está em manutenção, aguarde alguns minutos e tente novamente..."}';
  }

# custom JSON 401
#  error_page 401 = @err401;
  location @err401 {
    add_header Content-Type application/json;
    return 401 '{"error":"Unauthorized"}';
  }
# custom JSON 404
  error_page 404 = @err404;
  location @err404 {
    add_header Content-Type application/json;
    return 404 '{"error":"Not found"}';
  }
}
"""
