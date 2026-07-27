import secrets
import string
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, get_current_user
from app.models.models import DeviceAuthRequest, User
from app.schemas.schemas import (
    ApiResponse,
    DeviceAuthorizeRequest,
    DeviceCodeResponse,
    DeviceTokenRequest,
)

router = APIRouter(prefix="/api/auth/device", tags=["device-auth"])

DEVICE_CODE_EXPIRE_MINUTES = 5
POLL_INTERVAL_SECONDS = 5
VERIFICATION_URI = "/device/authorize"


def _generate_user_code(length: int = 8) -> str:
    """Generate a human-readable user code (e.g. ABCD-1234)."""
    chars = string.ascii_uppercase + string.digits
    raw = "".join(secrets.choice(chars) for _ in range(length))
    return f"{raw[:4]}-{raw[4:]}"


@router.get("/code")
def generate_device_code(db: Session = Depends(get_db)):
    """Generate a one-time device_code and user_code for OAuth device flow.

    The desktop client calls this endpoint, then displays the user_code to
    the user. The user visits verification_uri and enters the code.
    """
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

    return ApiResponse(data=DeviceCodeResponse(
        device_code=device_code,
        user_code=user_code,
        verification_uri=VERIFICATION_URI,
        expires_in=DEVICE_CODE_EXPIRE_MINUTES * 60,
        interval=POLL_INTERVAL_SECONDS,
    ).model_dump())


@router.post("/token")
def poll_device_token(req: DeviceTokenRequest, db: Session = Depends(get_db)):
    """Desktop client polls this endpoint with device_code to get a JWT.

    Returns:
    - 200 with token if the user has authorized the device_code
    - 428 (authorization_pending) if still waiting
    - 410 (expired_token) if the device_code has expired
    - 400 (invalid_grant) if the device_code is invalid or already used
    """
    auth_request = (
        db.query(DeviceAuthRequest)
        .filter(DeviceAuthRequest.device_code == req.device_code)
        .first()
    )

    if not auth_request:
        raise HTTPException(status_code=400, detail="invalid_grant")

    now = datetime.utcnow()

    # Check expiry
    if now > auth_request.expires_at:
        auth_request.status = "expired"
        db.commit()
        raise HTTPException(status_code=410, detail="expired_token")

    # Already used
    if auth_request.status == "used":
        raise HTTPException(status_code=400, detail="invalid_grant")

    # Still pending — user hasn't authorized yet
    if auth_request.status == "pending":
        raise HTTPException(status_code=428, detail="authorization_pending")

    # Authorized — issue JWT
    if auth_request.status == "authorized" and auth_request.user_id:
        user = db.query(User).filter(User.id == auth_request.user_id).first()
        if not user:
            raise HTTPException(status_code=400, detail="invalid_grant")

        token = create_access_token({"sub": str(user.id)})
        auth_request.status = "used"
        db.commit()

        return ApiResponse(data={
            "token": token,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            },
        })

    raise HTTPException(status_code=400, detail="invalid_grant")


@router.post("/authorize")
def authorize_device(
    req: DeviceAuthorizeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Web endpoint: user confirms authorization of a device_code.

    The frontend /device/authorize page calls this after the logged-in
    user clicks "Authorize". Binds the device_code to the current user.
    """
    auth_request = (
        db.query(DeviceAuthRequest)
        .filter(DeviceAuthRequest.user_code == req.user_code)
        .first()
    )

    if not auth_request:
        raise HTTPException(status_code=404, detail="Invalid user code")

    now = datetime.utcnow()
    if now > auth_request.expires_at:
        auth_request.status = "expired"
        db.commit()
        raise HTTPException(status_code=410, detail="Code expired")

    if auth_request.status != "pending":
        raise HTTPException(status_code=400, detail="Code already used")

    auth_request.user_id = current_user.id
    auth_request.status = "authorized"
    db.commit()

    return ApiResponse(message="Device authorized successfully")
