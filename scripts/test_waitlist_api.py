#!/usr/bin/env python3
"""
Test script for the Waitlist API
This script tests the waitlist endpoints to ensure they're working correctly
"""

import requests
import json
import sys
from typing import Dict, Any

# Configuration
API_BASE_URL = "https://api.vishmaker.com"  # Update this with your actual API URL
WAITLIST_ENDPOINT = f"{API_BASE_URL}/api/waitlist"

def test_join_waitlist(email: str) -> Dict[str, Any]:
    """Test joining the waitlist"""
    print(f"🧪 Testing: Join waitlist with email {email}")
    
    payload = {"email": email}
    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.post(WAITLIST_ENDPOINT, json=payload, headers=headers)
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "success":
                print("   ✅ SUCCESS: Email added to waitlist")
                return data
            else:
                print("   ❌ FAILED: Unexpected response format")
                return {}
        else:
            print(f"   ❌ FAILED: HTTP {response.status_code}")
            return {}
            
    except requests.exceptions.RequestException as e:
        print(f"   ❌ ERROR: Request failed - {e}")
        return {}

def test_get_waitlist_count() -> Dict[str, Any]:
    """Test getting waitlist count"""
    print(f"🧪 Testing: Get waitlist count")
    
    try:
        response = requests.get(f"{WAITLIST_ENDPOINT}/count")
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "success":
                print(f"   ✅ SUCCESS: Waitlist count retrieved - {data.get('total_entries', 'N/A')} entries")
                return data
            else:
                print("   ❌ FAILED: Unexpected response format")
                return {}
        else:
            print(f"   ❌ FAILED: HTTP {response.status_code}")
            return {}
            
    except requests.exceptions.RequestException as e:
        print(f"   ❌ ERROR: Request failed - {e}")
        return {}

def test_get_waitlist_entries() -> Dict[str, Any]:
    """Test getting waitlist entries"""
    print(f"🧪 Testing: Get waitlist entries")
    
    try:
        response = requests.get(f"{WAITLIST_ENDPOINT}/entries?limit=5")
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "success":
                entries = data.get("data", [])
                print(f"   ✅ SUCCESS: Retrieved {len(entries)} waitlist entries")
                return data
            else:
                print("   ❌ FAILED: Unexpected response format")
                return {}
        else:
            print(f"   ❌ FAILED: HTTP {response.status_code}")
            return {}
            
    except requests.exceptions.RequestException as e:
        print(f"   ❌ ERROR: Request failed - {e}")
        return {}

def test_health_check() -> Dict[str, Any]:
    """Test health check endpoint"""
    print(f"🧪 Testing: Health check")
    
    try:
        response = requests.get(f"{WAITLIST_ENDPOINT}/health")
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                print("   ✅ SUCCESS: Service is healthy")
                return data
            else:
                print("   ❌ FAILED: Service reported unhealthy")
                return {}
        else:
            print(f"   ❌ FAILED: HTTP {response.status_code}")
            return {}
            
    except requests.exceptions.RequestException as e:
        print(f"   ❌ ERROR: Request failed - {e}")
        return {}

def main():
    """Main test function"""
    print("🚀 Starting Waitlist API Tests")
    print("=" * 50)
    
    # Test health check first
    health_result = test_health_check()
    if not health_result:
        print("\n❌ Health check failed. Stopping tests.")
        sys.exit(1)
    
    print("\n" + "=" * 50)
    
    # Test joining waitlist
    test_email = "test@example.com"
    join_result = test_join_waitlist(test_email)
    
    print("\n" + "=" * 50)
    
    # Test getting count
    count_result = test_get_waitlist_count()
    
    print("\n" + "=" * 50)
    
    # Test getting entries
    entries_result = test_get_waitlist_entries()
    
    print("\n" + "=" * 50)
    
    # Summary
    print("📊 Test Summary:")
    print(f"   Health Check: {'✅ PASSED' if health_result else '❌ FAILED'}")
    print(f"   Join Waitlist: {'✅ PASSED' if join_result else '❌ FAILED'}")
    print(f"   Get Count: {'✅ PASSED' if count_result else '❌ FAILED'}")
    print(f"   Get Entries: {'✅ PASSED' if entries_result else '❌ FAILED'}")
    
    # Overall result
    all_passed = all([health_result, join_result, count_result, entries_result])
    if all_passed:
        print("\n🎉 All tests PASSED! Waitlist API is working correctly.")
        sys.exit(0)
    else:
        print("\n💥 Some tests FAILED. Please check the logs above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
