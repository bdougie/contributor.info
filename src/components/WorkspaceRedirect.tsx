import { Navigate, useParams } from 'react-router-dom';

/**
 * Redirect component that properly handles route parameters
 * for workspace route typos (singular to plural)
 */
export function WorkspaceRedirect({ includeTab = false }: { includeTab?: boolean }) {
  const params = useParams();

  if (includeTab) {
    const { id, tab } = params;
    return <Navigate to={`/workspaces/${id}/${tab}`} replace />;
  }

  const { id } = params;
  return <Navigate to={`/workspaces/${id}`} replace />;
}
