import json
import os
import sys
from typing import Dict, Any

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Dict, Any

from ..core.services import process_request
from .schemas import UserSignIn, UserSignUp, ConfirmSignUp, ForgotPassword, ConfirmForgotPassword, SignOutRequest, RefreshTokenRequest

router = APIRouter()

@router.post("/signin")
async def sign_in(credentials: UserSignIn):
    status, response = process_request('signin', credentials.model_dump_json())
    if status != 200:
        raise HTTPException(status_code=status, detail=response)
    return response

@router.post("/signup")
async def sign_up(user_details: UserSignUp):
    status, response = process_request('signup', user_details.model_dump_json())
    if status != 201:
        raise HTTPException(status_code=status, detail=response)
    return response

@router.post("/confirm-signup")
async def confirm_signup(request: ConfirmSignUp):
    status, response = process_request('confirm-signup', request.model_dump_json())
    if status != 200:
        raise HTTPException(status_code=status, detail=response)
    return response

@router.post("/forgot-password")
async def forgot_password(request: ForgotPassword):
    status, response = process_request('forgot-password', request.model_dump_json())
    if status != 200:
        raise HTTPException(status_code=status, detail=response)
    return response

@router.post("/confirm-forgot-password")
async def confirm_forgot_password(request: ConfirmForgotPassword):
    status, response = process_request('confirm-forgot-password', request.model_dump_json())
    if status != 200:
        raise HTTPException(status_code=status, detail=response)
    return response

@router.post("/signout")
async def sign_out(request: SignOutRequest):
    status, response = process_request('signout', request.model_dump_json())
    if status != 200:
        raise HTTPException(status_code=status, detail=response)
    return response

@router.post("/refresh-token")
async def refresh_token(request: RefreshTokenRequest):
    status, response = process_request('refresh-token', request.model_dump_json())
    if status != 200:
        raise HTTPException(status_code=status, detail=response)
    return response

@router.options("/{path:path}")
async def options_handler():
    return {}