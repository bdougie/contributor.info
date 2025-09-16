import React from 'react';
import { AlertTriangle, Clock, UserX, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export type InvitationErrorType = 'expired' | 'invalid' | 'already-member' | 'not-found';

interface InvitationErrorProps {
  type: InvitationErrorType;
}

export const InvitationError: React.FC<InvitationErrorProps> = ({ type }) => {
  const getErrorDetails = () => {
    switch (type) {
      case 'expired':
        return {
          icon: Clock,
          title: 'Invitation Expired',
          message:
            'This invitation link has expired. Please ask the workspace owner to send you a new invitation.',
          iconColor: 'text-orange-500',
        };
      case 'already-member':
        return {
          icon: UserX,
          title: 'Already a Member',
          message:
            'You are already a member of this workspace. You can access it from your dashboard.',
          iconColor: 'text-blue-500',
        };
      case 'not-found':
        return {
          icon: AlertTriangle,
          title: 'Invitation Not Found',
          message:
            'This invitation could not be found. It may have been removed or the link may be incorrect.',
          iconColor: 'text-red-500',
        };
      case 'invalid':
      default:
        return {
          icon: AlertTriangle,
          title: 'Invalid Invitation',
          message: 'This invitation link is invalid. Please check the link and try again.',
          iconColor: 'text-red-500',
        };
    }
  };

  const { icon: Icon, title, message, iconColor } = getErrorDetails();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4 mx-auto">
            <Icon className={`h-8 w-8 ${iconColor}`} />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="mt-2">{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {type === 'already-member' ? (
              <Button asChild className="w-full">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className="w-full">
                <Link to="/">
                  <Home className="h-4 w-4 mr-2" />
                  Go to Home
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
