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
        print("=" * 60)
        print("COGNITO ADAPTER CONSTRUCTOR CALLED")
        print("=" * 60)
        print(f"Constructor parameters:")
        print(f"  region: {region}")
        print(f"  user_pool_id: {user_pool_id}")
        print(f"  client_id: {client_id}")
        
        try:
            print(f"Creating boto3 cognito-idp client for region: {region}")
            self.cognito_client = boto3.client('cognito-idp', region_name=region)
            print("boto3 cognito-idp client created successfully")
            
            self.user_pool_id = user_pool_id
            self.client_id = client_id
            
            print(f"Initialized Cognito adapter for user pool: {user_pool_id}")
            print("=" * 60)
            print("COGNITO ADAPTER CONSTRUCTOR COMPLETED SUCCESSFULLY")
            print("=" * 60)
            
        except Exception as e:
            print("=" * 60)
            print("COGNITO ADAPTER CONSTRUCTOR FAILED")
            print("=" * 60)
            print(f"Exception type: {type(e)}")
            print(f"Exception message: {str(e)}")
            print(f"Exception details: {e}")
            
            import traceback
            print(f"Full traceback: {traceback.format_exc()}")
            
            print("=" * 60)
            raise

    def sign_in(self, user_credentials: schemas.UserSignIn) -> dict:
        """Authenticate a user and return tokens."""
        try:
            print(f"Attempting sign-in for user: {user_credentials.email}")
            
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
                print(f"Successful sign-in for user: {user_credentials.email}")
                
                # Get the actual user ID from Cognito
                user_info = self.cognito_client.get_user(
                    AccessToken=auth_result['AccessToken']
                )
                user_id = user_info['Username']  # This is the actual Cognito user ID
                
                return {
                    "user": {
                        "id": user_id,  # Use the actual Cognito user ID
                        "email": user_credentials.email
                    },
                    "access_token": auth_result['AccessToken'],
                    "refresh_token": auth_result.get('RefreshToken', ''),
                    "id_token": auth_result.get('IdToken', '')
                }
            
            # Handle challenges
            elif 'ChallengeName' in response:
                challenge_name = response['ChallengeName']
                print(f"Authentication challenge required for {user_credentials.email}: {challenge_name}")
                
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
                print(f"Unexpected response structure: {response}")
                raise Exception("Unexpected authentication response format")
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            print(f"Sign-in failed for {user_credentials.email}: {error_code} - {error_message}")
            
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
            print(f"Attempting sign-up for user: {user_details.email}")
            
            response = self.cognito_client.sign_up(
                ClientId=self.client_id,
                Username=user_details.email,
                Password=user_details.password,
                UserAttributes=[
                    {
                        'Name': 'email',
                        'Value': user_details.email
                    }
                ]
            )
            
            print(f"Successfully signed up user: {user_details.email}")
            return {
                "message": "User registered successfully. Please check your email for confirmation.",
                "user_id": response['UserSub']
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            print(f"Sign-up failed for {user_details.email}: {error_code} - {error_message}")
            
            if error_code == 'UsernameExistsException':
                raise Exception("UsernameExistsException: User already exists")
            elif error_code == 'InvalidPasswordException':
                raise Exception("InvalidPasswordException: Password does not meet requirements")
            else:
                raise Exception(f"Sign-up failed: {error_message}")

    def confirm_sign_up(self, credentials: schemas.ConfirmSignUp) -> dict:
        """Confirm user registration."""
        try:
            print(f"Attempting to confirm sign-up for user: {credentials.email}")
            
            response = self.cognito_client.confirm_sign_up(
                ClientId=self.client_id,
                Username=credentials.email,
                ConfirmationCode=credentials.confirmation_code
            )
            
            print(f"Successfully confirmed sign-up for user: {credentials.email}")
            return {"message": "User account confirmed successfully"}
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            print(f"Confirm sign-up failed for {credentials.email}: {error_code} - {error_message}")
            
            if error_code == 'CodeMismatchException':
                raise Exception("CodeMismatchException: Invalid confirmation code")
            elif error_code == 'ExpiredCodeException':
                raise Exception("ExpiredCodeException: Confirmation code has expired")
            else:
                raise Exception(f"Confirm sign-up failed: {error_message}")

    def forgot_password(self, request: schemas.ForgotPassword) -> dict:
        """Initiate password reset."""
        try:
            print(f"Attempting to initiate password reset for user: {request.email}")
            
            response = self.cognito_client.forgot_password(
                ClientId=self.client_id,
                Username=request.email
            )
            
            print(f"Password reset initiated for user: {request.email}")
            return {"message": "Password reset code sent to your email"}
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            print(f"Forgot password failed for {request.email}: {error_code} - {error_message}")
            
            if error_code == 'UserNotFoundException':
                raise Exception("UserNotFoundException: User does not exist")
            else:
                raise Exception(f"Forgot password failed: {error_message}")

    def confirm_forgot_password(self, request: schemas.ConfirmForgotPassword) -> dict:
        """Complete password reset."""
        try:
            print(f"Attempting to confirm password reset for user: {request.email}")
            
            response = self.cognito_client.confirm_forgot_password(
                ClientId=self.client_id,
                Username=request.email,
                ConfirmationCode=request.confirmation_code,
                Password=request.new_password
            )
            
            print(f"Password reset completed for user: {request.email}")
            return {"message": "Password reset successfully"}
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            print(f"Confirm forgot password failed for {request.email}: {error_code} - {error_message}")
            
            if error_code == 'CodeMismatchException':
                raise Exception("CodeMismatchException: Invalid confirmation code")
            elif error_code == 'ExpiredCodeException':
                raise Exception("ExpiredCodeException: Confirmation code has expired")
            elif error_code == 'InvalidPasswordException':
                raise Exception("InvalidPasswordException: New password does not meet requirements")
            else:
                raise Exception(f"Confirm forgot password failed: {error_message}")

    def sign_out(self, session_token: str) -> dict:
        """Sign out a user."""
        try:
            print("Attempting to sign out user")
            
            self.cognito_client.global_sign_out(
                AccessToken=session_token
            )
            
            print("Successfully signed out user")
            return {"message": "Signed out successfully"}
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            print(f"Sign out failed: {error_code} - {error_message}")
            
            # Even if the token is invalid, we consider the sign-out successful
            return {"message": "Signed out successfully"}

    def refresh_token(self, request: schemas.RefreshTokenRequest) -> dict:
        """Refresh access token using refresh token."""
        try:
            print("Attempting to refresh token")
            
            response = self.cognito_client.initiate_auth(
                AuthFlow='REFRESH_TOKEN_AUTH',
                AuthParameters={
                    'REFRESH_TOKEN': request.refresh_token,
                },
                ClientId=self.client_id
            )
            
            auth_result = response['AuthenticationResult']
            print("Successfully refreshed token")
            
            return {
                "access_token": auth_result['AccessToken'],
                "refresh_token": request.refresh_token,  # Keep the same refresh token
                "id_token": auth_result.get('IdToken', '')
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            print(f"Token refresh failed: {error_code} - {error_message}")
            
            if error_code == 'NotAuthorizedException':
                raise Exception("NotAuthorizedException: Invalid refresh token")
            elif error_code == 'TokenExpiredException':
                raise Exception("TokenExpiredException: Refresh token has expired")
            else:
                raise Exception(f"Token refresh failed: {error_message}")

    def get_current_authenticated_user(self, session_token: str) -> Optional[dict]:
        """Get current authenticated user from session token."""
        try:
            print("Attempting to get current user")
            
            response = self.cognito_client.get_user(
                AccessToken=session_token
            )
            
            # Extract user attributes
            user_attributes = {attr['Name']: attr['Value'] for attr in response['UserAttributes']}
            email = user_attributes.get('email', '')
            user_id = response['Username']  # This is the actual Cognito user ID
            
            print(f"Successfully retrieved current user: {email} (ID: {user_id})")
            return {
                "id": user_id,  # Use the actual Cognito user ID
                "email": email
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            print(f"Get current user failed: {error_code}")
            return None


@lru_cache(maxsize=1)
def get_cognito_adapter():
    """
    Factory function to create and return a Cognito authentication adapter.
    """
    print("=" * 60)
    print("INITIALIZING COGNITO ADAPTER")
    print("=" * 60)
    
    # Get Cognito configuration from environment variables
    region = os.environ.get('AWS_REGION', 'us-east-1')
    user_pool_id = os.environ.get('COGNITO_USER_POOL_ID')
    client_id = os.environ.get('COGNITO_CLIENT_ID')
    
    print(f"Environment variables loaded:")
    print(f"  AWS_REGION: {region}")
    print(f"  COGNITO_USER_POOL_ID: {user_pool_id}")
    print(f"  COGNITO_CLIENT_ID: {client_id}")
    
    # Check if all required variables are present
    missing_vars = []
    if not region:
        missing_vars.append("AWS_REGION")
    if not user_pool_id:
        missing_vars.append("COGNITO_USER_POOL_ID")
    if not client_id:
        missing_vars.append("COGNITO_CLIENT_ID")
    
    if missing_vars:
        error_msg = f"Missing required AWS Cognito configuration in environment variables: {', '.join(missing_vars)}"
        print("=" * 60)
        print("COGNITO ADAPTER INITIALIZATION FAILED")
        print("=" * 60)
        print(error_msg)
        print("=" * 60)
        raise RuntimeError(error_msg)

    print(f"All required environment variables are present")
    print(f"Creating CognitoAdapter with region: {region}, pool: {user_pool_id}, client: {client_id}")
    
    try:
        adapter = CognitoAdapter(
            region=region,
            user_pool_id=user_pool_id,
            client_id=client_id
        )
        print("CognitoAdapter created successfully")
        print("=" * 60)
        print("COGNITO ADAPTER INITIALIZATION COMPLETED")
        print("=" * 60)
        return adapter
        
    except Exception as e:
        print("=" * 60)
        print("COGNITO ADAPTER CREATION FAILED")
        print("=" * 60)
        print(f"Exception type: {type(e)}")
        print(f"Exception message: {str(e)}")
        print(f"Exception details: {e}")
        
        import traceback
        print(f"Full traceback: {traceback.format_exc()}")
        
        print("=" * 60)
        raise 