from pydantic import BaseModel, EmailStr, Field

class UserSignIn(BaseModel):
    """Data model for a user sign-in request."""
    email: EmailStr
    password: str = Field(..., min_length=8)

class UserSignUp(BaseModel):
    """Data model for a user sign-up request."""
    email: EmailStr
    password: str = Field(..., min_length=8)

class ForgotPassword(BaseModel):
    """Data model for initiating a password reset."""
    email: EmailStr

class ConfirmSignUp(BaseModel):
    """Data model for confirming user sign-up."""
    email: EmailStr
    confirmationCode: str = Field(..., min_length=6, max_length=6)

class ConfirmForgotPassword(BaseModel):
    """Data model for confirming password reset."""
    email: EmailStr
    confirmationCode: str = Field(..., min_length=6, max_length=6)
    newPassword: str = Field(..., min_length=8)

class SignOutRequest(BaseModel):
    """Data model for signing out a user."""
    session_token: str

class RefreshTokenRequest(BaseModel):
    """Data model for refreshing tokens."""
    refresh_token: str

class AuthTokens(BaseModel):
    """Data model for returning authentication tokens."""
    id_token: str
    access_token: str
    refresh_token: str

class SuccessResponse(BaseModel):
    """A generic success message response."""
    message: str

class User(BaseModel):
    """Data model for user information."""
    id: str
    email: str

class SignInResponse(BaseModel):
    """Data model for sign-in response."""
    user: User
    sessionToken: str

class SignUpResponse(BaseModel):
    """Data model for sign-up response."""
    userConfirmed: bool
    userId: str 