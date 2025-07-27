import boto3
import logging
from botocore.exceptions import ClientError
from typing import Optional

from ..api import schemas

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
            
            auth_result = response['AuthenticationResult']
            logger.info(f"Successful sign-in for user: {user_credentials.email}")
            
            return {
                "user": {
                    "id": user_credentials.email,
                    "email": user_credentials.email
                },
                "sessionToken": auth_result['AccessToken']
            }
            
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