# Deployment Flow Implementation

## Overview

The deployment flow in VishMaker allows users to deploy approved Pull Requests directly to their AWS accounts through VishCoder. This document describes the implementation details and flow.

## Flow Sequence

### 1. PR Creation and Approval
1. **VishCoder creates PR**: When a feature build is complete, VishCoder creates a Pull Request
2. **PR status monitoring**: The system automatically monitors the PR status via GitHub API
3. **Status updates**: PR status is updated based on GitHub state:
   - `PR` - PR is open, waiting for review
   - `PR Approved` - PR has been approved and is ready for deployment
   - `Merged` - PR has been merged

### 2. Deployment Initiation
1. **Deploy button appears**: When PR status becomes "PR Approved", the "Deploy Changes" button appears
2. **User clicks deploy**: User clicks the button to initiate deployment
3. **Status changes**: Build status changes to "Deploy Changes"

### 3. Deployment Request to VishCoder
1. **WebSocket message**: A `deploy_feature` message is sent to VishCoder via `/ws/deploy`
2. **Payload structure**:
   ```json
   {
     "version": "1.0",
     "messageId": "msg_abc123",
     "actor": "System",
     "threadId": "thread_req_123_20250101",
     "type": "deploy_feature",
     "status": "Initiated",
     "timestamp": "2025-01-01T12:00:00Z",
     "body": {
       "contract": {
         "settings": {
           "aws": {
             "crossAccountRoleArn": "arn:aws:iam::123456789012:role/VishCoder-TerraformExecutionRole",
             "accountId": "123456789012",
             "region": "us-east-1"
           }
         }
       }
     }
   }
   ```

### 4. VishCoder Deployment Process
1. **Receives request**: VishCoder receives the deployment request on `/ws/deploy`
2. **Assumes cross-account role**: Uses the provided cross-account role ARN to access user's AWS account
3. **Deploys changes**: Applies the Terraform/Infrastructure changes to the user's account
4. **Sends response**: Returns deployment status via WebSocket

### 5. Deployment Response Handling
1. **Status updates**: VishCoder sends real-time status updates:
   - `InProgress` - Deployment is running
   - `Success` - Deployment completed successfully
   - `Failed` - Deployment failed with error details
2. **Status changes**: Build status is updated based on response:
   - `Deployed Dev` - On successful deployment
   - Error handling - On failed deployment

## Implementation Details

### Components Updated

#### 1. Communication Utility (`comm.ts`)
- Added `deploy_feature` message type
- Added `DeployPayload` interface
- Added `createDeployPayload` function
- Updated `createVishmakerPayload` to handle deployment payloads

#### 2. BuildSummaryModal (`BuildSummaryModal.tsx`)
- Added deployment status tracking
- Added deployment button (only visible when PR is approved)
- Added deployment status display
- Integrated with WebSocket for deployment responses
- Added automatic status updates

#### 3. CanvasViewer (`CanvasViewer.tsx`)
- Passes `agentSocket` to BuildSummaryModal for deployment communication

### Status Flow

```
PR Created → PR Approved → Deploy Changes → Deployed Dev
    ↓           ↓            ↓              ↓
   "PR"    "PR Approved"  "Deploy Changes" "Deployed Dev"
```

### WebSocket Communication

- **Endpoint**: `wss://vishmaker.com/ws`
- **Message Type**: `deploy_feature`
- **Direction**: VishMaker → VishCoder (deployment request)
- **Response**: VishCoder → VishMaker (deployment status)

## Configuration Requirements

### AWS Cross-Account Role
The user must create an IAM role in their AWS account with the following:
- **Trust Policy**: Allows VishCoder's account to assume the role
- **Permissions**: Terraform execution permissions for the target resources
- **Role Name**: `VishCoder-TerraformExecutionRole` (configurable)

### Required Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "s3:*",
        "lambda:*",
        "iam:*",
        "cloudformation:*",
        "rds:*",
        "elasticache:*",
        "elasticloadbalancing:*",
        "autoscaling:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## Error Handling

### Deployment Failures
- **WebSocket connection issues**: Shows error message and retry option
- **AWS permission errors**: Displays specific error details from VishCoder
- **Terraform errors**: Shows deployment failure with error context

### Retry Logic
- Users can retry deployment by clicking the deploy button again
- Previous deployment status is cleared on retry
- WebSocket connection is validated before retry

## Future Enhancements

### Planned Features
1. **Environment selection**: Choose between dev/test/prod environments
2. **Rollback capability**: Ability to rollback failed deployments
3. **Deployment history**: Track all deployment attempts and results
4. **Approval workflows**: Multi-stage approval for production deployments
5. **Cost estimation**: Show estimated AWS costs before deployment

### Configuration Improvements
1. **AWS settings UI**: Allow users to configure AWS settings in the app
2. **Multiple accounts**: Support for multiple AWS accounts
3. **Region selection**: Choose target AWS regions
4. **Role management**: Manage multiple cross-account roles

## Testing

### Test Scenarios
1. **Happy path**: PR approval → deployment → success
2. **Failure scenarios**: Network errors, AWS permission issues
3. **Edge cases**: WebSocket disconnection, invalid payloads
4. **Status transitions**: Verify all status changes work correctly

### Test Data
- Use test AWS accounts with limited permissions
- Mock WebSocket responses for testing
- Test with various PR states and approval scenarios
