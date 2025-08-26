/**
 * Workspace Service Layer
 * Business logic for workspace operations
 */

import { supabase } from '@/lib/supabase';
import {
  validateCreateWorkspace,
  validateUpdateWorkspace,
  formatValidationErrors
} from '@/lib/validations/workspace';
import type {
  Workspace,
  WorkspaceWithStats,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  WorkspaceFilters,
  WorkspaceRole,
  AddRepositoryRequest,
  WorkspaceRepository,
  WorkspaceRepositoryWithDetails,
  WorkspaceRepositoryFilters
} from '@/types/workspace';

/**
 * Service response type
 */
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

/**
 * Paginated response type
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Workspace Service Class
 */
export class WorkspaceService {
  /**
   * Create a new workspace
   */
  static async createWorkspace(
    userId: string,
    data: CreateWorkspaceRequest
  ): Promise<ServiceResponse<Workspace>> {
    try {
      // Validate input
      const validation = validateCreateWorkspace(data);
      if (!validation.valid) {
        return {
          success: false,
          error: formatValidationErrors(validation.errors),
          statusCode: 400
        };
      }

      // Check if user has reached workspace limit (based on tier)
      const { count, error: countError } = await supabase
        .from('workspaces')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId);

      if (countError) {
        console.error('Error checking workspace count:', countError);
        return {
          success: false,
          error: 'Failed to check workspace limit',
          statusCode: 500
        };
      }

      // Get user's subscription to determine tier and limits
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('tier, max_workspaces, max_repos_per_workspace')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      // Determine workspace limit and repository limit based on subscription
      const workspaceLimit = subscription?.max_workspaces || 1; // Default to free tier
      const maxRepositories = subscription?.max_repos_per_workspace || 4; // Default to free tier (4 repos)
      const tier = subscription?.tier || 'free';
      
      // Define tier limits mapping for clarity
      const tierRetentionDays = {
        enterprise: 365,
        pro: 90,
        free: 30
      };
      const dataRetentionDays = tierRetentionDays[tier as keyof typeof tierRetentionDays] || 30;

      if (count !== null && count >= workspaceLimit) {
        return {
          success: false,
          error: `You have reached the limit of ${workspaceLimit} workspaces for your current plan`,
          statusCode: 403
        };
      }

      // Generate slug
      const { data: slugData, error: slugError } = await supabase
        .rpc('generate_workspace_slug', { workspace_name: data.name });

      if (slugError || !slugData) {
        return {
          success: false,
          error: 'Failed to generate workspace slug',
          statusCode: 500
        };
      }

      // Begin transaction-like operation
      // Create workspace
      const { data: workspace, error: createError } = await supabase
        .from('workspaces')
        .insert({
          name: data.name,
          slug: slugData,
          description: data.description || null,
          owner_id: userId,
          visibility: data.visibility || 'public',
          settings: data.settings || {},
          tier: tier,
          max_repositories: maxRepositories,
          current_repository_count: 0,
          data_retention_days: dataRetentionDays
        })
        .select()
        .maybeSingle();

      if (createError) {
        if (createError.code === '23505') {
          return {
            success: false,
            error: 'A workspace with this name already exists',
            statusCode: 409
          };
        }
        throw createError;
      }

      // Add creator as owner member
      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspace.id,
          user_id: userId,
          role: 'owner'
        });

      if (memberError) {
        // Rollback workspace creation
        await supabase.from('workspaces').delete().eq('id', workspace.id);
        throw memberError;
      }

      return {
        success: true,
        data: workspace,
        statusCode: 201
      };
    } catch (error) {
      console.error('Create workspace error:', error);
      return {
        success: false,
        error: 'Failed to create workspace',
        statusCode: 500
      };
    }
  }

  /**
   * Update a workspace
   */
  static async updateWorkspace(
    workspaceId: string,
    userId: string,
    data: UpdateWorkspaceRequest
  ): Promise<ServiceResponse<Workspace>> {
    try {
      // Validate input
      const validation = validateUpdateWorkspace(data);
      if (!validation.valid) {
        return {
          success: false,
          error: formatValidationErrors(validation.errors),
          statusCode: 400
        };
      }

      // Check permissions
      const { data: member } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!member || !['owner', 'admin'].includes(member.role)) {
        return {
          success: false,
          error: 'Insufficient permissions to update workspace',
          statusCode: 403
        };
      }

      // Prepare update data
      const updateData: Partial<Pick<Workspace, 'name' | 'description' | 'visibility' | 'settings' | 'updated_at'>> = {
        updated_at: new Date().toISOString()
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.visibility !== undefined) updateData.visibility = data.visibility;
      if (data.settings !== undefined) updateData.settings = data.settings;

      // Update workspace
      const { data: workspace, error: updateError } = await supabase
        .from('workspaces')
        .update(updateData)
        .eq('id', workspaceId)
        .select()
        .maybeSingle();

      if (updateError) {
        if (updateError.code === 'PGRST116') {
          return {
            success: false,
            error: 'Workspace not found',
            statusCode: 404
          };
        }
        throw updateError;
      }

      return {
        success: true,
        data: workspace,
        statusCode: 200
      };
    } catch (error) {
      console.error('Update workspace error:', error);
      return {
        success: false,
        error: 'Failed to update workspace',
        statusCode: 500
      };
    }
  }

  /**
   * Delete a workspace
   */
  static async deleteWorkspace(
    workspaceId: string,
    userId: string
  ): Promise<ServiceResponse<void>> {
    try {
      // Check if user is the owner
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', workspaceId)
        .maybeSingle();

      if (!workspace) {
        return {
          success: false,
          error: 'Workspace not found',
          statusCode: 404
        };
      }

      if (workspace.owner_id !== userId) {
        return {
          success: false,
          error: 'Only workspace owner can delete workspace',
          statusCode: 403
        };
      }

      // Delete workspace (cascade will handle related records)
      const { error: deleteError } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceId);

      if (deleteError) {
        throw deleteError;
      }

      return {
        success: true,
        statusCode: 200
      };
    } catch (error) {
      console.error('Delete workspace error:', error);
      return {
        success: false,
        error: 'Failed to delete workspace',
        statusCode: 500
      };
    }
  }

  /**
   * Get workspace by ID
   */
  static async getWorkspace(
    workspaceId: string,
    userId: string
  ): Promise<ServiceResponse<WorkspaceWithStats>> {
    try {
      // Get workspace with member check
      const { data: workspace, error } = await supabase
        .from('workspaces')
        .select(`
          *,
          workspace_members!inner(
            user_id,
            role
          ),
          repository_count:workspace_repositories(count),
          member_count:workspace_members(count),
          owner:users!workspaces_owner_id_fkey(
            id,
            email,
            display_name,
            avatar_url
          )
        `)
        .eq('id', workspaceId)
        .eq('workspace_members.user_id', userId)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: 'Workspace not found or access denied',
            statusCode: 404
          };
        }
        throw error;
      }

      // Calculate stats
      const stats = {
        repository_count: workspace.repository_count?.[0]?.count || 0,
        member_count: workspace.member_count?.[0]?.count || 0,
        total_stars: 0, // TODO: Calculate from repositories
        total_contributors: 0 // TODO: Calculate from repositories
      };

      const workspaceWithStats: WorkspaceWithStats = {
        ...workspace,
        ...stats
      };

      return {
        success: true,
        data: workspaceWithStats,
        statusCode: 200
      };
    } catch (error) {
      console.error('Get workspace error:', error);
      return {
        success: false,
        error: 'Failed to get workspace',
        statusCode: 500
      };
    }
  }

  /**
   * List user's workspaces
   */
  static async listWorkspaces(
    userId: string,
    filters: WorkspaceFilters & { page?: number; limit?: number }
  ): Promise<ServiceResponse<PaginatedResponse<WorkspaceWithStats>>> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const offset = (page - 1) * limit;

      let query = supabase
        .from('workspaces')
        .select(`
          *,
          workspace_members!inner(
            user_id,
            role
          ),
          repository_count:workspace_repositories(count),
          member_count:workspace_members(count),
          owner:users!workspaces_owner_id_fkey(
            id,
            email,
            display_name,
            avatar_url
          )
        `, { count: 'exact' })
        .eq('workspace_members.user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (filters.visibility) {
        query = query.eq('visibility', filters.visibility);
      }

      // Note: role filtering would need to be added to WorkspaceFilters interface if needed

      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const { data: workspaces, error, count } = await query;

      if (error) {
        throw error;
      }

      // Transform workspaces with stats
      const workspacesWithStats: WorkspaceWithStats[] = (workspaces || []).map(w => ({
        ...w,
        repository_count: w.repository_count?.[0]?.count || 0,
        member_count: w.member_count?.[0]?.count || 0,
        total_stars: 0, // TODO: Calculate
        total_contributors: 0 // TODO: Calculate
      }));

      return {
        success: true,
        data: {
          items: workspacesWithStats,
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit)
          }
        },
        statusCode: 200
      };
    } catch (error) {
      console.error('List workspaces error:', error);
      return {
        success: false,
        error: 'Failed to list workspaces',
        statusCode: 500
      };
    }
  }

  /**
   * Check user permissions for a workspace
   */
  static async checkPermission(
    workspaceId: string,
    userId: string,
    requiredRoles: WorkspaceRole[]
  ): Promise<{ hasPermission: boolean; role?: WorkspaceRole }> {
    try {
      const { data: member } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!member) {
        return { hasPermission: false };
      }

      return {
        hasPermission: requiredRoles.includes(member.role as WorkspaceRole),
        role: member.role as WorkspaceRole
      };
    } catch (error) {
      console.error('Check permission error:', error);
      return { hasPermission: false };
    }
  }

  /**
   * Add a repository to a workspace
   */
  static async addRepositoryToWorkspace(
    workspaceId: string,
    userId: string,
    data: AddRepositoryRequest
  ): Promise<ServiceResponse<WorkspaceRepository>> {
    try {
      // Check permissions
      const permission = await this.checkPermission(workspaceId, userId, ['owner', 'admin', 'editor']);
      if (!permission.hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to add repositories',
          statusCode: 403
        };
      }

      // Check if repository already exists in workspace
      const { data: existing } = await supabase
        .from('workspace_repositories')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('repository_id', data.repository_id)
        .maybeSingle();

      if (existing) {
        return {
          success: false,
          error: 'Repository already exists in this workspace',
          statusCode: 409
        };
      }

      // Check workspace repository limit
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('max_repositories, current_repository_count')
        .eq('id', workspaceId)
        .maybeSingle();

      if (!workspace) {
        return {
          success: false,
          error: 'Workspace not found',
          statusCode: 404
        };
      }

      if (workspace.current_repository_count >= workspace.max_repositories) {
        return {
          success: false,
          error: `Repository limit reached. Maximum ${workspace.max_repositories} repositories allowed.`,
          statusCode: 403
        };
      }

      // Add repository to workspace
      const { data: workspaceRepo, error: addError } = await supabase
        .from('workspace_repositories')
        .insert({
          workspace_id: workspaceId,
          repository_id: data.repository_id,
          added_by: userId,
          notes: data.notes || null,
          tags: data.tags || [],
          is_pinned: data.is_pinned || false
        })
        .select()
        .maybeSingle();

      if (addError) {
        throw addError;
      }

      // Update workspace repository count
      await supabase
        .from('workspaces')
        .update({
          current_repository_count: workspace.current_repository_count + 1,
          last_activity_at: new Date().toISOString()
        })
        .eq('id', workspaceId);

      return {
        success: true,
        data: workspaceRepo,
        statusCode: 201
      };
    } catch (error) {
      console.error('Add repository to workspace error:', error);
      return {
        success: false,
        error: 'Failed to add repository to workspace',
        statusCode: 500
      };
    }
  }

  /**
   * Remove a repository from a workspace
   */
  static async removeRepositoryFromWorkspace(
    workspaceId: string,
    userId: string,
    repositoryId: string
  ): Promise<ServiceResponse<void>> {
    try {
      // Check permissions
      const permission = await this.checkPermission(workspaceId, userId, ['owner', 'admin', 'editor']);
      if (!permission.hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to remove repositories',
          statusCode: 403
        };
      }

      // Remove repository from workspace
      const { error: removeError } = await supabase
        .from('workspace_repositories')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('repository_id', repositoryId);

      if (removeError) {
        throw removeError;
      }

      // Update workspace repository count
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('current_repository_count')
        .eq('id', workspaceId)
        .maybeSingle();

      if (workspace && workspace.current_repository_count > 0) {
        await supabase
          .from('workspaces')
          .update({
            current_repository_count: workspace.current_repository_count - 1,
            last_activity_at: new Date().toISOString()
          })
          .eq('id', workspaceId);
      }

      return {
        success: true,
        statusCode: 200
      };
    } catch (error) {
      console.error('Remove repository from workspace error:', error);
      return {
        success: false,
        error: 'Failed to remove repository from workspace',
        statusCode: 500
      };
    }
  }

  /**
   * Update workspace repository settings
   */
  static async updateWorkspaceRepository(
    workspaceId: string,
    userId: string,
    repositoryId: string,
    updates: {
      notes?: string | null;
      tags?: string[];
      is_pinned?: boolean;
    }
  ): Promise<ServiceResponse<WorkspaceRepository>> {
    try {
      // Check permissions
      const permission = await this.checkPermission(workspaceId, userId, ['owner', 'admin', 'editor']);
      if (!permission.hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to update repository settings',
          statusCode: 403
        };
      }

      // Update the repository settings
      const { data, error } = await supabase
        .from('workspace_repositories')
        .update({
          notes: updates.notes,
          tags: updates.tags,
          is_pinned: updates.is_pinned,
          updated_at: new Date().toISOString()
        })
        .eq('workspace_id', workspaceId)
        .eq('repository_id', repositoryId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return {
        success: true,
        data,
        statusCode: 200
      };
    } catch (error) {
      console.error('Update workspace repository error:', error);
      return {
        success: false,
        error: 'Failed to update repository settings',
        statusCode: 500
      };
    }
  }

  /**
   * List repositories in a workspace
   */
  static async listWorkspaceRepositories(
    workspaceId: string,
    userId: string,
    filters?: WorkspaceRepositoryFilters & { page?: number; limit?: number }
  ): Promise<ServiceResponse<PaginatedResponse<WorkspaceRepositoryWithDetails>>> {
    try {
      // Check permissions
      const permission = await this.checkPermission(workspaceId, userId, ['owner', 'admin', 'editor', 'viewer']);
      if (!permission.hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to view repositories',
          statusCode: 403
        };
      }

      const page = filters?.page || 1;
      const limit = filters?.limit || 20;
      const offset = (page - 1) * limit;

      let query = supabase
        .from('workspace_repositories')
        .select(`
          *,
          repository:repositories!workspace_repositories_repository_id_fkey(
            id,
            full_name,
            owner,
            name,
            description,
            language,
            stargazers_count,
            forks_count,
            open_issues_count,
            topics,
            is_private,
            is_archived
          ),
          added_by_user:users!workspace_repositories_added_by_fkey(
            id,
            email,
            display_name
          )
        `, { count: 'exact' })
        .eq('workspace_id', workspaceId);

      // Apply filters
      if (filters?.is_pinned !== undefined) {
        query = query.eq('is_pinned', filters.is_pinned);
      }

      if (filters?.tags && filters.tags.length > 0) {
        query = query.contains('tags', filters.tags);
      }

      if (filters?.search) {
        // Note: This searches in the joined repository data
        query = query.or(`repository.full_name.ilike.%${filters.search}%,repository.description.ilike.%${filters.search}%`);
      }

      // Apply sorting
      const sortBy = filters?.sort_by || 'added_at';
      const sortOrder = filters?.sort_order || 'desc';
      
      if (sortBy === 'added_at') {
        query = query.order('added_at', { ascending: sortOrder === 'asc' });
      } else if (sortBy === 'name') {
        query = query.order('repository(name)', { ascending: sortOrder === 'asc' });
      }
      // Note: For stars and activity sorting, we'd need to handle this differently

      query = query.range(offset, offset + limit - 1);

      const { data: repositories, error, count } = await query;

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: {
          items: repositories as WorkspaceRepositoryWithDetails[],
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit)
          }
        },
        statusCode: 200
      };
    } catch (error) {
      console.error('List workspace repositories error:', error);
      return {
        success: false,
        error: 'Failed to list workspace repositories',
        statusCode: 500
      };
    }
  }
}