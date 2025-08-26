import { Button } from '../components/ui/button';
import './header.css';

type User = {
  name: string;
};

interface HeaderProps {
  user?: User;
  onLogin: () => void;
  onLogout: () => void;
  onCreateAccount: () => void;
}

export const Header = ({ user, onLogin, onLogout, onCreateAccount }: HeaderProps) => (
  <header>
    <div className="storybook-header">
      <div>
        <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <g fill="none" fillRule="evenodd">
            <path
              d="m16 0 6.9282032 9.0717968L32 16l-9.0717968 6.9282032L16 32l-6.9282032-9.0717968L0 16l9.0717968-6.9282032L16 0Z"
              fill="#FF4785"
            />
            <path
              d="m16 0 6.9282032 9.0717968L32 16l-9.0717968 6.9282032L16 32l-6.9282032-9.0717968L0 16l9.0717968-6.9282032L16 0Z"
              fill="url(#a)"
            />
            <path d="M16 0v32C7.163444 32 0 24.836556 0 16S7.163444 0 16 0Z" fill="url(#b)" />
          </g>
          <defs>
            <linearGradient id="a" x1="16" y1="0" x2="16" y2="32" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFAE00" />
              <stop offset="1" stopColor="#FF4785" stopOpacity=".01" />
            </linearGradient>
            <radialGradient id="b" cx="16" cy="16" r="16" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FF4785" />
              <stop offset="1" stopColor="#FF4785" stopOpacity=".01" />
            </radialGradient>
          </defs>
        </svg>
        <h1>Acme</h1>
      </div>
      <div>
        {user
? (
          <>
            <span className="welcome">
              Welcome, <b>{user.name}</b>!
            </span>
            <Button size="sm" onClick={onLogout}>
              Log out
            </Button>
          </>
        )
: (
          <>
            <Button size="sm" onClick={onLogin}>
              Log in
            </Button>
            <Button variant="outline" size="sm" onClick={onCreateAccount}>
              Sign up
            </Button>
          </>
        )}
      </div>
    </div>
  </header>
);
