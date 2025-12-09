import axios from "axios";
import type { Role } from "@/components/roles/types";

export async function fetchRoles(): Promise<Role[]> {
  const { data } = await axios.get<Role[]>("/api/roles");
  return data;
}
