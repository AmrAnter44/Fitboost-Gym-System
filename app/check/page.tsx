'use client'

import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function CheckMembershipPage() {
  const { t } = useLanguage()
  const [memberNumber, setMemberNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // ✅ تم إزالة منطق الخروج التلقائي - نسجل وقت الدخول فقط
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const playSuccessSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      const times = [0, 0.15, 0.3]
      const frequencies = [523.25, 659.25, 783.99]

      times.forEach((time, index) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequencies[index], ctx.currentTime + time)
        gainNode.gain.setValueAtTime(0.8, ctx.currentTime + time)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.3)
        oscillator.start(ctx.currentTime + time)
        oscillator.stop(ctx.currentTime + time + 0.3)
      })
    } catch (error) {
      console.error('Error playing sound:', error)
    }
  }

  const playAlarmSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      const alarmPattern = [
        { freq: 2000, time: 0 },
        { freq: 600, time: 0.15 },
        { freq: 2000, time: 0.3 },
      ]

      alarmPattern.forEach(({ freq, time }) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.type = 'square'
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime + time)
        gainNode.gain.setValueAtTime(0.9, ctx.currentTime + time)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.15)
        oscillator.start(ctx.currentTime + time)
        oscillator.stop(ctx.currentTime + time + 0.15)
      })
    } catch (error) {
      console.error('Error playing sound:', error)
    }
  }

  const playWarningSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      const times = [0, 0.2]
      const frequencies = [440, 370]

      times.forEach((time, index) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.type = 'triangle'
        oscillator.frequency.setValueAtTime(frequencies[index], ctx.currentTime + time)
        gainNode.gain.setValueAtTime(0.7, ctx.currentTime + time)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.25)
        oscillator.start(ctx.currentTime + time)
        oscillator.stop(ctx.currentTime + time + 0.25)
      })
    } catch (error) {
      console.error('Error playing sound:', error)
    }
  }

  const playBannedHornSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      // زمارة طويلة مزعجة تخينة - صوت منخفض ثقيل (7 ثواني)
      const hornPattern = [
        { freq: 90, time: 0,    dur: 0.7 },
        { freq: 65, time: 0.8,  dur: 0.7 },
        { freq: 90, time: 1.6,  dur: 0.7 },
        { freq: 65, time: 2.4,  dur: 0.7 },
        { freq: 90, time: 3.2,  dur: 0.7 },
        { freq: 65, time: 4.0,  dur: 0.7 },
        { freq: 90, time: 4.8,  dur: 0.7 },
        { freq: 50, time: 5.6,  dur: 1.2 },  // نهاية طويلة تخينة جداً
      ]
      hornPattern.forEach(({ freq, time, dur }) => {
        // أول oscillator - sawtooth
        const osc1 = ctx.createOscillator()
        const gain1 = ctx.createGain()
        osc1.connect(gain1)
        gain1.connect(ctx.destination)
        osc1.type = 'sawtooth'
        osc1.frequency.setValueAtTime(freq, ctx.currentTime + time)
        gain1.gain.setValueAtTime(1.0, ctx.currentTime + time)
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + dur)
        osc1.start(ctx.currentTime + time)
        osc1.stop(ctx.currentTime + time + dur)

        // تاني oscillator - square لصوت أتخن
        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.connect(gain2)
        gain2.connect(ctx.destination)
        osc2.type = 'square'
        osc2.frequency.setValueAtTime(freq * 0.5, ctx.currentTime + time) // octave lower
        gain2.gain.setValueAtTime(0.5, ctx.currentTime + time)
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + dur)
        osc2.start(ctx.currentTime + time)
        osc2.stop(ctx.currentTime + time + dur)
      })
    } catch (error) {
      console.error('Error playing banned horn sound:', error)
    }
  }

  const handleCheck = async () => {
    if (!memberNumber.trim()) {
      playAlarmSound()
      setError(`⚠️ ${t('attendance.enterMembershipNumber')}`)
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch(`/api/check/${memberNumber.trim()}`)
      const data = await response.json()

      if (response.ok) {
        setResult(data)

        // تشغيل الصوت المناسب
        if (data.status === 'banned') {
          playBannedHornSound()
        } else if (data.status === 'active') {
          playSuccessSound()
        } else if (data.status === 'warning') {
          playWarningSound()
        } else {
          playAlarmSound()
        }
      } else {
        playAlarmSound()
        setError(data.error || t('attendance.error'))
      }
    } catch (error) {
      console.error('Check error:', error)
      playAlarmSound()
      setError(t('attendance.connectionError'))
    } finally {
      setLoading(false)
      setMemberNumber('')
      setTimeout(() => inputRef.current?.focus(), 500)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCheck()
    }
  }

  const calculateRemainingDays = (expiryDate: string): number => {
    const expiry = new Date(expiryDate)
    const today = new Date()
    const diffTime = expiry.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src='/assets/icon.png' alt="logo" className='w-12 h-12 sm:w-16 sm:h-16'/>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary-600">Gym System</h1>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            🔍 {t('attendance.verifyMembership')}
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
            {t('attendance.enterNumberToVerify')}
          </p>
        </div>

        {/* Search Box */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8 border-4 border-primary-500 mb-6">
          <div className="mb-6">
            <label className="block text-lg sm:text-xl font-bold mb-4 text-gray-800 dark:text-gray-100 text-center">
              {t('attendance.membershipNumber')}
            </label>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border-2 border-red-500 rounded-xl animate-shake dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <p className="text-red-700 font-bold text-center">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={memberNumber}
                onChange={(e) => setMemberNumber(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 px-4 py-3 sm:px-6 sm:py-4 border-4 border-primary-300 rounded-xl text-2xl sm:text-3xl md:text-4xl font-bold text-center focus:border-primary-600 focus:ring-4 focus:ring-primary-200 transition text-gray-800 dark:text-gray-100"
                placeholder="1001"
                disabled={loading}
              />
              <button
                onClick={handleCheck}
                disabled={loading || !memberNumber.trim()}
                className="px-6 py-3 sm:px-8 sm:py-4 bg-primary-600 text-white text-xl sm:text-2xl font-bold rounded-xl hover:bg-primary-700 disabled:bg-gray-400 transition shadow-lg"
              >
                {loading ? '⏳' : '🔍'}
              </button>
            </div>

            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-3 text-center">
              💡 {t('attendance.pressEnterToSearch')}
            </p>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className={`rounded-2xl shadow-2xl p-6 sm:p-8 border-4 animate-slideIn ${
            result.status === 'banned'
              ? 'border-red-900 banned-pulse'
              : result.status === 'active'
              ? 'bg-white border-green-500'
              : result.status === 'warning'
              ? 'bg-white border-yellow-500'
              : 'bg-white border-red-500'
          }`}>
            {/* شاشة الحظر */}
            {result.status === 'banned' ? (
              <div className="text-center text-white">
                <div className="text-7xl sm:text-8xl md:text-9xl mb-4 animate-bounce">🚫</div>
                <h3 className="text-3xl sm:text-4xl md:text-5xl font-black mb-3">{result.name}</h3>
                <p className="text-lg sm:text-xl mb-4 opacity-90">
                  {t('attendance.membershipNumber')}: <span className="font-bold">#{result.memberNumber}</span>
                </p>
                <div className="bg-red-900 rounded-xl px-6 py-4 mb-4 border-2 border-red-400">
                  <p className="text-2xl sm:text-3xl font-black">{result.message}</p>
                </div>
                {result.banReason && (
                  <div className="bg-red-800/80 rounded-xl px-5 py-3 mb-3">
                    <p className="text-base sm:text-lg">
                      <span className="font-bold">السبب: </span>{result.banReason}
                    </p>
                  </div>
                )}
                {result.bannedBy && (
                  <p className="text-sm opacity-70">بواسطة: {result.bannedBy}</p>
                )}
                <button
                  onClick={() => { setResult(null); setError(''); setMemberNumber(''); inputRef.current?.focus() }}
                  className="mt-6 px-6 py-3 bg-white text-red-700 rounded-xl font-black text-lg hover:bg-red-50 transition"
                >
                  {t('attendance.searchAnother')}
                </button>
              </div>
            ) : (
              <>
            <div className="text-center mb-6">
              <div className="text-6xl sm:text-7xl md:text-8xl mb-4">
                {result.status === 'active' ? '✅' : result.status === 'warning' ? '⚠️' : '🚨'}
              </div>

              <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 text-gray-800 dark:text-gray-100">
                {result.name}
              </h3>

              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-4">
                {t('attendance.membershipNumber')}: <span className="font-bold text-primary-600">#{result.memberNumber}</span>
              </p>

              <div className={`inline-block px-6 py-3 rounded-xl text-xl sm:text-2xl font-bold ${
                result.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : result.status === 'warning'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {result.message}
              </div>
            </div>

            {result.expiryDate && (
              <div className={`rounded-xl p-6 ${
                result.status === 'active'
                  ? 'bg-green-50 border-2 border-green-300'
                  : result.status === 'warning'
                  ? 'bg-yellow-50 border-2 border-yellow-300'
                  : 'bg-red-50 border-2 border-red-300'
              }`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">{t('attendance.expiryDate')}</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
                      {new Date(result.expiryDate).toLocaleDateString('ar-EG')}
                    </p>
                  </div>

                  {result.remainingDays !== undefined && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">{t('attendance.daysRemaining')}</p>
                      <p className={`text-xl sm:text-2xl font-bold ${
                        result.remainingDays > 7
                          ? 'text-green-600'
                          : result.remainingDays > 0
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}>
                        {result.remainingDays > 0
                          ? t('attendance.daysCount', { days: result.remainingDays.toString() })
                          : result.remainingDays === 0
                          ? t('attendance.expiresToday')
                          : t('attendance.expiredSince', { days: Math.abs(result.remainingDays).toString() })
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setResult(null)
                  setError('')
                  setMemberNumber('')
                  inputRef.current?.focus()
                }}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 font-bold transition"
              >
                {t('attendance.searchAnother')}
              </button>
            </div>
            </>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-gray-600 dark:text-gray-300 text-sm">
          <p>🔒 {t('attendance.securePageVerifyOnly')}</p>
          <p className="mt-2">{t('attendance.contactManagement')}</p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }

        .animate-slideIn {
          animation: slideIn 0.4s ease-out;
        }

        .animate-shake {
          animation: shake 0.4s ease-out;
        }

        @keyframes bannedPulse {
          0%, 100% { background-color: #b91c1c; box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7); }
          50% { background-color: #7f1d1d; box-shadow: 0 0 0 20px rgba(220, 38, 38, 0); }
        }

        .banned-pulse {
          animation: bannedPulse 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
