// Test file for PR status checking functionality
// This demonstrates how to use the GitHub service to check PR approval status

import GitHubService from './githubService';

// Example usage of PR status checking
export const testPRStatusChecking = async () => {
  // Example GitHub PR URL
  const prUrl = 'https://github.com/example/repo/pull/123';
  
  try {
    console.log('Testing PR status checking...');
    
    // Get comprehensive PR information
    const prInfo = await GitHubService.getPullRequestInfo(prUrl);
    
    if (prInfo) {
      console.log('PR Information:', {
        title: prInfo.pr.title,
        state: prInfo.pr.state,
        number: prInfo.pr.number,
        author: prInfo.pr.user.login,
        approvalInfo: prInfo.approvalInfo
      });
      
      // Check if PR is approved
      if (prInfo.approvalInfo.approved) {
        console.log('✅ PR is approved and ready for deployment!');
        console.log(`Review count: ${prInfo.approvalInfo.reviewCount}`);
        console.log(`Approval count: ${prInfo.approvalInfo.approvalCount}`);
        console.log(`Mergeable: ${prInfo.approvalInfo.mergeable}`);
      } else {
        console.log('❌ PR is not yet approved');
        if (prInfo.approvalInfo.changesRequested) {
          console.log('⚠️ Changes have been requested');
        }
        console.log(`Current review state: ${prInfo.approvalInfo.lastReviewState}`);
      }
      
      // Show review details
      console.log('Reviews:', prInfo.reviews.map(review => ({
        user: review.user.login,
        state: review.state,
        submittedAt: review.submitted_at
      })));
      
      // Show status checks
      console.log('Status checks:', prInfo.status.map(status => ({
        context: status.context,
        state: status.state,
        description: status.description
      })));
      
    } else {
      console.log('Failed to get PR information');
    }
    
  } catch (error) {
    console.error('Error testing PR status:', error);
  }
};

// Test individual PR status checking
export const testIndividualPRChecks = async () => {
  const prUrl = 'https://github.com/example/repo/pull/123';
  
  try {
    // Parse PR URL
    const parsed = GitHubService.parsePRUrl(prUrl);
    if (parsed) {
      console.log('Parsed PR URL:', parsed);
      
      // Check approval status
      const approvalStatus = await GitHubService.isPullRequestApproved(
        parsed.owner, 
        parsed.repo, 
        parsed.prNumber
      );
      
      console.log('Approval Status:', approvalStatus);
      
      // Get PR details
      const pr = await GitHubService.getPullRequest(
        parsed.owner, 
        parsed.repo, 
        parsed.prNumber
      );
      
      console.log('PR Details:', {
        title: pr.title,
        state: pr.state,
        draft: pr.draft,
        mergeable: pr.mergeable,
        mergeableState: pr.mergeable_state
      });
      
    } else {
      console.log('Invalid PR URL format');
    }
    
  } catch (error) {
    console.error('Error in individual PR checks:', error);
  }
};

// Example of how to integrate with the BuildSummaryModal
export const checkPRForDeployment = async (prUrl: string) => {
  try {
    const prInfo = await GitHubService.getPullRequestInfo(prUrl);
    
    if (!prInfo) {
      return {
        canDeploy: false,
        reason: 'Failed to fetch PR information',
        details: null
      };
    }
    
    const { approvalInfo } = prInfo;
    
    if (approvalInfo.approved && approvalInfo.mergeable) {
      return {
        canDeploy: true,
        reason: 'PR is approved and mergeable',
        details: {
          reviewCount: approvalInfo.reviewCount,
          approvalCount: approvalInfo.approvalCount,
          prState: approvalInfo.prState
        }
      };
    } else if (approvalInfo.changesRequested) {
      return {
        canDeploy: false,
        reason: 'Changes have been requested on the PR',
        details: {
          reviewCount: approvalInfo.reviewCount,
          approvalCount: approvalInfo.approvalCount,
          lastReviewState: approvalInfo.lastReviewState
        }
      };
    } else if (!approvalInfo.approved) {
      return {
        canDeploy: false,
        reason: 'PR has not been approved yet',
        details: {
          reviewCount: approvalInfo.reviewCount,
          approvalCount: approvalInfo.approvalCount,
          lastReviewState: approvalInfo.lastReviewState
        }
      };
    } else {
      return {
        canDeploy: false,
        reason: 'PR is not mergeable',
        details: {
          mergeable: approvalInfo.mergeable,
          prState: approvalInfo.prState
        }
      };
    }
    
  } catch (error) {
    return {
      canDeploy: false,
      reason: `Error checking PR status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: null
    };
  }
};

// Export for use in other components
export default {
  testPRStatusChecking,
  testIndividualPRChecks,
  checkPRForDeployment
};
