import { QueryClient } from "@tanstack/react-query";

// A 4xx or 5xx answer will not change if the client asks again. Only a
// network error (status 0) is worth a retry.
function retry(failureCount, error) {
  return error?.status === 0 && failureCount < 2;
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry, refetchOnWindowFocus: false, staleTime: 15_000 },
    },
  });
}

export const queryClient = makeQueryClient();
