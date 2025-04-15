import { Outlet } from 'react-router-dom';
import { ModeToggle } from './mode-toggle';
import { AuthButton } from './auth-button';

export default function Layout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center px-4">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-bold">contributor.info</span>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <AuthButton />
            <ModeToggle />
          </div>
        </div>
      </header>
      <main className="container px-4 py-6 flex-1">
        <Outlet />
      </main>
      <footer className="border-t py-4">
        <div className="container px-4 text-center text-sm text-muted-foreground">
          Made with ❤️ by{' '}
          <a 
            href="https://github.com/bdougie" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            bdougie
          </a>
        </div>
      </footer>
    </div>
  );
}