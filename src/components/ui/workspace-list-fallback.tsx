import { WorkspacePreviewCard } from '@/components/features/workspace/WorkspacePreviewCard';
import type { WorkspacePreviewData } from '@/components/features/workspace/WorkspacePreviewCard';

interface WorkspaceListFallbackProps {
  workspaces: WorkspacePreviewData[];
}

export function WorkspaceListFallback({ workspaces }: WorkspaceListFallbackProps) {
  return (
    <div
      className="flex gap-4 overflow-x-auto pb-2"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {workspaces.map((workspace) => (
        <div key={workspace.id} className="flex-shrink-0 w-full">
          <WorkspacePreviewCard workspace={workspace} />
        </div>
      ))}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
