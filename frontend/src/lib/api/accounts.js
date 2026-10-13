// Our own account endpoint (DESIGN.md §5.4, §7.11).
import { ApiError, apiRequest } from "./client.js";

/**
 * Delete the account of the logged-in user (AUTH-005).
 * A 401 can mean that the user must authenticate again. The shared 401 handler
 * would log the user out in the SPA, so this function reads the 401 itself.
 * @throws {ApiError} With the code reauthentication_required, or another code.
 */
export async function deleteAccount() {
  const response = await apiRequest("DELETE", "/api/v1/accounts/me", { allowStatuses: [401] });
  if (response.status === 401) {
    const error = response.data?.error;
    throw new ApiError({
      status: 401,
      code: error?.code ?? "reauthentication_required",
      message: error?.message ?? "",
      fields: error?.fields ?? null,
      body: response.data,
    });
  }
}
