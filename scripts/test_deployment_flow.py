#!/usr/bin/env python3
"""
Test script for VishMaker deployment flow
Demonstrates the deployment payload structure and flow
"""

import json
import uuid
from datetime import datetime
from typing import Dict, Any

def create_deployment_payload(
    cross_account_role_arn: str,
    account_id: str,
    region: str,
    thread_id: str = None
) -> Dict[str, Any]:
    """
    Create a deployment payload for testing
    
    Args:
        cross_account_role_arn: ARN of the cross-account role
        account_id: Target AWS account ID
        region: Target AWS region
        thread_id: Optional thread ID for the session
    
    Returns:
        Deployment payload dictionary
    """
    if not thread_id:
        thread_id = f"thread_deploy_{uuid.uuid4().hex[:8]}"
    
    payload = {
        "version": "1.0",
        "messageId": f"msg_{uuid.uuid4().hex[:8]}",
        "actor": "System",
        "threadId": thread_id,
        "type": "deploy_feature",
        "status": "Initiated",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "origin": {
            "originMessageId": f"msg_{uuid.uuid4().hex[:8]}",
            "originActor": "System",
            "respondingToMessageId": None,
            "respondingToActor": None
        },
        "body": {
            "contract": {
                "settings": {
                    "aws": {
                        "crossAccountRoleArn": cross_account_role_arn,
                        "accountId": account_id,
                        "region": region
                    }
                }
            },
            "messages": {},
            "statusDetails": {}
        }
    }
    
    return payload

def create_deployment_response(
    request_payload: Dict[str, Any],
    status: str = "Success",
    details: str = "Deployment completed successfully"
) -> Dict[str, Any]:
    """
    Create a mock deployment response from VishCoder
    
    Args:
        request_payload: The original deployment request
        status: Response status (Success, Failed, InProgress)
        details: Status details message
    
    Returns:
        Deployment response dictionary
    """
    response = {
        "version": "1.0",
        "messageId": f"msg_{uuid.uuid4().hex[:8]}",
        "actor": "Coder",
        "threadId": request_payload["threadId"],
        "type": "deploy_feature",
        "status": status,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "origin": {
            "originMessageId": request_payload["messageId"],
            "originActor": "System",
            "respondingToMessageId": request_payload["messageId"],
            "respondingToActor": "System"
        },
        "body": {
            "contract": {},
            "messages": {},
            "statusDetails": {
                "agent": "Deployer",
                "LLM": "AWS-Lambda",
                "details": details,
                "progress": 100 if status == "Success" else 0
            }
        }
    }
    
    return response

def test_deployment_flow():
    """Test the complete deployment flow"""
    print("🚀 Testing VishMaker Deployment Flow")
    print("=" * 50)
    
    # Test 1: Create deployment payload
    print("\n1. Creating deployment payload...")
    deploy_payload = create_deployment_payload(
        cross_account_role_arn="arn:aws:iam::123456789012:role/VishCoder-TerraformExecutionRole",
        account_id="123456789012",
        region="us-east-1"
    )
    
    print("✅ Deployment payload created:")
    print(json.dumps(deploy_payload, indent=2))
    
    # Test 2: Create success response
    print("\n2. Creating success response...")
    success_response = create_deployment_response(
        request_payload=deploy_payload,
        status="Success",
        details="Infrastructure deployed successfully to us-east-1"
    )
    
    print("✅ Success response created:")
    print(json.dumps(success_response, indent=2))
    
    # Test 3: Create failure response
    print("\n3. Creating failure response...")
    failure_response = create_deployment_response(
        request_payload=deploy_payload,
        status="Failed",
        details="Insufficient permissions to create IAM role"
    )
    
    print("✅ Failure response created:")
    print(json.dumps(failure_response, indent=2))
    
    # Test 4: Create in-progress response
    print("\n4. Creating in-progress response...")
    progress_response = create_deployment_response(
        request_payload=deploy_payload,
        status="InProgress",
        details="Creating EC2 instances and configuring networking"
    )
    
    print("✅ In-progress response created:")
    print(json.dumps(progress_response, indent=2))
    
    print("\n🎉 Deployment flow test completed successfully!")
    
    return {
        "deploy_payload": deploy_payload,
        "success_response": success_response,
        "failure_response": failure_response,
        "progress_response": progress_response
    }

def validate_payload_structure(payload: Dict[str, Any]) -> bool:
    """
    Validate that a payload has the correct structure
    
    Args:
        payload: The payload to validate
    
    Returns:
        True if valid, False otherwise
    """
    required_fields = [
        "version", "messageId", "threadId", "actor", 
        "type", "status", "timestamp", "origin", "body"
    ]
    
    for field in required_fields:
        if field not in payload:
            print(f"❌ Missing required field: {field}")
            return False
    
    # Validate body structure
    body = payload.get("body", {})
    if "contract" not in body or "messages" not in body or "statusDetails" not in body:
        print("❌ Invalid body structure")
        return False
    
    # Validate AWS settings for deployment
    if payload["type"] == "deploy_feature":
        contract = body.get("contract", {})
        settings = contract.get("settings", {})
        aws = settings.get("aws", {})
        
        required_aws_fields = ["crossAccountRoleArn", "accountId", "region"]
        for field in required_aws_fields:
            if field not in aws:
                print(f"❌ Missing required AWS field: {field}")
                return False
    
    print("✅ Payload structure is valid")
    return True

if __name__ == "__main__":
    # Run the test
    test_results = test_deployment_flow()
    
    # Validate all payloads
    print("\n🔍 Validating payload structures...")
    print("-" * 40)
    
    for name, payload in test_results.items():
        print(f"\nValidating {name}:")
        validate_payload_structure(payload)
    
    print("\n📋 Test Summary:")
    print(f"- Deployment payload: {len(test_results['deploy_payload'])} fields")
    print(f"- Success response: {len(test_results['success_response'])} fields")
    print(f"- Failure response: {len(test_results['failure_response'])} fields")
    print(f"- Progress response: {len(test_results['progress_response'])} fields")
    
    print("\n✨ All tests completed!")
