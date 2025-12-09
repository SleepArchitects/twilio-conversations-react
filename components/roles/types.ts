export type Role = {
  role_id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_on?: string | null;
  created_by?: string | null;
  updated_on?: string | null;
  updated_by?: string | null;
  archived_on?: string | null;
  archived_by?: string | null;
};

export type UpdateRolePayload = {
  tenant_id: string;
  practice_id: string;
  role_id: string;
  name: string;
  description: string;
};
export type CreateRolePayload = {
  tenant_id: string;
  practice_id: string;
  name: string;
  description: string;
};
export interface ArchiveRolePayload {
  tenant_id: string;
  practice_id: string;
  role_id: string;
}
