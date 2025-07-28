#!/usr/bin/env python3
"""
Quick script to display test credentials for local testing.
"""

import json
import os

def show_credentials():
    """Display test credentials in a readable format"""
    try:
        # Get the directory where this script is located
        script_dir = os.path.dirname(os.path.abspath(__file__))
        credentials_path = os.path.join(script_dir, 'test_credentials.json')
        
        with open(credentials_path, 'r') as f:
            credentials = json.load(f)
        
        print("🔐 TEST CREDENTIALS FOR LOCAL TESTING")
        print("=" * 50)
        
        for user_type, user_data in credentials['test_users'].items():
            print(f"\n👤 {user_type.upper()} USER:")
            print(f"   📧 Email: {user_data['email']}")
            print(f"   🔑 Password: {user_data['password']}")
            print(f"   📝 {user_data['description']}")
        
        print(f"\n🌐 API Base URL: {credentials['api_config']['base_url']}")
        print(f"🎨 Frontend URL: {credentials['frontend_config']['base_url']}")
        
        print("\n" + "=" * 50)
        print("💡 TIP: You can copy these credentials to test the login manually!")
        
    except FileNotFoundError:
        print("❌ Error: test_credentials.json not found!")
        print("Please ensure the test credentials file exists in the same directory as this script.")
    except json.JSONDecodeError:
        print("❌ Error: Invalid JSON in test_credentials.json!")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    show_credentials() 