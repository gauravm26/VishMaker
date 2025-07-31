#!/usr/bin/env python3
"""
Comprehensive test script for the requirements Lambda function
"""

import json
import sys
import os

# Add the parent directory to the path so we can import the main module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import handler

def test_payload(payload_file, description):
    """Test a specific payload file"""
    print(f"\n{'='*60}")
    print(f"🧪 Testing: {description}")
    print(f"📁 Payload file: {payload_file}")
    print(f"{'='*60}")
    
    try:
        # Load the test payload
        with open(payload_file, 'r') as f:
            event = json.load(f)
        
        print("🔍 Test payload:")
        print(json.dumps(event, indent=2))
        print("\n" + "-"*50 + "\n")
        
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
                
                # Check if we got any flows
                if 'flows' in body:
                    flows = body['flows']
                    print(f"\n📊 Found {len(flows)} user flows")
                    for i, flow in enumerate(flows):
                        print(f"  Flow {i+1}: {flow.get('name', 'Unnamed')}")
                        if 'high_level_requirement_list' in flow:
                            hlrs = flow['high_level_requirement_list']
                            print(f"    - {len(hlrs)} High Level Requirements")
                            for j, hlr in enumerate(hlrs):
                                print(f"      HLR {j+1}: {hlr.get('name', 'Unnamed')}")
                                if 'low_level_requirement_list' in hlr:
                                    llrs = hlr['low_level_requirement_list']
                                    print(f"        - {len(llrs)} Low Level Requirements")
                
            except json.JSONDecodeError:
                print(f"\n📄 Response Body (raw): {response['body']}")
        
        return response
        
    except Exception as e:
        print(f"❌ Lambda execution failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def main():
    """Run all tests"""
    print("🚀 Starting Requirements Lambda Tests")
    print("="*60)
    
    # Test with UUID project_id (your actual project)
    test_payload('test_requirements_payload.json', 'UUID Project ID Test')
    
    # Test with integer project_id (fallback test)
    test_payload('test_requirements_payload_int.json', 'Integer Project ID Test')
    
    print("\n" + "="*60)
    print("🏁 All tests completed!")

if __name__ == "__main__":
    main() 