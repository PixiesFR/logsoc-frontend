import { useQuery } from '@tanstack/react-query'
import { usersApi } from '../api'
import { useAuthStore } from '../stores'

// Permissions EFFECTIVES du user courant, lues depuis la matrice RBAC
// (role_permissions) via GET /users/me/permissions — la même source que la
// garde backend require_permission. Utilisé pour masquer les entrées de menu
// dont le rôle n'a pas can_read sur le module correspondant.
// Superadmin: passe toujours (backend lui donne tout implicitement).

export interface MyPermission {
  module: string
  can_read: boolean
  can_write: boolean
  can_delete: boolean
  can_export: boolean
}

export function useMyPermissions(): { allowedModules: Set<string>; perms: MyPermission[] } {
  const user = useAuthStore((s) => s.user)

  const { data } = useQuery({
    queryKey: ['my-permissions', user?.role],
    queryFn: () => usersApi.getMyPermissions().then(r => r.data),
    staleTime: 60_000,
    enabled: !!user,
  })

  const perms: MyPermission[] = (data as MyPermission[] | undefined) ?? []
  if (user?.role === 'superadmin') {
    // implicite full
    return { allowedModules: new Set(['*']), perms }
  }
  const allowed = new Set<string>()
  for (const p of perms) {
    if (p.can_read) allowed.add(p.module)
  }
  return { allowedModules: allowed, perms }
}