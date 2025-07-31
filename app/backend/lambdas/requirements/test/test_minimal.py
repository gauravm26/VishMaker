#!/usr/bin/env python3
"""
Minimal test script for the requirements Lambda function
"""

import json
import sys
import os

# Add the parent directory to the path so we can import the main module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_minimal_payload():
    """Test with minimal payload"""
    
    # Load the minimal test payload
    with open('test_minimal_payload.json', 'r') as f:
        event = json.load(f)
    
    print("🔍 Testing with minimal payload:")
    print(json.dumps(event, indent=2))
    print("\n" + "="*50 + "\n")
    
    try:
        # Import the handler
        from main import handler
        
        # Call the lambda handler
        response = handler(event, None)
        
        print("✅ Lambda execution successful!")
        print(f"Response: {response}")
        
        return response
        
    except Exception as e:
        print(f"❌ Lambda execution failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    test_minimal_payload() 