import React, { createContext, useContext } from 'react';
import {
  useContributorRoles as useContributorRolesHook,
  ContributorRoleWithStats,
} from '@/hooks/useContributorRoles';

interface ContributorRolesContextType {
  roles: ContributorRoleWithStats[];
  loading: boolean;
  error: Error | null;
  owner: string;
  repo: string;
}

const ContributorRolesContext = createContext<ContributorRolesContextType | undefined>(undefined);

interface ContributorRolesProviderProps {
  owner: string;
  repo: string;
  children: React.ReactNode;
}

export function ContributorRolesProvider({ owner, repo, children }: ContributorRolesProviderProps) {
  const { roles, loading, error } = useContributorRolesHook(owner, repo);

  return (
    <ContributorRolesContext.Provider value={{ roles, loading, error, owner, repo }}>
      {children}
    </ContributorRolesContext.Provider>
  );
}

export function useContributorRoleFromContext() {
  return useContext(ContributorRolesContext);
}
