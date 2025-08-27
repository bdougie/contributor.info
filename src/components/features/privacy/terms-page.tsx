import { ArrowLeft, ExternalLink } from '@/components/ui/icon';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <article className="prose prose-gray max-w-none">
        <h1>Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

        <h2>Acceptance of Terms</h2>
        <p>
          By accessing and using Contributor.info, you accept and agree to be bound by the terms and
          provision of this agreement.
        </p>

        <h2>Description of Service</h2>
        <p>
          Contributor.info is a web application that visualizes GitHub contributors and their
          contributions using publicly available data from GitHub's API.
        </p>

        <h2>GitHub Integration</h2>
        <p>
          Our service uses GitHub authentication and accesses data through GitHub's API. By using
          our service, you acknowledge that:
        </p>
        <ul>
          <li>You must comply with GitHub's Terms of Service</li>
          <li>We access only publicly available repository data</li>
          <li>Your use is subject to GitHub's API rate limits and policies</li>
        </ul>
        <p>
          Please review{' '}
          <a
            href="https://docs.github.com/en/site-policy/github-terms/github-terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1"
          >
            GitHub's Terms of Service
            <ExternalLink className="h-3 w-3" />
          </a>{' '}
          for complete details.
        </p>

        <h2>Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the service for any unlawful purpose</li>
          <li>Attempt to gain unauthorized access to our systems</li>
          <li>Interfere with or disrupt the service</li>
          <li>Use automated tools to access the service excessively</li>
        </ul>

        <h2>Data and Privacy</h2>
        <p>
          We process publicly available GitHub data and minimal personal information. Please see our{' '}
          <a href="/privacy">Privacy Policy</a> for detailed information about data collection and
          use.
        </p>

        <h2>Service Availability</h2>
        <p>
          Contributor.info is currently in development. We make no guarantees about service
          availability, data accuracy, or service continuity. The service may be modified or
          discontinued at any time.
        </p>

        <h2>Limitation of Liability</h2>
        <p>
          The service is provided "as is" without warranties of any kind. We are not liable for any
          damages arising from your use of the service.
        </p>

        <h2>Changes to Terms</h2>
        <p>
          We reserve the right to modify these terms at any time. Changes will be posted on this
          page with an updated revision date.
        </p>

        <h2>Contact</h2>
        <p>Questions about these terms? Contact us at brian@dinnerpeople.app</p>
      </article>
    </div>
  );
}
