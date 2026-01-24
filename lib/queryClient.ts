import { QueryClient } from '@tanstack/react-query'

// Create optimized query client for better performance
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data fresh for 5 minutes
      staleTime: 5 * 60 * 1000, // 5 minutes

      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)

      // Don't refetch on window focus (better for local network)
      refetchOnWindowFocus: false,

      // Don't refetch on reconnect (we're on local network)
      refetchOnReconnect: false,

      // Don't refetch on mount (use cached data)
      refetchOnMount: false,

      // Retry failed requests only once
      retry: 1,
      retryDelay: 1000,

      // Network mode - only fetch when online
      networkMode: 'online',
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      retryDelay: 1000,
    },
  },
})

export default queryClient
