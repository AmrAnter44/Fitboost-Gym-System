// app/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
        // ✅ Redirect user based on role
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
                  src="/icon.svg"
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
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-2xl w-full max-w-sm">
        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border-r-4 border-red-500 text-red-700 dark:text-red-300 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
              Email or Username
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              placeholder="Enter your email or username"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 dark:bg-primary-700 text-white py-2.5 rounded-lg hover:bg-primary-700 dark:hover:bg-primary-800 disabled:bg-gray-400 disabled:dark:bg-gray-600 transition font-semibold text-sm"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        </div>
      </div>

      <style jsx>{`
        @keyframes logoSwitch {
          0%, 43% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
            filter: blur(0px) brightness(1);
          }
          47% {
            opacity: 0.5;
            transform: scale(1.15) rotate(5deg);
            filter: blur(4px) brightness(1.2);
          }
          50%, 93% {
            opacity: 0;
            transform: scale(0.8) rotate(10deg);
            filter: blur(8px) brightness(0.8);
          }
          97% {
            opacity: 0.5;
            transform: scale(1.15) rotate(-5deg);
            filter: blur(4px) brightness(1.2);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
            filter: blur(0px) brightness(1);
          }
        }

        @keyframes logoSwitchAlt {
          0% {
            opacity: 0;
            transform: scale(0.8) rotate(0deg);
            filter: blur(0px) brightness(1);
          }
          3% {
            opacity: 0.5;
            transform: scale(1.15) rotate(5deg);
            filter: blur(4px) brightness(1.2);
          }
          7%, 47% {
            opacity: 0;
            transform: scale(0.8) rotate(0deg);
            filter: blur(0px) brightness(1);
          }
          50% {
            opacity: 0;
            transform: scale(0.8) rotate(-10deg);
            filter: blur(8px) brightness(0.8);
          }
          53% {
            opacity: 0.5;
            transform: scale(1.15) rotate(-5deg);
            filter: blur(4px) brightness(1.2);
          }
          57%, 93% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
            filter: blur(0px) brightness(1);
          }
          97% {
            opacity: 0.5;
            transform: scale(1.15) rotate(5deg);
            filter: blur(4px) brightness(1.2);
          }
          100% {
            opacity: 0;
            transform: scale(0.8) rotate(-10deg);
            filter: blur(8px) brightness(0.8);
          }
        }

        .logo-switch {
          animation: logoSwitch 8s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
          opacity: 1;
        }

        .logo-switch-alt {
          animation: logoSwitchAlt 8s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
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