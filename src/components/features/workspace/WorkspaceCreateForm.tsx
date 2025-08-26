import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2, Globe, Lock } from '@/components/ui/icon';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CreateWorkspaceRequest } from '@/types/workspace';

export interface WorkspaceCreateFormProps {
  onSubmit: (_data: CreateWorkspaceRequest) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  error?: string | null;
  mode?: 'create' | 'edit';
  initialValues?: Partial<CreateWorkspaceRequest>;
}

export function WorkspaceCreateForm({ 
  onSubmit, 
  onCancel,
  loading = false,
  error = null,
  mode = 'create',
  initialValues
}: WorkspaceCreateFormProps) {
  const [formData, setFormData] = useState<CreateWorkspaceRequest>({
    name: initialValues?.name || '',
    description: initialValues?.description || '',
    visibility: initialValues?.visibility || 'public',
    settings: initialValues?.settings || {}
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Workspace name is required';
    } else if (formData.name.length < 3) {
      errors.name = 'Workspace name must be at least 3 characters';
    } else if (formData.name.length > 50) {
      errors.name = 'Workspace name must be at most 50 characters';
    }

    if (formData.description && formData.description.length > 500) {
      errors.description = 'Description must be at most 500 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    await onSubmit(formData);
  };

  const handleInputChange = (field: keyof CreateWorkspaceRequest, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="workspace-name">
          Workspace Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="workspace-name"
          type="text"
          placeholder="My Awesome Projects"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          disabled={loading}
          aria-invalid={!!validationErrors.name}
          aria-describedby={validationErrors.name ? 'name-error' : undefined}
        />
        {validationErrors.name && (
          <p id="name-error" className="text-sm text-destructive">
            {validationErrors.name}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          This will be displayed as your workspace title
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="workspace-description">
          Description <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="workspace-description"
          placeholder="A collection of repositories I contribute to and maintain..."
          value={formData.description || ''}
          onChange={(e) => handleInputChange('description', e.target.value)}
          disabled={loading}
          rows={3}
          aria-invalid={!!validationErrors.description}
          aria-describedby={validationErrors.description ? 'description-error' : undefined}
        />
        {validationErrors.description && (
          <p id="description-error" className="text-sm text-destructive">
            {validationErrors.description}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Help others understand what this workspace is about
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="workspace-visibility">
          Visibility
        </Label>
        <Select
          value={formData.visibility}
          onValueChange={(value) => handleInputChange('visibility', value)}
          disabled={loading}
        >
          <SelectTrigger id="workspace-visibility" className="h-auto">
            <SelectValue placeholder="Select visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public" className="pl-2 pr-8">
              <div className="flex items-start gap-1.5 flex-1">
                <Globe className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="flex flex-col items-start flex-1">
                  <span className="font-medium leading-none text-left">Public</span>
                  <span className="text-xs text-muted-foreground mt-0.5 text-left">
                    Anyone can view this workspace
                  </span>
                </div>
              </div>
            </SelectItem>
            <SelectItem value="private" disabled className="pl-2 pr-8">
              <div className="flex items-start gap-1.5 flex-1">
                <Lock className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="flex flex-col items-start flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium leading-none text-left">Private</span>
                    <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                      Pro
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground mt-0.5 text-left">
                    Only you and invited members can view
                  </span>
                </div>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          disabled={loading || !formData.name.trim()}
          className="flex-1"
        >
          {loading
? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {mode === 'create' ? 'Creating...' : 'Saving...'}
            </>
          )
: (
            mode === 'create' ? 'Create Workspace' : 'Save Changes'
          )}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
        )}
      </div>

      {mode === 'create' && (
        <p className="text-xs text-muted-foreground text-center">
          You can add repositories and invite members after creating your workspace
        </p>
      )}
    </form>
  );
}