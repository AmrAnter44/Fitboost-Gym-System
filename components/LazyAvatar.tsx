'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'

interface Props {
  src?: string | null
  alt: string
  fallback: ReactNode
  imgClassName?: string
  rootMargin?: string
}

// LazyAvatar
// Renders text in member cards instantly; images load only when the card enters the viewport.
// - Uses IntersectionObserver to defer image loads until visible.
// - fetchpriority="low" so the browser prioritises JSON/CSS over avatars.
// - Fallback (SVG/initials) remains visible until the image finishes loading.
export default function LazyAvatar({
  src,
  alt,
  fallback,
  imgClassName = 'w-full h-full object-cover',
  rootMargin = '100px',
}: Props) {
  const [shouldLoad, setShouldLoad] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!src || shouldLoad) return

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setShouldLoad(true)
      return
    }

    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [src, shouldLoad, rootMargin])

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {src && shouldLoad && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          {...({ fetchpriority: 'low' } as any)}
          onLoad={() => setLoaded(true)}
          className={`${imgClassName} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
        />
      )}
      {(!src || !loaded) && (
        <div className="absolute inset-0 w-full h-full">{fallback}</div>
      )}
    </div>
  )
}
