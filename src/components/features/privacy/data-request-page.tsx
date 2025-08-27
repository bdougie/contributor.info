import { ArrowLeft, Mail } from '@/components/ui/icon';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function DataRequestPage() {
  const navigate = useNavigate();

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Data Request</h1>
          <p className="text-muted-foreground">
            Request access to your personal data or account deletion
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Contact for Data Requests
            </CardTitle>
            <CardDescription>
              Contributor.info is currently in development. For any data-related requests, please
              contact us directly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">What you can request:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Access to your personal data</li>
                <li>Correction of inaccurate information</li>
                <li>Deletion of your account and data</li>
                <li>Data export in a portable format</li>
                <li>Information about how your data is processed</li>
              </ul>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm mb-3">
                <strong>Email:</strong> brian@dinnerpeople.app
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Please include your GitHub username and specify what type of request you're making.
                I'll respond within 30 days as required by GDPR.
              </p>

              <Button asChild>
                <a href="mailto:brian@dinnerpeople.app?subject=Data Request - Contributor.info">
                  <Mail className="mr-2 h-4 w-4" />
                  Send Data Request Email
                </a>
              </Button>
            </div>

            <div className="border-t pt-4 text-xs text-muted-foreground">
              <p>
                <strong>Note:</strong> This application is currently in development. Most data is
                processed from public GitHub repositories and minimal personal information is
                stored.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Account Actions</CardTitle>
            <CardDescription>
              For immediate actions, you can also use your account settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/settings')}>
                Email Preferences
              </Button>
              <Button variant="outline" onClick={() => navigate('/privacy')}>
                Privacy Policy
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
