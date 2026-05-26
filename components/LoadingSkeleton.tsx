'use client'

interface LoadingSkeletonProps {
  type?: 'card' | 'table' | 'stats' | 'list'
  count?: number
}

const block = 'skeleton-shimmer'

export default function LoadingSkeleton({ type = 'card', count = 1 }: LoadingSkeletonProps) {
  if (type === 'stats') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4" aria-busy="true" aria-live="polite">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className={`h-3 w-20 ${block}`} />
                <div className={`h-8 w-16 ${block}`} />
              </div>
              <div className={`w-12 h-12 rounded-full ${block}`} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'table') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden" aria-busy="true" aria-live="polite">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className={`h-5 w-48 ${block}`} />
        </div>
        {[...Array(count)].map((_, i) => (
          <div key={i} className="p-4 border-b border-gray-100 dark:border-gray-700/60 last:border-0 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full ${block}`} />
            <div className="flex-1 space-y-2">
              <div className={`h-3.5 w-3/4 ${block}`} />
              <div className={`h-3 w-1/2 ${block}`} />
            </div>
            <div className={`h-8 w-20 rounded-md ${block}`} />
          </div>
        ))}
      </div>
    )
  }

  if (type === 'list') {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        {[...Array(count)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full ${block}`} />
              <div className="flex-1 space-y-2">
                <div className={`h-4 w-3/4 ${block}`} />
                <div className={`h-3 w-1/2 ${block}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Default: card type
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
          <div className="space-y-3">
            <div className={`h-5 w-3/4 ${block}`} />
            <div className={`h-3.5 w-full ${block}`} />
            <div className={`h-3.5 w-5/6 ${block}`} />
            <div className="flex gap-2 mt-4">
              <div className={`h-9 w-24 rounded-lg ${block}`} />
              <div className={`h-9 w-24 rounded-lg ${block}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8 space-y-2">
        <div className={`h-8 w-64 ${block}`} />
        <div className={`h-4 w-48 ${block}`} />
      </div>
      <LoadingSkeleton type="stats" />
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
          <div className={`h-5 w-48 mb-4 ${block}`} />
          <div className={`h-64 ${block}`} />
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
          <div className={`h-5 w-48 mb-4 ${block}`} />
          <div className={`h-64 ${block}`} />
        </div>
      </div>
    </div>
  )
}

export function MembersSkeleton() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex justify-between items-center">
        <div className={`h-8 w-48 ${block}`} />
        <div className={`h-10 w-32 rounded-lg ${block}`} />
      </div>
      <LoadingSkeleton type="stats" count={5} />
      <div className="mt-6">
        <LoadingSkeleton type="table" count={10} />
      </div>
    </div>
  )
}
