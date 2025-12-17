import { useEffect } from 'react';
import { useNavigate } from 'react-router';

/**
 * Client-side redirect from /signup to /login
 * SPA mode doesn't support server-side redirects
 */
export default function SignupRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/login', { replace: true });
  }, [navigate]);

  return null;
}
