import { useEffect, useState } from "react"
import { ArrowLeft } from '@/components/ui/icon';
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@supabase/supabase-js";
import { LastUpdated } from "@/components/ui/last-updated";
import { usePageTimestamp } from "@/hooks/use-data-timestamp";

interface EmailPreferences {
  welcome_emails: boolean;
  marketing_emails: boolean;
  notification_emails: boolean;
  transactional_emails: boolean;
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<EmailPreferences>({
    welcome_emails: true,
    marketing_emails: false,
    notification_emails: true,
    transactional_emails: true,
  });
  
  // Track when the page was loaded for freshness indicator
  const { pageLoadedAt } = usePageTimestamp();

  useEffect(() => {
    const fetchUserAndPreferences = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          navigate("/");
          return;
        }
        
        setUser(user);

        // Fetch email preferences
        const { data } = await supabase
          .from("user_email_preferences")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (data) {
          setPreferences({
            welcome_emails: data.welcome_emails,
            marketing_emails: data.marketing_emails,
            notification_emails: data.notification_emails,
            transactional_emails: data.transactional_emails,
          });
        }
      } catch (error) {
        console.error("Failed to fetch preferences:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndPreferences();
  }, [navigate]);

  const handleSavePreferences = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("user_email_preferences")
        .upsert({
          user_id: user.id,
          ...preferences,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Your email preferences have been updated.",
      });
    } catch (error) {
      console.error("Failed to save preferences:", error);
      toast({
        title: "Error",
        description: "Failed to save your preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <LastUpdated 
          timestamp={pageLoadedAt}
          label="Settings loaded"
          size="sm"
        />
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-medium mb-4">Email Preferences</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="welcome-emails">Welcome Emails</Label>
                <p className="text-sm text-muted-foreground">
                  Receive welcome emails when you sign up
                </p>
              </div>
              <Switch
                id="welcome-emails"
                checked={preferences.welcome_emails}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, welcome_emails: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notification-emails">Notification Emails</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications about your tracked repositories
                </p>
              </div>
              <Switch
                id="notification-emails"
                checked={preferences.notification_emails}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, notification_emails: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="marketing-emails">Marketing Emails</Label>
                <p className="text-sm text-muted-foreground">
                  Receive updates about new features and tips
                </p>
              </div>
              <Switch
                id="marketing-emails"
                checked={preferences.marketing_emails}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, marketing_emails: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between opacity-50">
              <div className="space-y-0.5">
                <Label htmlFor="transactional-emails">Transactional Emails</Label>
                <p className="text-sm text-muted-foreground">
                  Essential account and security emails (always enabled)
                </p>
              </div>
              <Switch
                id="transactional-emails"
                checked={preferences.transactional_emails}
                disabled
              />
            </div>
          </div>

          <Button
            onClick={handleSavePreferences}
            disabled={saving}
            className="mt-6"
          >
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
        </section>

        <section className="border-t pt-8">
          <h2 className="text-lg font-medium mb-4">Privacy</h2>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Learn about how we handle your data and protect your privacy.
            </p>
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => navigate("/privacy")}
              >
                Privacy Policy
              </Button>
              <Button
                variant="outline"
                asChild
              >
                <a href="https://contributor.info/privacy/data-request">
                  Request Your Data
                </a>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t pt-8">
          <h2 className="text-lg font-medium mb-4">Account</h2>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Signed in as <strong>{user?.email}</strong>
            </p>
            <Button
              variant="outline"
              onClick={() => {
                supabase.auth.signOut();
                navigate("/");
              }}
            >
              Sign Out
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}