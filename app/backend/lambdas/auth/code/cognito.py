import boto3
import logging
import os
from functools import lru_cache
from botocore.exceptions import ClientError
from typing import Optional

import schemas

logger = logging.getLogger(__name__)

class CognitoAdapter:
    """
    An adapter that implements authentication for AWS Cognito.
    """

    def __init__(self, region: str, user_pool_id: str, client_id: str):
        self.cognito_client = boto3.client('cognito-idp', region_name=region)
        self.user_pool_id = user_pool_id
        self.client_id = client_id
        logger.info(f"Initialized Cognito adapter for user pool: {user_pool_id}")

    def sign_in(self, user_credentials: schemas.UserSignIn) -> dict:
        """Authenticate a user and return tokens."""
        try:
            logger.info(f"Attempting sign-in for user: {user_credentials.email}")
            
            response = self.cognito_client.initiate_auth(
                AuthFlow='USER_PASSWORD_AUTH',
                AuthParameters={
                    'USERNAME': user_credentials.email,
                    'PASSWORD': user_credentials.password,
                },
                ClientId=self.client_id
            )
            
            # Check if authentication was successful or if a challenge is required
            if 'AuthenticationResult' in response:
                auth_result = response['AuthenticationResult']
                logger.info(f"Successful sign-in for user: {user_credentials.email}")
                
                return {
                    "user": {
                        "id": user_credentials.email,
                        "email": user_credentials.email
                    },
                    "access_token": auth_result['AccessToken'],
                    "refresh_token": auth_result.get('RefreshToken', ''),
                    "id_token": auth_result.get('IdToken', '')
                }
            
            # Handle challenges
            elif 'ChallengeName' in response:
                challenge_name = response['ChallengeName']
                logger.warning(f"Authentication challenge required for {user_credentials.email}: {challenge_name}")
                
                # Different challenges require different handling
                if challenge_name == 'NEW_PASSWORD_REQUIRED':
                    raise Exception("NEW_PASSWORD_REQUIRED: User must set a new password")
                elif challenge_name == 'SMS_MFA':
                    raise Exception("SMS_MFA: SMS verification required")
                elif challenge_name == 'SOFTWARE_TOKEN_MFA':
                    raise Exception("SOFTWARE_TOKEN_MFA: TOTP verification required")
                else:
                    raise Exception(f"Authentication challenge required: {challenge_name}")
            
            else:
                logger.error(f"Unexpected response structure: {response}")
                raise Exception("Unexpected authentication response format")
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            logger.warning(f"Sign-in failed for {user_credentials.email}: {error_code} - {error_message}")
            
            # Re-raise with more specific error information
            if error_code == 'UserNotFoundException':
                raise Exception("UserNotFoundException: User does not exist")
            elif error_code == 'NotAuthorizedException':
                raise Exception("NotAuthorizedException: Invalid credentials")
            elif error_code == 'UserNotConfirmedException':
                raise Exception("UserNotConfirmedException: User account not confirmed")
            else:
                raise Exception(f"Sign-in failed: {error_message}")

    def sign_up(self, user_details: schemas.UserSignUp) -> dict:
        """Register a new user."""
        try:
            logger.info(f"Attempting sign-up for user: {user_details.email}")
            
            response = self.cognito_client.sign_up(
                ClientId=self.client_id,
                Username=user_details.email,
                Password=user_details.password,
                UserAttributes=[
                    {'Name': 'email', 'Value': user_details.email}
                ]
            )
            
            logger.info(f"Successful sign-up for user: {user_details.email}")
            return {
                "userConfirmed": False,
                "userId": user_details.email
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            logger.warning(f"Sign-up failed for {user_details.email}: {error_code} - {error_message}")
            
            if error_code == 'UsernameExistsException':
                raise Exception("UsernameExistsException: A user with this email already exists")
            elif error_code == 'InvalidPasswordException':
                raise Exception("InvalidPasswordException: Password does not meet requirements")
            else:
                raise Exception(f"Sign-up failed: {error_message}")

    def confirm_sign_up(self, credentials: schemas.ConfirmSignUp) -> dict:
        """Confirm user sign up."""
        try:
            logger.info(f"Attempting to confirm sign-up for user: {credentials.email}")
            
            self.cognito_client.confirm_sign_up(
                ClientId=self.client_id,
                Username=credentials.email,
                ConfirmationCode=credentials.confirmationCode
            )
            
            logger.info(f"Successfully confirmed sign-up for user: {credentials.email}")
            return {"message": "User confirmed successfully"}
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            logger.warning(f"Confirm sign-up failed for {credentials.email}: {error_code} - {error_message}")
            
            if error_code == 'CodeMismatchException':
                raise Exception("CodeMismatchException: Invalid confirmation code")
            elif error_code == 'ExpiredCodeException':
                raise Exception("ExpiredCodeException: Confirmation code has expired")
            else:
                raise Exception(f"Confirm sign-up failed: {error_message}")

    def forgot_password(self, credentials: schemas.ForgotPassword) -> dict:
        """Initiate the forgot password flow for a user."""
        try:
            logger.info(f"Attempting forgot password for user: {credentials.email}")
            
            self.cognito_client.forgot_password(
                ClientId=self.client_id,
                Username=credentials.email
            )
            
            logger.info(f"Successfully initiated forgot password for user: {credentials.email}")
            return {"message": "If an account with that email exists, a reset code has been sent"}
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            logger.warning(f"Forgot password failed for {credentials.email}: {error_code} - {error_message}")
            
            # Don't reveal if user exists or not
            return {"message": "If an account with that email exists, a reset code has been sent"}

    def confirm_forgot_password(self, credentials: schemas.ConfirmForgotPassword) -> dict:
        """Confirm forgot password and set new password."""
        try:
            logger.info(f"Attempting to confirm forgot password for user: {credentials.email}")
            
            self.cognito_client.confirm_forgot_password(
                ClientId=self.client_id,
                Username=credentials.email,
                ConfirmationCode=credentials.confirmationCode,
                Password=credentials.newPassword
            )
            
            logger.info(f"Successfully confirmed forgot password for user: {credentials.email}")
            return {"message": "Password reset successfully"}
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            logger.warning(f"Confirm forgot password failed for {credentials.email}: {error_code} - {error_message}")
            
            if error_code == 'CodeMismatchException':
                raise Exception("CodeMismatchException: Invalid reset code")
            elif error_code == 'ExpiredCodeException':
                raise Exception("ExpiredCodeException: Reset code has expired")
            elif error_code == 'InvalidPasswordException':
                raise Exception("InvalidPasswordException: Password does not meet requirements")
            else:
                raise Exception(f"Confirm forgot password failed: {error_message}")

    def sign_out(self, session_token: str) -> dict:
        """Sign out a user."""
        try:
            logger.info("Attempting to sign out user")
            
            self.cognito_client.global_sign_out(
                AccessToken=session_token
            )
            
            logger.info("Successfully signed out user")
            return {"message": "Signed out successfully"}
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            logger.warning(f"Sign out failed: {error_code} - {error_message}")
            
            # Even if the token is invalid, we consider the sign-out successful
            return {"message": "Signed out successfully"}

    def refresh_token(self, request: schemas.RefreshTokenRequest) -> dict:
        """Refresh access token using refresh token."""
        try:
            logger.info("Attempting to refresh token")
            
            response = self.cognito_client.initiate_auth(
                AuthFlow='REFRESH_TOKEN_AUTH',
                AuthParameters={
                    'REFRESH_TOKEN': request.refresh_token,
                },
                ClientId=self.client_id
            )
            
            auth_result = response['AuthenticationResult']
            logger.info("Successfully refreshed token")
            
            return {
                "access_token": auth_result['AccessToken'],
                "refresh_token": request.refresh_token,  # Keep the same refresh token
                "id_token": auth_result.get('IdToken', '')
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            logger.warning(f"Token refresh failed: {error_code} - {error_message}")
            
            if error_code == 'NotAuthorizedException':
                raise Exception("NotAuthorizedException: Invalid refresh token")
            elif error_code == 'TokenExpiredException':
                raise Exception("TokenExpiredException: Refresh token has expired")
            else:
                raise Exception(f"Token refresh failed: {error_message}")

    def get_current_authenticated_user(self, session_token: str) -> Optional[dict]:
        """Get current authenticated user from session token."""
        try:
            logger.info("Attempting to get current user")
            
            response = self.cognito_client.get_user(
                AccessToken=session_token
            )
            
            # Extract user attributes
            user_attributes = {attr['Name']: attr['Value'] for attr in response['UserAttributes']}
            email = user_attributes.get('email', '')
            
            logger.info(f"Successfully retrieved current user: {email}")
            return {
                "id": email,
                "email": email
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            logger.warning(f"Get current user failed: {error_code}")
            return None


@lru_cache(maxsize=1)
def get_cognito_adapter():
    """
    Factory function to create and return a Cognito authentication adapter.
    """
    # Get Cognito configuration from environment variables
    region = os.environ.get('AWS_REGION', 'us-east-1')
    user_pool_id = os.environ.get('COGNITO_USER_POOL_ID')
    client_id = os.environ.get('COGNITO_CLIENT_ID')

    if not all([region, user_pool_id, client_id]):
        raise RuntimeError("Missing required AWS Cognito configuration in environment variables")

    logger.info(f"Using CognitoAdapter (region: {region}, pool: {user_pool_id})")
    return CognitoAdapter(
        region=region,
        user_pool_id=user_pool_id,
        client_id=client_id
    ) 