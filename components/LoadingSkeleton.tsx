'use client'

interface LoadingSkeletonProps {
  type?: 'card' | 'table' | 'stats' | 'list'
  count?: number
}

export default function LoadingSkeleton({ type = 'card', count = 1 }: LoadingSkeletonProps) {
  const skeletonClass = "animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%]"

  if (type === 'stats') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className={`h-4 w-24 rounded mb-3 ${skeletonClass}`}></div>
                <div className={`h-10 w-16 rounded ${skeletonClass}`}></div>
              </div>
              <div className={`w-16 h-16 rounded-full ${skeletonClass}`}></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'table') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 border-b">
          <div className={`h-6 w-48 rounded ${skeletonClass}`}></div>
        </div>
        {[...Array(count)].map((_, i) => (
          <div key={i} className="p-4 border-b flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full ${skeletonClass}`}></div>
            <div className="flex-1 space-y-2">
              <div className={`h-4 w-3/4 rounded ${skeletonClass}`}></div>
              <div className={`h-3 w-1/2 rounded ${skeletonClass}`}></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'list') {
    return (
      <div className="space-y-3">
        {[...Array(count)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border-2 border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-full ${skeletonClass}`}></div>
              <div className="flex-1 space-y-2">
                <div className={`h-4 w-3/4 rounded ${skeletonClass}`}></div>
                <div className={`h-3 w-1/2 rounded ${skeletonClass}`}></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Default: card type
  return (
    <div className="space-y-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-600">
          <div className="space-y-3">
            <div className={`h-6 w-3/4 rounded ${skeletonClass}`}></div>
            <div className={`h-4 w-full rounded ${skeletonClass}`}></div>
            <div className={`h-4 w-5/6 rounded ${skeletonClass}`}></div>
            <div className="flex gap-2 mt-4">
              <div className={`h-10 w-24 rounded-lg ${skeletonClass}`}></div>
              <div className={`h-10 w-24 rounded-lg ${skeletonClass}`}></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Specific skeletons for common use cases
export function DashboardSkeleton() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <div className="animate-pulse bg-gray-200 h-10 w-64 rounded mb-2"></div>
        <div className="animate-pulse bg-gray-200 h-4 w-48 rounded"></div>
      </div>
      <LoadingSkeleton type="stats" />
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border-2 border-gray-200 dark:border-gray-600">
          <div className="animate-pulse bg-gray-200 h-6 w-48 rounded mb-4"></div>
          <div className="animate-pulse bg-gray-200 h-64 rounded"></div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border-2 border-gray-200 dark:border-gray-600">
          <div className="animate-pulse bg-gray-200 h-6 w-48 rounded mb-4"></div>
          <div className="animate-pulse bg-gray-200 h-64 rounded"></div>
        </div>
      </div>
    </div>
  )
}

export function MembersSkeleton() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex justify-between items-center">
        <div className="animate-pulse bg-gray-200 h-8 w-48 rounded"></div>
        <div className="animate-pulse bg-gray-200 h-10 w-32 rounded-lg"></div>
      </div>
      <LoadingSkeleton type="stats" count={5} />
      <div className="mt-6">
        <LoadingSkeleton type="table" count={10} />
      </div>
    </div>
  )
}
