// app/login/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [gymLogo, setGymLogo] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/public/settings')
      .then(res => res.json())
      .then(data => {
        if (data.gymLogo) setGymLogo(data.gymLogo)
        if (data.primaryColor) {
          import('../../lib/theme/generatePalette').then(({ applyPaletteToDOM }) => {
            applyPaletteToDOM(data.primaryColor)
          })
        }
      })
      .catch(() => {})
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (response.ok) {
        // Redirect user based on role
        const redirectUrl = data.user?.role === 'COACH' ? '/coach' : '/members'

        // Use window.location instead of router.push for full reload
        // This ensures permissions are reloaded in the Navbar
        window.location.href = redirectUrl
      } else {
        setError(data.error || 'Login failed. Please check your credentials.')
      }
    } catch (error) {
      setError('Connection error. Please check your internet connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-black relative overflow-hidden">
      {/* Rotating Glow Halo */}
      <div className="rotating-glow"></div>

      {/* Animated Lines Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="animated-line line-1"></div>
        <div className="animated-line line-2"></div>
        <div className="animated-line line-3"></div>
        <div className="animated-line line-4"></div>
        <div className="animated-line line-5"></div>
      </div>

      {/* Hero Section */}
      <section className="relative z-10 pt-8 pb-6 flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 text-center">
          {/* Orbit Container */}
          <div className="relative w-full max-w-md mx-auto aspect-square flex items-center justify-center">
            {/* Center Logo */}
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-36 md:h-36">
                <img
                  src="/fb.png"
                  alt="Fit Boost Logo"
                  className="logo-switch absolute inset-0 w-full h-full object-contain drop-shadow-2xl"
                />
                <img
                  src={gymLogo || '/assets/icon.png'}
                  alt="Gym Logo"
                  className="logo-switch-alt absolute inset-0 w-full h-full object-contain drop-shadow-2xl"
                />
              </div>
            </div>

            {/* Orbiting Items */}
            <div className="orbit-item absolute" style={{ animationDelay: '0s' }}>
              <div className="orbit-content w-14 h-14 sm:w-16 sm:h-16 flex flex-col items-center justify-center rounded-xl bg-primary-500/60 backdrop-blur-sm border-2 border-primary-400/60">
                <p className="text-xs sm:text-sm text-white font-bold">System</p>
              </div>
            </div>

            <div className="orbit-item absolute" style={{ animationDelay: '-6.67s' }}>
              <div className="orbit-content w-14 h-14 sm:w-16 sm:h-16 flex flex-col items-center justify-center rounded-xl bg-primary-500/60 backdrop-blur-sm border-2 border-primary-400/60">
                <p className="text-xs sm:text-sm text-white font-bold">App</p>
              </div>
            </div>

            <div className="orbit-item absolute" style={{ animationDelay: '-13.33s' }}>
              <div className="orbit-content w-14 h-14 sm:w-16 sm:h-16 flex flex-col items-center justify-center rounded-xl bg-primary-500/60 backdrop-blur-sm border-2 border-primary-400/60">
                <p className="text-xs sm:text-sm text-white font-bold">Website</p>
              </div>
            </div>

            {/* Circular Arrow Path */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg className="w-full h-full animate-spin-slow">
                <defs>
                  <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="rgba(251, 191, 36, 0.5)" />
                  </marker>
                </defs>
                <circle
                  cx="50%"
                  cy="50%"
                  r="22%"
                  fill="none"
                  stroke="rgba(251, 191, 36, 0.6)"
                  strokeWidth="1.5"
                  strokeDasharray="3,8"
                  markerEnd="url(#arrowhead)"
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Login Form - Bottom */}
      <div className="flex-1 flex items-end justify-center pb-16 relative z-10">
        <div className="bg-white/95 dark:bg-gray-800 p-5 rounded-2xl shadow-xl ring-1 ring-gray-200 dark:ring-gray-700 w-full max-w-sm">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 ring-1 ring-red-200 dark:ring-red-900/50 text-red-700 dark:text-red-300 p-3 rounded-lg mb-4 text-sm flex items-start gap-2" role="alert">
            <svg {...stroke} className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              Email or Username
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm"
              placeholder="Enter your email or username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pe-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute inset-y-0 end-0 px-3 flex items-center text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors duration-200"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
          >
            {loading && (
              <svg {...stroke} className="w-4 h-4 animate-spin" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            <span>{loading ? 'Logging in...' : 'Login'}</span>
          </button>
        </form>
        </div>
      </div>

      <style jsx>{`
        /*  crossfade هادي بين اللوجوهين — من غير أي دوران/تشقلب */
        @keyframes logoSwitch {
          0%, 45% { opacity: 1; }
          50%, 95% { opacity: 0; }
          100% { opacity: 1; }
        }

        @keyframes logoSwitchAlt {
          0%, 45% { opacity: 0; }
          50%, 95% { opacity: 1; }
          100% { opacity: 0; }
        }

        .logo-switch {
          animation: logoSwitch 8s ease-in-out infinite;
          opacity: 1;
        }

        .logo-switch-alt {
          animation: logoSwitchAlt 8s ease-in-out infinite;
          opacity: 0;
        }

        @keyframes orbit {
          from {
            transform: rotate(0deg) translateX(110px) rotate(0deg);
          }
          to {
            transform: rotate(360deg) translateX(110px) rotate(-360deg);
          }
        }

        @media (min-width: 640px) {
          @keyframes orbit {
            from {
              transform: rotate(0deg) translateX(130px) rotate(0deg);
            }
            to {
              transform: rotate(360deg) translateX(130px) rotate(-360deg);
            }
          }
        }

        @media (min-width: 768px) {
          @keyframes orbit {
            from {
              transform: rotate(0deg) translateX(150px) rotate(0deg);
            }
            to {
              transform: rotate(360deg) translateX(150px) rotate(-360deg);
            }
          }
        }

        .orbit-item {
          animation: orbit 20s linear infinite;
          will-change: transform;
        }

        .animate-spin-slow {
          animation: spin 20s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .rotating-glow {
          position: absolute;
          width: 600px;
          height: 600px;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background: radial-gradient(
            circle at center,
            transparent 40%,
            rgba(255, 153, 21, 0.15) 50%,
            rgba(255, 153, 21, 0.08) 70%,
            transparent 100%
          );
          animation: rotateGlow 20s linear infinite;
          filter: blur(40px);
          pointer-events: none;
        }

        @keyframes rotateGlow {
          0% {
            transform: translate(-50%, -50%) rotate(0deg) scale(1);
            opacity: 0.6;
          }
          50% {
            transform: translate(-50%, -50%) rotate(180deg) scale(1.1);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) rotate(360deg) scale(1);
            opacity: 0.6;
          }
        }

        .animated-line {
          position: absolute;
          height: 2px;
          width: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            var(--color-primary-500) 50%,
            transparent 100%
          );
          animation: moveLine 8s linear infinite;
          opacity: 0.3;
        }

        .line-1 {
          top: 10%;
          animation-delay: 0s;
        }

        .line-2 {
          top: 30%;
          animation-delay: 1.5s;
        }

        .line-3 {
          top: 50%;
          animation-delay: 3s;
        }

        .line-4 {
          top: 70%;
          animation-delay: 4.5s;
        }

        .line-5 {
          top: 90%;
          animation-delay: 6s;
        }

        @keyframes moveLine {
          0% {
            transform: translateX(-100%) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.3;
          }
          90% {
            opacity: 0.3;
          }
          100% {
            transform: translateX(100%) rotate(0deg);
            opacity: 0;
          }
        }

        /* Diagonal variant */
        .line-2,
        .line-4 {
          transform: rotate(-2deg);
        }

        .line-3 {
          transform: rotate(2deg);
        }
      `}</style>
    </div>
  )
}