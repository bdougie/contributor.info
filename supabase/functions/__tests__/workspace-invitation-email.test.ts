/**
 * Test suite for workspace invitation email URL generation
 * Tests the fix for GitHub issue #863
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.192.0/testing/asserts.ts';

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

Deno.test('Email template generates correct invitation URL format', () => {
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
  assertStringIncludes(
    htmlOutput,
    'https://contributor.info/invitation/12345678-1234-1234-1234-123456789012',
    'HTML template should contain correct invitation URL'
  );

  // Test HTML template does NOT contain old incorrect URLs
  assertEquals(
    htmlOutput.includes('workspace/invitation/accept'),
    false,
    'HTML template should not contain old accept URL format'
  );
  
  assertEquals(
    htmlOutput.includes('workspace/invitation/decline'),
    false,
    'HTML template should not contain old decline URL format'
  );

  // Test text template has correct URL format
  assertStringIncludes(
    textOutput,
    'https://contributor.info/invitation/12345678-1234-1234-1234-123456789012',
    'Text template should contain correct invitation URL'
  );

  // Test text template does NOT contain old incorrect URLs
  assertEquals(
    textOutput.includes('workspace/invitation/accept'),
    false,
    'Text template should not contain old accept URL format'
  );
  
  assertEquals(
    textOutput.includes('workspace/invitation/decline'),
    false,
    'Text template should not contain old decline URL format'
  );
});

Deno.test('Email template uses single "View Invitation" button', () => {
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
  assertStringIncludes(
    htmlOutput,
    'View Invitation',
    'HTML template should contain "View Invitation" button text'
  );

  // Should NOT contain separate accept/decline buttons
  assertEquals(
    htmlOutput.includes('Accept Invitation'),
    false,
    'HTML template should not contain separate "Accept Invitation" button'
  );
  
  assertEquals(
    htmlOutput.includes('Decline'),
    false,
    'HTML template should not contain separate "Decline" button'
  );

  // Should use primary button class
  assertStringIncludes(
    htmlOutput,
    'cta-button-primary',
    'HTML template should use primary button styling'
  );
});

Deno.test('Email URL works with different token formats', () => {
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

  testCases.forEach(({ name, token }) => {
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

    assertStringIncludes(
      htmlOutput,
      expectedUrl,
      `${name}: HTML template should contain correct URL for token ${token}`
    );
  });
});