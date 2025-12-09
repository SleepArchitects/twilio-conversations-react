import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { fetchUserRoles, type UserRole } from '@/utils/userAssignedRoles/fetchUserRoles';
import { fetchRoles } from '@/utils/roles/fetchRoles';
import type { Role } from '@/components/roles/types';

/**
 * Hook to fetch all available roles in the system
 */
export function useAllRoles() {
  return useQuery({
    queryKey: ['all-roles'],
    queryFn: async () => {
      const roles = await fetchRoles();
      // Cache in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('all_roles', JSON.stringify(roles));
      }
      return roles;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Hook to fetch and cache the current logged-in user's assigned roles
 * Stores roles in localStorage for quick access across sessions
 */
export function useCurrentUserRoles() {
  const { user } = useAuth();
  const saxId = user?.saxId ? Number(user.saxId) : null;

  const query = useQuery({
    queryKey: ['current-user-roles', saxId],
    queryFn: async () => {
      if (!saxId) return [];
      
      console.log('[useCurrentUserRoles] Fetching roles for saxId:', saxId);
      const roles = await fetchUserRoles(saxId);
      console.log('[useCurrentUserRoles] API returned roles:', {
        count: roles.length,
        roleIds: roles.map(r => r.role_id),
        hasSaxRole: roles.some(r => r.role_id === '7742d9e2-0d5b-4eb1-81b7-4e7c476b45f0')
      });
      
      // Store in localStorage for quick access
      if (typeof window !== 'undefined') {
        localStorage.setItem('user_roles', JSON.stringify(roles));
      }
      
      return roles;
    },
    enabled: !!saxId,
    staleTime: 0, // TEMPORARY: Set to 0 to always fetch fresh data (was 5 * 60 * 1000)
    gcTime: 10 * 60 * 1000, // 10 minutes
    // Fetch roles on mount and when window regains focus
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  return query;
}

/**
 * Hook to check if the current user has a specific role by name
 * Super Admin bypasses all role checks (always returns true)
 * @param roleName - Role name (e.g., "Admin", "Patients") or array of names (OR logic)
 * @returns boolean indicating if user has the role
 */
export function useHasRole(roleName: string | string[]): boolean {
  const { data: userRoles } = useCurrentUserRoles();
  const { data: allRoles } = useAllRoles();
  
  // Fallback to localStorage
  const cachedUserRoles = typeof window !== 'undefined' 
    ? localStorage.getItem('user_roles') 
    : null;
  const cachedAllRoles = typeof window !== 'undefined'
    ? localStorage.getItem('all_roles')
    : null;
  
  const userRolesList = userRoles || (cachedUserRoles ? JSON.parse(cachedUserRoles) : []);
  const allRolesList = allRoles || (cachedAllRoles ? JSON.parse(cachedAllRoles) : []);
  
  // Filter to only active user roles
  const activeUserRoles = userRolesList.filter((r: UserRole) => r.active);
  
  // Super Admin bypasses all checks
  const isSuperAdmin = activeUserRoles.some((ur: UserRole) => {
    const role = allRolesList.find((r: Role) => r.role_id === ur.role_id);
    return role?.name === 'Super Admin';
  });
  
  if (isSuperAdmin) return true;
  
  // Support checking multiple roles (OR logic)
  const roleNamesToCheck = Array.isArray(roleName) ? roleName : [roleName];
  
  return roleNamesToCheck.some(name => 
    activeUserRoles.some((ur: UserRole) => {
      const role = allRolesList.find((r: Role) => r.role_id === ur.role_id);
      return role?.name === name;
    })
  );
}

/**
 * Hook to check if user has ALL specified roles by name (AND logic)
 * Super Admin bypasses all role checks (always returns true)
 */
export function useHasAllRoles(roleNames: string[]): boolean {
  const { data: userRoles } = useCurrentUserRoles();
  const { data: allRoles } = useAllRoles();
  
  const cachedUserRoles = typeof window !== 'undefined' 
    ? localStorage.getItem('user_roles') 
    : null;
  const cachedAllRoles = typeof window !== 'undefined'
    ? localStorage.getItem('all_roles')
    : null;
  
  const userRolesList = userRoles || (cachedUserRoles ? JSON.parse(cachedUserRoles) : []);
  const allRolesList = allRoles || (cachedAllRoles ? JSON.parse(cachedAllRoles) : []);
  const activeUserRoles = userRolesList.filter((r: UserRole) => r.active);
  
  // Super Admin bypasses all checks
  const isSuperAdmin = activeUserRoles.some((ur: UserRole) => {
    const role = allRolesList.find((r: Role) => r.role_id === ur.role_id);
    return role?.name === 'Super Admin';
  });
  
  if (isSuperAdmin) return true;
  
  return roleNames.every(name => 
    activeUserRoles.some((ur: UserRole) => {
      const role = allRolesList.find((r: Role) => r.role_id === ur.role_id);
      return role?.name === name;
    })
  );
}

/**
 * Get all role names for the current user
 */
export function useUserRoleNames(): string[] {
  const { data: userRoles } = useCurrentUserRoles();
  const { data: allRoles } = useAllRoles();
  
  const cachedUserRoles = typeof window !== 'undefined' 
    ? localStorage.getItem('user_roles') 
    : null;
  const cachedAllRoles = typeof window !== 'undefined'
    ? localStorage.getItem('all_roles')
    : null;
  
  const userRolesList = userRoles || (cachedUserRoles ? JSON.parse(cachedUserRoles) : []);
  const allRolesList = allRoles || (cachedAllRoles ? JSON.parse(cachedAllRoles) : []);
  
  return userRolesList
    .filter((r: UserRole) => r.active)
    .map((ur: UserRole) => {
      const role = allRolesList.find((r: Role) => r.role_id === ur.role_id);
      return role?.name || '';
    })
    .filter(Boolean);
}

/**
 * Check if user is Super Admin
 */
export function useIsSuperAdmin(): boolean {
  return useHasRole('Super Admin');
}

