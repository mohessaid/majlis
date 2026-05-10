"""
Clerk JWT verification via JWKS.
Session tokens from getToken() are signed JWTs — verified locally using Clerk's public keys.
If CLERK_SECRET_KEY is not set (dev mode), auth is skipped.
"""
import time
import httpx
import jwt
from jwt import PyJWKClient
from typing import Optional
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY

bearer_scheme = HTTPBearer(auto_error=False)

# Derive JWKS URL from the publishable key.
# pk_test_<base64(frontend_api_url + "$")>  →  decode to get the Clerk Frontend API host.
def _jwks_url() -> str:
    if CLERK_PUBLISHABLE_KEY:
        try:
            import base64
            # strip prefix (pk_test_ or pk_live_) and decode
            b64 = CLERK_PUBLISHABLE_KEY.split("_", 2)[-1]
            # add padding
            b64 += "=" * (-len(b64) % 4)
            host = base64.b64decode(b64).decode().rstrip("$")
            return f"https://{host}/.well-known/jwks.json"
        except Exception:
            pass
    # fallback: use Clerk's API JWKS endpoint (requires secret key)
    return "https://api.clerk.com/v1/jwks"

_jwks_client: Optional[PyJWKClient] = None
_jwks_client_ts: float = 0
_JWKS_TTL = 3600  # refresh keys every hour


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client, _jwks_client_ts
    now = time.monotonic()
    if _jwks_client is None or now - _jwks_client_ts > _JWKS_TTL:
        headers = {}
        if "api.clerk.com" in _jwks_url() and CLERK_SECRET_KEY:
            headers = {"Authorization": f"Bearer {CLERK_SECRET_KEY}"}
        _jwks_client = PyJWKClient(_jwks_url(), headers=headers, cache_jwk_set=True)
        _jwks_client_ts = now
    return _jwks_client


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(bearer_scheme),
) -> Optional[str]:
    """Returns Clerk user_id or 'dev-user' if auth is disabled."""
    if not CLERK_SECRET_KEY:
        return "dev-user"

    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    token = credentials.credentials
    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        data = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_exp": True},
        )
        user_id = data.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No user_id in token")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Token verification failed: {e}")
