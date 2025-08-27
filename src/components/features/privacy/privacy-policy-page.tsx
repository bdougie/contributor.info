import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft } from '@/components/ui/icon';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PrivacyPolicyPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string>('');

  // Define the privacy policy content structure for TOC
  const privacySections = useMemo(
    () => [
      { id: 'introduction', title: 'Introduction', level: 2 },
      {
        id: 'information-we-collect',
        title: 'Information We Collect',
        level: 2,
      },
      {
        id: 'information-you-provide',
        title: 'Information You Provide',
        level: 3,
      },
      {
        id: 'information-we-collect-automatically',
        title: 'Information We Collect Automatically',
        level: 3,
      },
      {
        id: 'how-we-use-your-information',
        title: 'How We Use Your Information',
        level: 2,
      },
      {
        id: 'legal-basis-for-processing-gdpr',
        title: 'Legal Basis for Processing (GDPR)',
        level: 2,
      },
      { id: 'data-sharing', title: 'Data Sharing', level: 2 },
      { id: 'data-retention', title: 'Data Retention', level: 2 },
      { id: 'your-rights', title: 'Your Rights', level: 2 },
      { id: 'email-communications', title: 'Email Communications', level: 2 },
      { id: 'security', title: 'Security', level: 2 },
      { id: 'childrens-privacy', title: "Children's Privacy", level: 2 },
      {
        id: 'changes-to-this-policy',
        title: 'Changes to This Policy',
        level: 2,
      },
      { id: 'contact-us', title: 'Contact Us', level: 2 },
      {
        id: 'data-protection-officer',
        title: 'Data Protection Officer',
        level: 2,
      },
    ],
    []
  );

  // Handle scroll spy functionality
  useEffect(() => {
    const handleScroll = () => {
      const headings = privacySections
        .map((item) => document.getElementById(item.id))
        .filter(Boolean);

      // Find the heading that's currently in view
      let current = '';

      for (const heading of headings) {
        if (heading) {
          const rect = heading.getBoundingClientRect();
          if (rect.top <= 100) {
            current = heading.id;
          }
        }
      }

      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => window.removeEventListener('scroll', handleScroll);
  }, [privacySections]);

  // Handle click navigation
  const handleTocClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      setActiveSection(id);
    }
  };

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="flex gap-8">
        <main className="flex-1 max-w-4xl">
          <article className="prose prose-gray max-w-none">
            <h1>Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

            <h2 id="introduction">Introduction</h2>
            <p>
              Contributor.info ("we", "our", or "us") is committed to protecting your privacy. This
              Privacy Policy explains how we collect, use, and share information about you when you
              use our service.
            </p>

            <h2 id="information-we-collect">Information We Collect</h2>
            <h3 id="information-you-provide">Information You Provide</h3>
            <ul>
              <li>GitHub account information (username, email, avatar) when you log in</li>
              <li>Repositories you choose to track</li>
              <li>Email preferences and settings</li>
            </ul>

            <h3 id="information-we-collect-automatically">Information We Collect Automatically</h3>
            <ul>
              <li>Public GitHub repository and contribution data</li>
              <li>Usage data (features used, pages visited)</li>
              <li>Technical information (browser type, device information)</li>
            </ul>

            <h2 id="how-we-use-your-information">How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide and improve our services</li>
              <li>Send transactional emails (account confirmations, service updates)</li>
              <li>Send notification emails (if you've opted in)</li>
              <li>Analyze repository and contribution data</li>
              <li>Ensure security and prevent abuse</li>
            </ul>

            <h2 id="legal-basis-for-processing-gdpr">Legal Basis for Processing (GDPR)</h2>
            <p>We process your personal data based on:</p>
            <ul>
              <li>
                <strong>Contract:</strong> To provide the services you've signed up for
              </li>
              <li>
                <strong>Consent:</strong> For optional features like marketing emails
              </li>
              <li>
                <strong>Legitimate Interests:</strong> To improve our services and ensure security
              </li>
            </ul>

            <h2 id="data-sharing">Data Sharing</h2>
            <p>We do not sell your personal information. We may share your data with:</p>
            <ul>
              <li>Service providers (Supabase for authentication, Resend for emails)</li>
              <li>When required by law or to protect our rights</li>
            </ul>

            <h2 id="data-retention">Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. Repository
              analytics data is retained for up to 3 years. You can request deletion of your data at
              any time.
            </p>

            <h2 id="your-rights">Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to certain uses of your data</li>
              <li>Export your data in a portable format</li>
              <li>Withdraw consent for optional processing</li>
            </ul>

            <h2 id="email-communications">Email Communications</h2>
            <p>
              We send transactional emails necessary for the service. You can manage your email
              preferences in your <a href="/settings">account settings</a>.
            </p>

            <h2 id="security">Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your
              personal data against unauthorized access, alteration, disclosure, or destruction.
            </p>

            <h2 id="childrens-privacy">Children's Privacy</h2>
            <p>
              Our service is not intended for children under 13. We do not knowingly collect
              personal information from children under 13.
            </p>

            <h2 id="changes-to-this-policy">Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes
              by posting the new Privacy Policy on this page.
            </p>

            <h2 id="contact-us">Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or want to exercise your rights,
              please contact us at:
            </p>
            <ul>
              <li>Email: brian@dinnerpeople.app</li>
              <li>
                GitHub:{' '}
                <a href="https://github.com/bdougie/contributor.info/discussions">Discussions</a>
              </li>
            </ul>

            <h2 id="data-protection-officer">Data Protection Officer</h2>
            <p>For GDPR-related inquiries, you can contact me. brian@dinnerpeople.app</p>
          </article>
        </main>

        {/* Table of Contents Sidebar */}
        <aside className="hidden xl:block sticky top-8 h-fit">
          <div className="w-64 bg-card border rounded-lg p-4">
            <h4 className="font-semibold mb-3 text-sm">Contents</h4>
            <nav className="space-y-1">
              {privacySections.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'w-full justify-start px-2 py-1.5 h-auto text-left font-normal text-sm',
                    item.level === 3 && 'pl-4 text-xs',
                    activeSection === item.id && 'bg-accent text-accent-foreground font-medium'
                  )}
                  onClick={() => handleTocClick(item.id)}
                >
                  <span className="truncate">{item.title}</span>
                </Button>
              ))}
            </nav>
          </div>
        </aside>
      </div>
    </div>
  );
}
