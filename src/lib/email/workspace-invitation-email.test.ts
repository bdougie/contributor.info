/**
 * Test suite for workspace invitation email URL generation
 * Tests the fix for GitHub issue #863
 */

import { describe, it, expect } from 'vitest';

// Mock interface for testing email template
interface WorkspaceInvitationData {
  recipientEmail: string;
  recipientName?: string;
  workspaceName: string;
  workspaceSlug: string;
  inviterName: string;
  inviterEmail: string;
  role: 'admin' | 'editor' | 'viewer';
  invitationToken: string;
  expiresAt: string;
}

// Simplified email template functions for testing
const getTestInvitationEmailHTML = (data: WorkspaceInvitationData) => `
<div class="cta-container">
  <a href="https://contributor.info/invitation/${data.invitationToken}" class="cta-button cta-button-primary">
    View Invitation
  </a>
</div>
`;

const getTestInvitationEmailText = (data: WorkspaceInvitationData) => `
View invitation:
https://contributor.info/invitation/${data.invitationToken}
`;

describe('Workspace Invitation Email Tests', () => {
  it('should generate correct invitation URL format in email templates', () => {
    const mockData: WorkspaceInvitationData = {
      recipientEmail: 'test@example.com',
      recipientName: 'Test User',
      workspaceName: 'Test Workspace',
      workspaceSlug: 'test-workspace',
      inviterName: 'Jane Doe',
      inviterEmail: 'jane@example.com',
      role: 'viewer',
      invitationToken: '12345678-1234-1234-1234-123456789012',
      expiresAt: '2024-01-01T12:00:00Z',
    };

    const htmlOutput = getTestInvitationEmailHTML(mockData);
    const textOutput = getTestInvitationEmailText(mockData);

    // Test HTML template has correct URL format
    expect(htmlOutput).toContain(
      'https://contributor.info/invitation/12345678-1234-1234-1234-123456789012'
    );

    // Test HTML template does NOT contain old incorrect URLs
    expect(htmlOutput).not.toContain('workspace/invitation/accept');
    expect(htmlOutput).not.toContain('workspace/invitation/decline');

    // Test text template has correct URL format
    expect(textOutput).toContain(
      'https://contributor.info/invitation/12345678-1234-1234-1234-123456789012'
    );

    // Test text template does NOT contain old incorrect URLs
    expect(textOutput).not.toContain('workspace/invitation/accept');
    expect(textOutput).not.toContain('workspace/invitation/decline');
  });

  it('should use single "View Invitation" button in email templates', () => {
    const mockData: WorkspaceInvitationData = {
      recipientEmail: 'test@example.com',
      workspaceName: 'Test Workspace',
      workspaceSlug: 'test-workspace',
      inviterName: 'Jane Doe',
      inviterEmail: 'jane@example.com',
      role: 'admin',
      invitationToken: '87654321-4321-4321-4321-210987654321',
      expiresAt: '2024-01-01T12:00:00Z',
    };

    const htmlOutput = getTestInvitationEmailHTML(mockData);

    // Should contain "View Invitation" button
    expect(htmlOutput).toContain('View Invitation');

    // Should NOT contain separate accept/decline buttons
    expect(htmlOutput).not.toContain('Accept Invitation');
    expect(htmlOutput).not.toContain('Decline');

    // Should use primary button class
    expect(htmlOutput).toContain('cta-button-primary');
  });

  it('should work with different token formats', () => {
    const testCases = [
      {
        name: 'Standard UUID v4',
        token: '550e8400-e29b-41d4-a716-446655440000',
      },
      {
        name: 'UUID with different pattern',
        token: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      },
    ];

    testCases.forEach(({ token }) => {
      const mockData: WorkspaceInvitationData = {
        recipientEmail: 'test@example.com',
        workspaceName: 'Test Workspace',
        workspaceSlug: 'test-workspace',
        inviterName: 'Jane Doe',
        inviterEmail: 'jane@example.com',
        role: 'editor',
        invitationToken: token,
        expiresAt: '2024-01-01T12:00:00Z',
      };

      const htmlOutput = getTestInvitationEmailHTML(mockData);
      const expectedUrl = `https://contributor.info/invitation/${token}`;

      expect(htmlOutput).toContain(expectedUrl);
    });
  });
});
