#!/usr/bin/env python3
"""
Simple test script for the authentication system.
Run this to test sign-up, sign-in, and other auth features.
"""

import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

def test_signup():
    """Test user signup"""
    print("Testing signup...")
    
    data = {
        "email": "testuser@example.com",
        "password": "TestPassword123!"
    }
    
    response = requests.post(f"{BASE_URL}/auth/signup", json=data)
    print(f"Signup response: {response.status_code}")
    print(f"Response body: {response.json()}")
    return response.json()

def test_signin():
    """Test user signin"""
    print("\nTesting signin...")
    
    data = {
        "email": "test@example.com",  # Use the pre-created test user
        "password": "TestPassword123!"
    }
    
    response = requests.post(f"{BASE_URL}/auth/signin", json=data)
    print(f"Signin response: {response.status_code}")
    print(f"Response body: {response.json()}")
    return response.json()

def test_forgot_password():
    """Test forgot password"""
    print("\nTesting forgot password...")
    
    data = {
        "email": "test@example.com"
    }
    
    response = requests.post(f"{BASE_URL}/auth/forgot-password", json=data)
    print(f"Forgot password response: {response.status_code}")
    print(f"Response body: {response.json()}")

if __name__ == "__main__":
    print("Starting authentication tests...")
    print("=" * 50)
    
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
    print("1. Start the backend: cd app-api && python3 -m uvicorn app.main:app --reload")
    print("2. Start the frontend: cd app-ui && npm run dev")
    print("3. Go to http://localhost:3000 and click 'Sign In'")
    print("4. Use test@example.com / TestPassword123! to sign in") 