#!/usr/bin/env python3
"""
Script to confirm a user account after signup.
This is useful for testing when using the local authentication adapter.
"""

import requests
import json
import sys
import os

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

def confirm_user(email, confirmation_code):
    """Confirm a user account"""
    credentials = load_test_credentials()
    if not credentials:
        return False
    
    base_url = credentials['api_config']['base_url']
    timeout = credentials['api_config']['timeout']
    
    data = {
        "email": email,
        "confirmationCode": confirmation_code
    }
    
    try:
        response = requests.post(f"{base_url}/auth/confirm-signup", json=data, timeout=timeout)
        print(f"Confirmation response: {response.status_code}")
        print(f"Response body: {response.json()}")
        
        if response.status_code == 200:
            print(f"✅ User {email} confirmed successfully!")
            return True
        else:
            print(f"❌ Failed to confirm user {email}")
            return False
            
    except Exception as e:
        print(f"❌ Error confirming user: {e}")
        return False

def main():
    if len(sys.argv) != 3:
        print("Usage: python3 confirm_user.py <email> <confirmation_code>")
        print("\nExample:")
        print("  python3 confirm_user.py testuser@example.com 123456")
        print("\nNote: The confirmation code is printed to the console when you run test_auth.py")
        return
    
    email = sys.argv[1]
    confirmation_code = sys.argv[2]
    
    print(f"Confirming user: {email}")
    print(f"Confirmation code: {confirmation_code}")
    print("-" * 50)
    
    success = confirm_user(email, confirmation_code)
    
    if success:
        print("\n🎉 User confirmed! You can now sign in with this account.")
    else:
        print("\n💡 If you don't have the confirmation code, run test_auth.py to see it printed to the console.")

if __name__ == "__main__":
    main() 