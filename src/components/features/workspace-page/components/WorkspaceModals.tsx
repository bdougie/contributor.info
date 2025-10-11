import { ReviewerSuggestionsModal } from '@/components/features/workspace/reviewer-suggestions/ReviewerSuggestionsModal';
import { GitHubAppInstallModal } from '@/components/features/github-app/github-app-install-modal';
import { ResponsePreviewModal } from '@/components/features/workspace';
import type { CurrentItem } from '@/components/features/workspace/ResponsePreviewModal';
import type { SimilarItem } from '@/services/similarity-search';
import { AIFeatureErrorBoundary } from '@/components/error-boundaries/ai-feature-error-boundary';
import { toast } from 'sonner';
import type { Repository } from '@/components/features/workspace';

interface ReviewerModalState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repositories: Repository[];
}

interface GitHubAppModalState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRepository: Repository | null;
  isInstalled: boolean;
}

interface ResponseModalState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  similarItems: SimilarItem[];
  responseMessage: string;
  currentItem: CurrentItem | null;
  workspaceId: string;
  onItemMarkedAsResponded: () => void;
}

interface WorkspaceModalsProps {
  reviewerModal: ReviewerModalState;
  githubAppModal: GitHubAppModalState;
  responseModal: ResponseModalState;
}

export function WorkspaceModals({
  reviewerModal,
  githubAppModal,
  responseModal,
}: WorkspaceModalsProps) {
  return (
    <>
      {/* Reviewer Suggestions Modal */}
      {reviewerModal.repositories.length > 0 && (
        <ReviewerSuggestionsModal
          open={reviewerModal.open}
          onOpenChange={reviewerModal.onOpenChange}
          repositories={reviewerModal.repositories.map((r) => ({
            id: r.id,
            name: r.name,
            owner: r.owner,
            full_name: r.full_name,
          }))}
        />
      )}

      {/* GitHub App Install Modal */}
      {githubAppModal.selectedRepository && (
        <GitHubAppInstallModal
          open={githubAppModal.open}
          onOpenChange={githubAppModal.onOpenChange}
          repository={{
            id: githubAppModal.selectedRepository.id,
            full_name: githubAppModal.selectedRepository.full_name,
            owner: githubAppModal.selectedRepository.owner,
            name: githubAppModal.selectedRepository.name,
          }}
          isInstalled={githubAppModal.isInstalled}
        />
      )}

      {/* Response Preview Modal - Wrapped in AI Error Boundary */}
      <AIFeatureErrorBoundary
        featureName="Response Suggestions"
        fallback={
          <div className="p-4 text-center text-muted-foreground">
            <p>AI-powered response suggestions are temporarily unavailable.</p>
            <p className="text-sm mt-2">You can still manually respond to items.</p>
          </div>
        }
      >
        <ResponsePreviewModal
          open={responseModal.open}
          onOpenChange={responseModal.onOpenChange}
          loading={responseModal.loading}
          similarItems={responseModal.similarItems}
          responseMessage={responseModal.responseMessage}
          currentItem={responseModal.currentItem || undefined}
          workspaceId={responseModal.workspaceId}
          onCopyToClipboard={() => {
            toast.success('Response copied to clipboard!');
          }}
          onItemMarkedAsResponded={responseModal.onItemMarkedAsResponded}
        />
      </AIFeatureErrorBoundary>
    </>
  );
}
