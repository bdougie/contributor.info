import { Smartphone, Monitor } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MobileDataNoticeProps {
  className?: string;
}

export function MobileDataNotice({ className }: MobileDataNoticeProps) {
  return (
    <Alert className={className}>
      <Smartphone className="h-4 w-4" />
      <AlertDescription className="flex items-center gap-2">
        <span>
          Viewing simplified data on mobile. 
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Monitor className="h-3 w-3" />
          <span className="text-xs">Full details on desktop</span>
        </span>
      </AlertDescription>
    </Alert>
  );
}