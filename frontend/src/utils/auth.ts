// utils/auth.ts
import { validateToken } from "../api/axios";

// utils/auth.ts
export const isAuthenticated = async (): Promise<boolean> => {
  // First check localStorage
  const accessToken = localStorage.getItem("access_token");
  if (!accessToken) {
    return false;
  }
  const res = await validateToken();
  return Boolean(res?.user_id);
};
