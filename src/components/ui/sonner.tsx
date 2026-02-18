import { useState, useEffect } from 'react';
import { useTheme } from '@/components/common/theming';
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

function useChatPanelOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;

    const sync = () => setOpen(root.getAttribute('data-chat-panel') === 'open');
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['data-chat-panel'] });
    return () => observer.disconnect();
  }, []);

  return open;
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();
  const chatOpen = useChatPanelOpen();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      position={chatOpen ? 'bottom-center' : 'bottom-right'}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
