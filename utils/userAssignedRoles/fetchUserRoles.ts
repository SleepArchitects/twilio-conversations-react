import axios from "axios";

export interface UserRole {
  sax_id: string;
  role_id: string;
  assigned_on: string;
  assigned_by: string;
  removed_on: string | null;
  removed_by: string | null;
  active: boolean;
}

export async function fetchUserRoles(saxId: number): Promise<UserRole[]> {
  const { data } = await axios.post<UserRole[]>(
    `/api/users/${saxId}/roles`,
    null,
    {
      params: { sax_id: saxId },
    },
  );
  return data;
}
