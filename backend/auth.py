"""
Clerk JWT verification middleware.
If CLERK_SECRET_KEY is set, all protected routes require a valid Clerk session token.
If not set (dev mode), auth is skipped.
"""
import httpx
from typing import Optional
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import CLERK_SECRET_KEY

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(bearer_scheme),
) -> Optional[str]:
    """Returns Clerk user_id or None (if auth disabled)."""
    if not CLERK_SECRET_KEY:
        return "dev-user"

    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    token = credentials.credentials
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                "https://api.clerk.com/v1/tokens/verify",
                params={"token": token},
                headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"},
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
            data = resp.json()
            return data.get("sub") or data.get("user_id")
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token verification failed")
