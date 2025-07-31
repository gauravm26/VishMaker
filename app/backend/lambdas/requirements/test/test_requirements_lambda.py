#!/usr/bin/env python3
"""
Test script for the requirements Lambda function
"""

import json
import sys
import os

# Add the parent directory to the path so we can import the main module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import handler

def test_get_project_requirements():
    """Test the get_project_requirements endpoint"""
    
    # Load the test payload
    with open('test_requirements_payload.json', 'r') as f:
        event = json.load(f)
    
    print("🔍 Testing requirements Lambda with payload:")
    print(json.dumps(event, indent=2))
    print("\n" + "="*50 + "\n")
    
    try:
        # Call the lambda handler
        response = handler(event, None)
        
        print("✅ Lambda execution successful!")
        print(f"Status Code: {response.get('statusCode', 'N/A')}")
        print(f"Headers: {response.get('headers', {})}")
        
        # Parse and pretty print the response body
        if 'body' in response:
            try:
                body = json.loads(response['body'])
                print("\n📄 Response Body:")
                print(json.dumps(body, indent=2))
            except json.JSONDecodeError:
                print(f"\n📄 Response Body (raw): {response['body']}")
        
        return response
        
    except Exception as e:
        print(f"❌ Lambda execution failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    test_get_project_requirements() 