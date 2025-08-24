# PR Status Checking and Deployment Integration

This document explains how the Build Summary modal now integrates with GitHub to check Pull Request status and enable deployment when PRs are approved. **The system now automatically populates PR information from VishCoder status updates.**

## Features

### 1. **Automatic PR Population** 🚀
- **VishCoder Integration**: PR URLs and numbers are automatically populated when VishCoder creates a Pull Request
- **Real-time Updates**: PR information appears immediately in the Build Summary modal
- **Smart Notifications**: Users receive instant notifications when PRs are created
- **No Manual Entry**: PR links are populated automatically from status updates

### 2. **Clickable Links**
- **Branch Links**: Click to open the GitHub branch in a new tab
- **PR Links**: Click to open the Pull Request in a new tab
- **Document Links**: Click to open documentation URLs in a new tab
- **Dashboard Links**: Click to open monitoring dashboard URLs in a new tab

### 3. **PR Status Checking**
The system automatically checks the status of GitHub Pull Requests and displays:
- PR state (open, closed, merged)
- Review count and approval count
- Approval status (approved, changes requested, pending review)
- Mergeability status
- PR title and metadata

### 4. **Deployment Button**
A "Deploy Changes" button appears automatically when:
- PR is approved (has at least one approval)
- No changes are requested
- PR is in an open state
- PR is mergeable

## How It Works

### **VishCoder → Build Summary Flow**
1. **VishCoder creates PR**: When VishCoder generates code and creates a Pull Request
2. **Status Update sent**: VishCoder sends a status update with `pr_url` and `pr_number`
3. **Automatic population**: CanvasViewer receives the update and populates the Build Summary
4. **Instant availability**: PR link becomes clickable immediately
5. **Status monitoring**: PR status checking begins automatically

### **GitHub API Integration**
The system uses the GitHub REST API to:
1. Parse PR URLs to extract owner, repository, and PR number
2. Fetch PR details including state, reviews, and status checks
3. Determine if the PR is approved and ready for deployment

### **PR Status Logic**
A PR is considered "approved" when:
```typescript
approved: approvalCount > 0 && !changesRequested && pr.state === 'open'
```

### **Deployment Process**
When the Deploy button is clicked:
1. Button shows "Deploying..." state
2. Simulates deployment process (2-second delay)
3. Updates build status to "Deployed Dev"
4. Logs deployment completion

## Usage

### **Automatic PR Population**
The system now automatically handles PR information:
- **No manual entry required**: PR links are populated from VishCoder
- **Instant availability**: PR information appears as soon as VishCoder creates it
- **Smart notifications**: Users see success messages when PRs are created

### **Setting Up GitHub Integration**
1. Ensure you have a GitHub token configured in your app settings
2. The token should have access to the repositories you want to check

### **Monitoring PR Status**
The PR status display shows:
- **State badges**: Open, Closed, Merged
- **Review information**: Count of reviews and approvals
- **Approval status**: Visual indicators for approval state
- **Mergeability**: Whether the PR can be merged

### **Deploying Changes**
1. Wait for PR approval (green "APPROVED" badge)
2. Click the "Deploy Changes" button
3. Monitor deployment progress
4. Check updated build status

## **VishCoder Status Update Format**

The system expects VishCoder to send status updates in this format:

```json
{
    "type": "status_update",
    "actor": "Coder",
    "body": {
        "statusDetails": {
            "agent": "Coder",
            "LLM": "GPT-4",
            "details": "✅ Pull request created for partial code",
            "progress": 100,
            "pr_url": "https://github.com/example/repo/pull/123",
            "pr_number": 123
        }
    }
}
```

### **Required Fields**
- `pr_url`: The GitHub Pull Request URL
- `pr_number`: The Pull Request number
- `details`: Description of what was accomplished
- `progress`: Progress percentage (0-100)

## API Endpoints Used

The system calls these GitHub API endpoints:
- `GET /repos/{owner}/{repo}/pulls/{pull_number}` - Get PR details
- `GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews` - Get PR reviews
- `GET /repos/{owner}/{repo}/commits/{sha}/status` - Get status checks

## Error Handling

The system gracefully handles:
- Invalid GitHub URLs
- Private repositories (requires authentication)
- API rate limiting
- Network errors
- Missing PRs

## Testing

### **Testing PR Auto-population**
Use the test file `app/frontend/src/utils/test-vishcoder-pr-integration.ts` to:
- Simulate VishCoder status updates
- Test PR information flow
- Verify automatic population
- Debug integration issues

### **Testing PR Status Checking**
Use the test file `app/frontend/src/utils/test-pr-status.ts` to:
- Test PR status checking functionality
- Verify GitHub API integration
- Debug approval logic
- Test deployment readiness checks

## Example Workflow

### **New Automated Flow**
1. **VishCoder generates code**: Creates feature implementation
2. **VishCoder creates PR**: Automatically creates GitHub Pull Request
3. **Status update sent**: PR information sent to CanvasViewer
4. **Build Summary updated**: PR link automatically populated
5. **PR becomes clickable**: User can immediately click to review
6. **Status monitoring**: PR approval status is checked automatically
7. **Deploy button appears**: When PR is approved
8. **Deploy changes**: User clicks deploy button
9. **Status updates**: Build status changes to "Deployed Dev"

### **Manual Flow (Legacy)**
1. **Developer creates PR**: Manually creates PR and links it
2. **System monitors status**: Automatically checks PR approval
3. **Reviewers approve**: System detects approval
4. **Deploy button appears**: Ready for deployment
5. **Deploy changes**: Click button to deploy
6. **Status updates**: Build status changes to "Deployed Dev"

## Configuration

### **GitHub Token Setup**
```typescript
// In your app settings
{
  "github": {
    "token": "your_github_personal_access_token"
  }
}
```

### **Required Token Permissions**
- `repo` - Full control of private repositories
- `read:org` - Read organization data (if using org repos)

## Troubleshooting

### **Common Issues**

1. **PR information not auto-populating**
   - Check VishCoder status update format
   - Verify `pr_url` and `pr_number` are present
   - Check WebSocket connection status

2. **"Repository is private" error**
   - Ensure GitHub token has access to the repository
   - Check token permissions

3. **"Failed to check PR status" error**
   - Verify PR URL format
   - Check network connectivity
   - Ensure GitHub API is accessible

4. **Deploy button not appearing**
   - Verify PR has been approved
   - Check that no changes were requested
   - Ensure PR is still open

5. **Rate limiting errors**
   - GitHub API has rate limits for unauthenticated requests
   - Use a GitHub token for higher limits

### **Debug Mode**
Enable console logging to see detailed API calls and responses:
```typescript
// Check browser console for:
// - VishCoder status updates
// - PR auto-population logs
// - GitHub API requests
// - PR status parsing
// - Approval logic decisions
// - Deployment process logs
```

## Future Enhancements

Potential improvements:
- **Real-time PR status updates**: WebSocket-based live updates
- **CI/CD integration**: Direct deployment to environments
- **Deployment environment selection**: Choose dev/test/prod
- **Rollback functionality**: Undo deployments
- **Deployment history tracking**: Audit trail of deployments
- **Slack/Teams notifications**: Team communication
- **Automated deployment triggers**: Auto-deploy on approval
- **Branch protection rules**: Enforce approval requirements
- **Code quality gates**: Block deployment on failed checks
