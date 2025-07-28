import hashlib
import secrets
import time
from typing import Dict, Optional, Tuple
from ..api.schemas import UserSignIn, UserSignUp, ConfirmSignUp, ForgotPassword, ConfirmForgotPassword

class LocalAuthAdapter:
    """
    Local authentication adapter for testing purposes.
    Stores users in memory and provides basic authentication functionality.
    """
    
    def __init__(self):
        # In-memory storage for users
        self.users: Dict[str, Dict] = {}
        self.confirmation_codes: Dict[str, str] = {}
        self.reset_codes: Dict[str, str] = {}
        self.sessions: Dict[str, Dict] = {}
        
        # Create a test user for easy testing
        self._create_test_user()
    
    def _create_test_user(self):
        """Create test users from test_credentials.json for development"""
        try:
            # Try to load test credentials from the local/test directory
            import os
            script_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
            credentials_path = os.path.join(script_dir, 'local', 'test', 'test_credentials.json')
            
            with open(credentials_path, 'r') as f:
                import json
                credentials = json.load(f)
            
            # Create all test users
            for user_type, user_data in credentials['test_users'].items():
                email = user_data['email']
                password = user_data['password']
                
                hashed_password = self._hash_password(password)
                self.users[email] = {
                    "email": email,
                    "password_hash": hashed_password,
                    "confirmed": True,
                    "created_at": time.time()
                }
                print(f"Test user created: {email} / {password} ({user_type})")
                
        except Exception as e:
            # Fallback to original test user if file not found
            test_email = "test@example.com"
            test_password = "TestPassword123!"
            
            hashed_password = self._hash_password(test_password)
            self.users[test_email] = {
                "email": test_email,
                "password_hash": hashed_password,
                "confirmed": True,
                "created_at": time.time()
            }
            print(f"Test user created: {test_email} / {test_password} (fallback)")
            print(f"Note: Could not load test_credentials.json: {e}")
    
    def _hash_password(self, password: str) -> str:
        """Hash a password using SHA-256"""
        return hashlib.sha256(password.encode()).hexdigest()
    
    def _verify_password(self, password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return self._hash_password(password) == hashed_password
    
    def _generate_code(self) -> str:
        """Generate a 6-digit confirmation code"""
        return str(secrets.randbelow(900000) + 100000)
    
    def sign_up(self, credentials: UserSignUp) -> Dict:
        """Sign up a new user"""
        email = credentials.email.lower()
        
        if email in self.users:
            raise Exception("User already exists")
        
        # Validate password (basic validation)
        if len(credentials.password) < 8:
            raise Exception("Password must be at least 8 characters long")
        
        hashed_password = self._hash_password(credentials.password)
        
        # Generate confirmation code
        confirmation_code = self._generate_code()
        self.confirmation_codes[email] = confirmation_code
        
        # Store user (unconfirmed)
        self.users[email] = {
            "email": email,
            "password_hash": hashed_password,
            "confirmed": False,
            "created_at": time.time()
        }
        
        print(f"User signed up: {email}")
        print(f"Confirmation code: {confirmation_code}")
        
        return {
            "userConfirmed": False,
            "userId": email
        }
    
    def confirm_sign_up(self, credentials: ConfirmSignUp) -> Dict:
        """Confirm user sign up"""
        email = credentials.email.lower()
        code = credentials.confirmationCode
        
        if email not in self.users:
            raise Exception("User not found")
        
        if self.users[email]["confirmed"]:
            raise Exception("User already confirmed")
        
        if email not in self.confirmation_codes or self.confirmation_codes[email] != code:
            raise Exception("Invalid confirmation code")
        
        # Confirm user
        self.users[email]["confirmed"] = True
        del self.confirmation_codes[email]
        
        print(f"User confirmed: {email}")
        
        return {"message": "User confirmed successfully"}
    
    def sign_in(self, credentials: UserSignIn) -> Dict:
        """Sign in a user"""
        email = credentials.email.lower()
        
        if email not in self.users:
            raise Exception("Invalid email or password")
        
        user = self.users[email]
        
        if not user["confirmed"]:
            raise Exception("Please confirm your account first")
        
        if not self._verify_password(credentials.password, user["password_hash"]):
            raise Exception("Invalid email or password")
        
        # Generate session token
        session_token = secrets.token_urlsafe(32)
        self.sessions[session_token] = {
            "email": email,
            "created_at": time.time()
        }
        
        print(f"User signed in: {email}")
        
        return {
            "user": {
                "id": email,
                "email": email
            },
            "sessionToken": session_token
        }
    
    def forgot_password(self, credentials: ForgotPassword) -> Dict:
        """Initiate forgot password process"""
        email = credentials.email.lower()
        
        if email not in self.users:
            # Don't reveal if user exists or not
            return {"message": "If an account with that email exists, a reset code has been sent"}
        
        # Generate reset code
        reset_code = self._generate_code()
        self.reset_codes[email] = reset_code
        
        print(f"Password reset initiated for: {email}")
        print(f"Reset code: {reset_code}")
        
        return {"message": "If an account with that email exists, a reset code has been sent"}
    
    def confirm_forgot_password(self, credentials: ConfirmForgotPassword) -> Dict:
        """Confirm forgot password and set new password"""
        email = credentials.email.lower()
        code = credentials.confirmationCode
        new_password = credentials.newPassword
        
        if email not in self.users:
            raise Exception("User not found")
        
        if email not in self.reset_codes or self.reset_codes[email] != code:
            raise Exception("Invalid reset code")
        
        # Validate new password
        if len(new_password) < 8:
            raise Exception("Password must be at least 8 characters long")
        
        # Update password
        hashed_password = self._hash_password(new_password)
        self.users[email]["password_hash"] = hashed_password
        
        # Remove reset code
        del self.reset_codes[email]
        
        print(f"Password reset for: {email}")
        
        return {"message": "Password reset successfully"}
    
    def sign_out(self, session_token: str) -> Dict:
        """Sign out a user"""
        if session_token in self.sessions:
            del self.sessions[session_token]
        
        return {"message": "Signed out successfully"}
    
    def get_current_user(self, session_token: str) -> Optional[Dict]:
        """Get current user from session token"""
        if session_token not in self.sessions:
            return None
        
        session = self.sessions[session_token]
        email = session["email"]
        
        if email not in self.users:
            return None
        
        user = self.users[email]
        return {
            "id": email,
            "email": email
        } 