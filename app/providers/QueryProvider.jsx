"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// App-wide TanStack Query client. Sensible defaults for an ads dashboard:
// cache for a minute, one retry, no refetch-on-focus storm.
export default function QueryProvider({ children }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000, // 1 min — data stays "fresh", avoids refetch storms
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
