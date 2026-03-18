from django.conf import settings
from rest_framework.exceptions import APIException,AuthenticationFailed
from rest_framework.authentication import get_authorization_header

from utils import database

from datetime import datetime,timedelta,timezone
import jwt

def create_token(userid,username,timeInDays):
    payload = {
        "user_id":userid,
        "user_name":username,
        "expiration":str("inf" if timeInDays == "inf" else datetime.now(tz=timezone.utc)+timedelta(days=timeInDays))
        # Expiration for testing with 1 min duration
        #"expiration":str("inf" if timeInDays == "inf" else datetime.now(tz=timezone.utc)+timedelta(minutes=timeInDays))
        }
    
    token = jwt.encode(payload,settings.SECRET_KEY,algorithm="HS256")
    return token

def decode_token(token):
    payload = jwt.decode(token,settings.SECRET_KEY,algorithms=['HS256'])
    return payload



def get_admin_user_from_token(request):
    auth = get_authorization_header(request).decode()
    if not auth.startswith("Bearer "):
        # Try to get token from cookie if not in header (for potential browser direct access, though API usually uses Header)
        token_from_cookie = request.COOKIES.get('token') # Assuming 'token' is the cookie name used in UserLogin
        if not token_from_cookie:
            raise APIException("Authentication credentials were not provided.")
        token = token_from_cookie
    else:
        token = auth.split(" ")[1]

    try:
        payload = decode_token(token) # extractToken should handle expired/invalid internally if needed, or raise
        expiration_str = payload.get("expiration")
        if not expiration_str:
            raise AuthenticationFailed("Invalid token: Missing expiration.")
        
        if(expiration_str != "inf"):
            expiration = datetime.fromisoformat(expiration_str)
            if expiration < datetime.now(timezone.utc):
                raise AuthenticationFailed("Token expired")

        user_id = payload.get("user_id")
        if not user_id:
            raise AuthenticationFailed("Invalid token: Missing user_id.")

        conn = database.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT usr_admin, usr_login FROM usr_info WHERE usr_id = %s", (user_id,))
            user_record = cur.fetchone()
            if not user_record:
                raise AuthenticationFailed("User not found")
            
            is_admin = user_record[0]
            user_name = user_record[1]

            if not is_admin:
                raise AuthenticationFailed("Admin privileges required.")
            
            return {"user_id": user_id, "user_name": user_name, "is_admin": True}
        finally:
            cur.close()
            conn.close()
    except jwt.ExpiredSignatureError:
        raise AuthenticationFailed("Token expired")
    except jwt.InvalidTokenError:
        raise AuthenticationFailed("Invalid token")
    except AuthenticationFailed as e: # Re-raise APIExceptions with their status codes
        raise e
    except Exception as e:
        # It's good practice to log the actual error `e` here
        print(f"Admin Auth Error: {e}")
        raise APIException("An error occurred during token validation.")
