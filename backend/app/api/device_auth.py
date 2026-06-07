"""OAuth Device Flow — 桌面端认证端点。"""
import secrets
import string
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import create_access_token
from app.models.models import DeviceAuthRequest, User
from app.schemas.schemas import DeviceTokenRequest, ApiResponse

router = APIRouter(prefix="/api/auth/device", tags=["device-auth"])

DEVICE_CODE_EXPIRE_MINUTES = 5
USER_CODE_LENGTH = 8
USER_CODE_ALPHABET = string.ascii_uppercase + string.digits


def _generate_user_code() -> str:
    """Generate a human-readable user code like 'ABCD-1234'."""
    raw = "".join(secrets.choice(USER_CODE_ALPHABET) for _ in range(USER_CODE_LENGTH))
    return f"{raw[:4]}-{raw[4:]}"


def _is_expired(expires_at: datetime) -> bool:
    """Check if a datetime has expired, handling naive/aware mismatch."""
    if expires_at.tzinfo is not None:
        from datetime import timezone
        return expires_at < datetime.now(timezone.utc)
    return expires_at < datetime.utcnow()


@router.get("/code")
def get_device_code(db: Session = Depends(get_db)) -> ApiResponse:
    """生成一次性 device_code，返回授权 URL 供桌面端使用。"""
    device_code = secrets.token_urlsafe(48)
    user_code = _generate_user_code()
    expires_at = datetime.utcnow() + timedelta(minutes=DEVICE_CODE_EXPIRE_MINUTES)

    auth_request = DeviceAuthRequest(
        device_code=device_code,
        user_code=user_code,
        status="pending",
        expires_at=expires_at,
    )
    db.add(auth_request)
    db.commit()
    db.refresh(auth_request)

    return ApiResponse(data={
        "device_code": device_code,
        "user_code": user_code,
        "verification_uri": "/api/auth/device/authorize",
        "expires_in": DEVICE_CODE_EXPIRE_MINUTES * 60,
        "interval": 5,
    })


@router.get("/authorize")
def authorize_page(
    user_code: str,
    db: Session = Depends(get_db),
):
    """授权确认页面 — 桌面端用户在浏览器中打开此页面确认授权。

    前端应展示此页面，让用户登录后点击确认。
    确认时前端调用 POST /api/auth/device/confirm 并携带 user_code 和当前用户的 token。
    """
    auth_request = (
        db.query(DeviceAuthRequest)
        .filter(DeviceAuthRequest.user_code == user_code, DeviceAuthRequest.status == "pending")
        .first()
    )
    if not auth_request:
        raise HTTPException(status_code=400, detail="Invalid or expired user code")

    if _is_expired(auth_request.expires_at):
        auth_request.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="User code has expired")

    return ApiResponse(data={
        "user_code": user_code,
        "message": "Please confirm authorization",
    })


@router.post("/confirm")
def confirm_authorization(
    user_code: str,
    token: str,
    db: Session = Depends(get_db),
):
    """网页端确认授权 — 将 device_code 绑定到当前登录用户。

    此端点由前端在用户点击"确认授权"后调用。
    token 为当前登录用户的 JWT token。
    """
    from jose import JWTError, jwt
    from app.core.config import settings

    # Validate the user token
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = int(sub)
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    auth_request = (
        db.query(DeviceAuthRequest)
        .filter(DeviceAuthRequest.user_code == user_code, DeviceAuthRequest.status == "pending")
        .first()
    )
    if not auth_request:
        raise HTTPException(status_code=400, detail="Invalid or expired user code")

    if _is_expired(auth_request.expires_at):
        auth_request.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="User code has expired")

    auth_request.user_id = user.id
    auth_request.status = "authorized"
    db.commit()

    return ApiResponse(data={"message": "Authorization successful"})


@router.post("/token")
def exchange_token(
    req: DeviceTokenRequest,
    db: Session = Depends(get_db),
) -> ApiResponse:
    """桌面端轮询 — 用 device_code 换取 JWT Token。"""
    auth_request = (
        db.query(DeviceAuthRequest)
        .filter(DeviceAuthRequest.device_code == req.device_code)
        .first()
    )
    if not auth_request:
        raise HTTPException(status_code=400, detail="Invalid device code")

    if _is_expired(auth_request.expires_at):
        auth_request.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="Device code has expired")

    if auth_request.status == "pending":
        raise HTTPException(status_code=428, detail="Authorization pending")

    if auth_request.status == "expired":
        raise HTTPException(status_code=400, detail="Device code has expired")

    if auth_request.status != "authorized":
        raise HTTPException(status_code=400, detail="Invalid device code state")

    if auth_request.user_id is None:
        raise HTTPException(status_code=400, detail="Device code not yet authorized")

    # Invalidate the device code so it can't be reused
    auth_request.status = "used"
    db.commit()

    # Generate JWT for the authorized user
    access_token = create_access_token({"sub": str(auth_request.user_id)})

    return ApiResponse(data={
        "access_token": access_token,
        "token_type": "bearer",
    })
