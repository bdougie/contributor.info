import type { Meta, StoryObj } from '@storybook/react';

interface WelcomeEmailData {
  userName: string;
  userEmail: string;
  signupDate: string;
}

// Email template component for Storybook
function WelcomeEmailTemplate({ userName }: Pick<WelcomeEmailData, 'userName'>) {
  const emailHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Contributor.info</title>
    <style>
        /* Design system colors and typography - Black & White */
        :root {
            --primary: #000000;        /* Black */
            --background: #F8F9FA;     /* Light slate background */
            --card: #FFFFFF;           /* White cards */
            --foreground: #11181C;     /* Dark slate text */
            --muted: #6B7280;          /* Muted gray text */
            --border: #E5E7EB;         /* Light gray border */
            --content-bg: #F9FAFB;     /* Very light gray content background */
        }
        
        body {
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.6;
            color: var(--foreground);
            margin: 0;
            padding: 0;
            background-color: var(--background);
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 32px 16px;
        }
        
        .card {
            background: var(--card);
            border-radius: 12px;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
            border: 1px solid var(--border);
            overflow: hidden;
        }
        
        .header {
            background: var(--primary);
            color: white;
            padding: 40px 32px;
            text-align: center;
        }
        
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
            letter-spacing: -0.025em;
        }
        
        .content {
            padding: 32px;
        }
        
        .content p {
            margin: 0 0 16px 0;
            color: var(--foreground);
        }
        
        .content p:last-child {
            margin-bottom: 0;
        }
        
        .feature-list {
            margin: 24px 0;
            padding: 0;
            list-style: none;
        }
        
        .feature-list li {
            margin: 12px 0;
            padding: 0;
            display: flex;
            align-items: center;
            color: var(--foreground);
        }
        
        .feature-list li:before {
            content: "✓";
            color: var(--primary);
            font-weight: 600;
            margin-right: 12px;
            font-size: 16px;
        }
        
        .cta-container {
            text-align: center;
            margin: 32px 0;
        }
        
        .cta-button {
            display: inline-block;
            background: var(--primary);
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
            font-size: 16px;
            transition: background-color 0.2s ease;
        }
        
        .cta-button:hover {
            background: #374151;
        }
        
        .footer {
            text-align: center;
            padding: 24px 32px;
            background: var(--content-bg);
            border-top: 1px solid var(--border);
        }
        
        .footer p {
            margin: 0;
            font-size: 14px;
            color: var(--muted);
        }
        
        .footer a {
            color: var(--primary);
            text-decoration: none;
        }
        
        .footer a:hover {
            text-decoration: underline;
        }
        
        .divider {
            margin: 0 8px;
            color: var(--muted);
        }
        
        .greeting {
            font-size: 18px;
            font-weight: 500;
            margin-bottom: 24px;
        }
        
        .signature {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid var(--border);
            color: var(--muted);
        }
        
        /* Responsive design */
        @media (max-width: 600px) {
            .email-container {
                padding: 16px;
            }
            
            .header {
                padding: 32px 24px;
            }
            
            .header h1 {
                font-size: 24px;
            }
            
            .content {
                padding: 24px;
            }
            
            .footer {
                padding: 20px 24px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="card">
            <div class="header">
                <h1>Welcome 🌱contributor.info</h1>
            </div>
            
            <div class="content">
                <p class="greeting">Hi ${userName},</p>
                
                <p>Your account has been successfully created and you're all set to explore the world of open source contributions!</p>
                
                <p>With <a href="https://contributor.info" style="color: var(--primary); text-decoration: none;">contributor.info</a>, you can now:</p>
                
                <ul class="feature-list">
                    <li>Search and analyze GitHub repositories</li>
                    <li>View detailed contributor analytics and insights</li>
                    <li>Track repository health metrics and trends</li>
                    <li>Discover contribution patterns and opportunities</li>
                </ul>
                
                <div class="cta-container">
                    <a href="https://contributor.info" class="cta-button">Start Exploring</a>
                </div>
                
                <div class="signature">
                    <p>Best regards,<br>
                    <strong>bdougie</strong></p>
                </div>
            </div>
            
            <div class="footer">
                <p>
                    <a href="https://contributor.info/settings">Email preferences</a>
                    <span class="divider">•</span>
                    <a href="https://contributor.info/privacy">Privacy policy</a>
                    <span class="divider">•</span>
                    <a href="https://github.com/bdougie/contributor.info">GitHub</a>
                </p>
            </div>
        </div>
    </div>
</body>
</html>
  `;

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0' }}>
      <div dangerouslySetInnerHTML={{ __html: emailHTML }} />
    </div>
  );
}

const meta: Meta<typeof WelcomeEmailTemplate> = {
  title: 'Email Templates/Welcome Email',
  component: WelcomeEmailTemplate,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Welcome email template that matches the contributor.info design system. This shows how the email will look when sent to new users.',
      },
    },
  },
  argTypes: {
    userName: {
      control: 'text',
      description: 'The name of the user',
    },
  },
};

export default meta;
type Story = StoryObj<typeof WelcomeEmailTemplate>;

export const Default: Story = {
  args: {
    userName: 'Brian Douglas',
  },
};

export const LongName: Story = {
  args: {
    userName: 'Christopher Alexander Thompson',
  },
};

export const ShortName: Story = {
  args: {
    userName: 'Alex',
  },
};

export const DifferentName: Story = {
  args: {
    userName: 'Sarah Chen',
  },
};
