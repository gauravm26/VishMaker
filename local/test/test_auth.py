#!/usr/bin/env python3
"""
Simple test script for the authentication system.
Run this to test sign-up, sign-in, and other auth features.
"""

import requests
import json
import os

# Load test credentials
def load_test_credentials():
    """Load test credentials from JSON file"""
    try:
        # Get the directory where this script is located
        script_dir = os.path.dirname(os.path.abspath(__file__))
        credentials_path = os.path.join(script_dir, 'test_credentials.json')
        
        with open(credentials_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print("Error: test_credentials.json not found!")
        print("Please ensure the test credentials file exists in the same directory as this script.")
        return None
    except json.JSONDecodeError:
        print("Error: Invalid JSON in test_credentials.json!")
        return None

# Load credentials
credentials = load_test_credentials()
if not credentials:
    exit(1)

BASE_URL = credentials['api_config']['base_url']
TIMEOUT = credentials['api_config']['timeout']

def test_signup():
    """Test user signup"""
    print("Testing signup...")
    
    user_data = credentials['test_users']['primary']
    data = {
        "email": user_data["email"],
        "password": user_data["password"]
    }
    
    response = requests.post(f"{BASE_URL}/auth/signup", json=data, timeout=TIMEOUT)
    print(f"Signup response: {response.status_code}")
    print(f"Response body: {response.json()}")
    
    # Check if user needs confirmation
    if response.status_code == 200:
        response_data = response.json()
        if not response_data.get('userConfirmed', True):
            print(f"\n⚠️  User {user_data['email']} needs confirmation!")
            print("💡 Look for the confirmation code in the console output above.")
            print("   Then run: python3 confirm_user.py <email> <confirmation_code>")
    
    return response.json()

def test_signin():
    """Test user signin"""
    print("\nTesting signin...")
    
    user_data = credentials['test_users']['secondary']
    data = {
        "email": user_data["email"],
        "password": user_data["password"]
    }
    
    response = requests.post(f"{BASE_URL}/auth/signin", json=data, timeout=TIMEOUT)
    print(f"Signin response: {response.status_code}")
    print(f"Response body: {response.json()}")
    return response.json()

def test_forgot_password():
    """Test forgot password"""
    print("\nTesting forgot password...")
    
    user_data = credentials['test_users']['secondary']
    data = {
        "email": user_data["email"]
    }
    
    response = requests.post(f"{BASE_URL}/auth/forgot-password", json=data, timeout=TIMEOUT)
    print(f"Forgot password response: {response.status_code}")
    print(f"Response body: {response.json()}")

def print_test_credentials():
    """Print available test credentials for manual testing"""
    print("\n" + "=" * 50)
    print("AVAILABLE TEST CREDENTIALS:")
    print("=" * 50)
    for user_type, user_data in credentials['test_users'].items():
        print(f"\n{user_type.upper()} USER:")
        print(f"  Email: {user_data['email']}")
        print(f"  Password: {user_data['password']}")
        print(f"  Description: {user_data['description']}")
    print("\n" + "=" * 50)

if __name__ == "__main__":
    print("Starting authentication tests...")
    print("=" * 50)
    
    # Print available test credentials
    print_test_credentials()
    
    # Test signup
    try:
        test_signup()
    except Exception as e:
        print(f"Signup test failed: {e}")
    
    # Test signin
    try:
        test_signin()
    except Exception as e:
        print(f"Signin test failed: {e}")
    
    # Test forgot password
    try:
        test_forgot_password()
    except Exception as e:
        print(f"Forgot password test failed: {e}")
    
    print("\n" + "=" * 50)
    print("Tests completed!")
    print("\nTo test the frontend:")
    print("1. Start the backend: cd ../../app-api && python3 -m uvicorn app.main:app --reload")
    print("2. Start the frontend: cd ../../app-ui && npm run dev")
    print("3. Go to http://localhost:3000 and click 'Sign In'")
    print("4. Use any of the test credentials above to sign in") 