#!/usr/bin/env python3
"""
Test script for the VishMaker Projects API
"""

import requests
import json
import uuid
from datetime import datetime

# API Configuration
BASE_URL = "https://n1h3tfm3l0.execute-api.us-east-1.amazonaws.com"
API_KEY = None  # We'll need to get this from Cognito

def test_health_check():
    """Test the health check endpoint"""
    print("🔍 Testing Health Check...")
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_create_project():
    """Test creating a new project"""
    print("\n🔍 Testing Create Project...")
    
    project_data = {
        "name": f"Test Project {uuid.uuid4().hex[:8]}",
        "initial_prompt": "This is a test project for API testing",
        "user_id": "test-user-123"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/projects",
            json=project_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status: {response.status_code}")
        if response.status_code == 201:
            project = response.json()
            print(f"✅ Project created successfully!")
            print(f"Project ID: {project['id']}")
            print(f"Project Name: {project['name']}")
            return project['id']
        else:
            print(f"❌ Failed to create project: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def test_get_projects():
    """Test getting all projects"""
    print("\n🔍 Testing Get All Projects...")
    
    try:
        response = requests.get(f"{BASE_URL}/projects")
        
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            projects = response.json()
            print(f"✅ Retrieved {len(projects)} projects")
            for project in projects[:3]:  # Show first 3 projects
                print(f"  - {project['name']} (ID: {project['id']})")
            return True
        else:
            print(f"❌ Failed to get projects: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_get_project(project_id):
    """Test getting a specific project"""
    print(f"\n🔍 Testing Get Project {project_id}...")
    
    try:
        response = requests.get(f"{BASE_URL}/projects/{project_id}")
        
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            project = response.json()
            print(f"✅ Project retrieved successfully!")
            print(f"Name: {project['name']}")
            print(f"Created: {project['created_at']}")
            return True
        else:
            print(f"❌ Failed to get project: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_update_project(project_id):
    """Test updating a project"""
    print(f"\n🔍 Testing Update Project {project_id}...")
    
    update_data = {
        "name": f"Updated Project {uuid.uuid4().hex[:8]}",
        "initial_prompt": "This project has been updated for testing"
    }
    
    try:
        response = requests.put(
            f"{BASE_URL}/projects/{project_id}",
            json=update_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            project = response.json()
            print(f"✅ Project updated successfully!")
            print(f"New Name: {project['name']}")
            print(f"Updated: {project['updated_at']}")
            return True
        else:
            print(f"❌ Failed to update project: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_delete_project(project_id):
    """Test deleting a project"""
    print(f"\n🔍 Testing Delete Project {project_id}...")
    
    try:
        response = requests.delete(f"{BASE_URL}/projects/{project_id}")
        
        print(f"Status: {response.status_code}")
        if response.status_code == 204:
            print(f"✅ Project deleted successfully!")
            return True
        else:
            print(f"❌ Failed to delete project: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Projects API Tests")
    print("=" * 50)
    
    # Test 1: Health Check
    health_ok = test_health_check()
    
    # Test 2: Create Project
    project_id = test_create_project()
    
    # Test 3: Get All Projects
    get_all_ok = test_get_projects()
    
    # Test 4: Get Specific Project
    if project_id:
        get_one_ok = test_get_project(project_id)
    else:
        get_one_ok = False
    
    # Test 5: Update Project
    if project_id:
        update_ok = test_update_project(project_id)
    else:
        update_ok = False
    
    # Test 6: Delete Project
    if project_id:
        delete_ok = test_delete_project(project_id)
    else:
        delete_ok = False
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Results Summary")
    print("=" * 50)
    print(f"Health Check: {'✅ PASS' if health_ok else '❌ FAIL'}")
    print(f"Create Project: {'✅ PASS' if project_id else '❌ FAIL'}")
    print(f"Get All Projects: {'✅ PASS' if get_all_ok else '❌ FAIL'}")
    print(f"Get Specific Project: {'✅ PASS' if get_one_ok else '❌ FAIL'}")
    print(f"Update Project: {'✅ PASS' if update_ok else '❌ FAIL'}")
    print(f"Delete Project: {'✅ PASS' if delete_ok else '❌ FAIL'}")
    
    # Overall result
    all_tests = [health_ok, bool(project_id), get_all_ok, get_one_ok, update_ok, delete_ok]
    passed_tests = sum(all_tests)
    total_tests = len(all_tests)
    
    print(f"\n🎯 Overall Result: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All tests passed! The Projects API is working correctly.")
    else:
        print("⚠️  Some tests failed. Please check the API configuration.")

if __name__ == "__main__":
    main() 