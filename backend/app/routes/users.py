from pathlib import Path

from fastapi import APIRouter, Header, HTTPException

from backend.app.db import (
    count_unread_notifications,
    get_user,
    list_notifications,
    list_user_tasks,
    mark_all_notifications_read,
    mark_notification_read,
    update_user_display_name,
    update_user_password,
    verify_password,
)
from backend.app.dependencies import require_username
from backend.app.schemas import (
    AuthResponse,
    ChangePasswordRequest,
    NotificationEntry,
    NotificationListResponse,
    ProfileResponse,
    UpdateProfileRequest,
    UserTaskEntry,
    UserTasksResponse,
)
from backend.app.auth import create_token


def _profile_response(user: dict) -> ProfileResponse:
    return ProfileResponse(
        username=user["username"],
        display_name=user.get("display_name") or user["username"],
        role=user.get("role") or "member",
    )


def create_router(db_path: Path) -> APIRouter:
    router = APIRouter()

    @router.get("/api/users/me", response_model=ProfileResponse)
    def get_me(
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> ProfileResponse:
        username = require_username(authorization, x_username)
        user = get_user(username, db_path)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found.")
        return _profile_response(user)

    @router.put("/api/users/me", response_model=ProfileResponse)
    def update_me(
        payload: UpdateProfileRequest,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> ProfileResponse:
        username = require_username(authorization, x_username)
        try:
            update_user_display_name(username, payload.display_name, db_path)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        user = get_user(username, db_path)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found.")
        return _profile_response(user)

    @router.get(
        "/api/users/me/tasks",
        response_model=UserTasksResponse,
        response_model_exclude_none=True,
    )
    def my_tasks(
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> UserTasksResponse:
        username = require_username(authorization, x_username)
        rows = list_user_tasks(username, db_path)
        return UserTasksResponse(
            username=username,
            tasks=[UserTaskEntry.model_validate(row) for row in rows],
        )

    @router.get(
        "/api/users/me/notifications",
        response_model=NotificationListResponse,
        response_model_exclude_none=True,
    )
    def my_notifications(
        only_unread: bool = False,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> NotificationListResponse:
        username = require_username(authorization, x_username)
        rows = list_notifications(
            username, only_unread=only_unread, db_path=db_path
        )
        unread = count_unread_notifications(username, db_path)
        return NotificationListResponse(
            username=username,
            unread_count=unread,
            notifications=[NotificationEntry.model_validate(row) for row in rows],
        )

    @router.post("/api/users/me/notifications/{notification_id}/read")
    def mark_one_read(
        notification_id: int,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> dict:
        username = require_username(authorization, x_username)
        if not mark_notification_read(username, notification_id, db_path):
            raise HTTPException(status_code=404, detail="Notification not found.")
        return {"unread_count": count_unread_notifications(username, db_path)}

    @router.post("/api/users/me/notifications/read-all")
    def mark_all_read(
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> dict:
        username = require_username(authorization, x_username)
        marked = mark_all_notifications_read(username, db_path)
        return {"marked": marked, "unread_count": 0}

    @router.post("/api/users/me/password", response_model=AuthResponse)
    def change_password(
        payload: ChangePasswordRequest,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> AuthResponse:
        username = require_username(authorization, x_username)
        user = get_user(username, db_path)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found.")
        if not verify_password(payload.current_password, user.get("password_hash")):
            raise HTTPException(status_code=401, detail="Current password is incorrect.")
        try:
            update_user_password(username, payload.new_password, db_path)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        # Issue a fresh token so clients can persist the new session
        # without forcing a logout.
        token = create_token(username)
        return AuthResponse(
            token=token,
            username=user["username"],
            display_name=user.get("display_name") or user["username"],
            role=user.get("role") or "member",
        )

    return router
