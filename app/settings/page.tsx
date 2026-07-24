'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '../../contexts/LanguageContext'
import { useDarkMode } from '../../contexts/DarkModeContext'
import { useServiceSettings } from '../../contexts/ServiceSettingsContext'
import { useToast } from '../../contexts/ToastContext'
import { LoadingScreen } from '../../components/Spinner'
import ConfirmDialog from '../../components/ConfirmDialog'
import CloudBackupCard from '../../components/settings/CloudBackupCard'
import ImageUpload from '../../components/ImageUpload'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

//  أيقونات إظهار/إخفاء كلمة السر
const EYE = (<svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>)
const EYE_OFF = (<svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>)

const NAV_ICON_PATHS: Record<string, JSX.Element> = {
  'profile': (<path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />),
  'quick-links': (<path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />),
  'services': (<path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3 2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75 2.25-1.313M12 21.75V19.5m0 2.25-2.25-1.313m0-16.875L12 2.25l2.25 1.313" />),
  'points': (<path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />),
  'referral': (<path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21" />),
  'free-sessions': (<path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />),
  'receipts': (<path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h4m6-4V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3-2 3 2 3-2 3 2v-4" />),
  'port-forwarding': (<path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />),
  'whatsapp': (<path strokeLinecap="round" strokeLinejoin="round" d="M3 20l1.5-4.5A8 8 0 1112 20H7l-4 0z" />),
  'display': (<path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />),
  'license': (<path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />),
  'database': (<path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />),
  'apply-features': (<path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />),
  'tunnel': (<path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" />),
  'updates': (<path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />),
  'support': (<path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />)
}

// ==================== System Update Section ====================
function SystemUpdateSection() {
  const { t } = useLanguage()
  const [currentVersion, setCurrentVersion] = useState('...')
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'>('idle')
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [isElectronApp, setIsElectronApp] = useState(false)

  useEffect(() => {
    const electron = (window as any).electron
    if (electron?.isElectron) {
      setIsElectronApp(true)

      if (electron.getAppVersion) {
        electron.getAppVersion().then((v: string) => setCurrentVersion(v)).catch(() => setCurrentVersion('unknown'))
      }

      electron.onUpdateAvailable?.((info: any) => {
        setUpdateInfo(info)
        setUpdateStatus('available')
      })

      electron.onUpdateNotAvailable?.(() => {
        setUpdateStatus('up-to-date')
      })

      electron.onDownloadProgress?.((progress: any) => {
        setDownloadProgress(Math.round(progress.percent))
        setUpdateStatus('downloading')
      })

      electron.onUpdateDownloaded?.((info: any) => {
        setUpdateInfo(info)
        setUpdateStatus('downloaded')
      })

      electron.onUpdateError?.((err: any) => {
        setErrorMessage(err.message || t('settingsPage.updates.checkFailed'))
        setUpdateStatus('error')
      })

      return () => {
        electron.offUpdateListeners?.()
      }
    } else {
      setCurrentVersion(process.env.NEXT_PUBLIC_APP_VERSION || 'unknown')
    }
  }, [])

  const handleCheckForUpdates = async () => {
    const electron = (window as any).electron
    if (!electron?.isElectron) return
    setUpdateStatus('checking')
    setErrorMessage('')
    try {
      const result = await electron.checkForUpdates?.()
      if (result?.error) {
        setErrorMessage(result.error)
        setUpdateStatus('error')
      }
    } catch (err: any) {
      setErrorMessage(err.message || t('settingsPage.updates.checkFailed'))
      setUpdateStatus('error')
    }
  }

  const handleDownload = async () => {
    const electron = (window as any).electron
    if (!electron?.isElectron) return
    setUpdateStatus('downloading')
    setDownloadProgress(0)
    try {
      const result = await electron.downloadUpdate?.()
      if (result?.error) {
        setErrorMessage(result.error)
        setUpdateStatus('error')
      }
    } catch (err: any) {
      setErrorMessage(err.message || t('settingsPage.updates.downloadFailed'))
      setUpdateStatus('error')
    }
  }

  const handleInstall = async () => {
    const electron = (window as any).electron
    if (!electron?.isElectron) return
    try {
      await electron.installUpdate?.()
    } catch (err: any) {
      setErrorMessage(err.message || t('settingsPage.updates.installFailed'))
      setUpdateStatus('error')
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 space-y-4">
      {/* Current Version */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
            <svg {...stroke} className="w-5 h-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('settingsPage.updates.currentVersion')}</p>
            <p className="mt-0.5 text-xl font-bold text-gray-900 dark:text-gray-100 font-mono">v{currentVersion}</p>
          </div>
        </div>

        {updateStatus === 'up-to-date' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-full text-xs font-bold">
            <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            {t('settingsPage.updates.upToDate')}
          </span>
        )}
        {updateStatus === 'available' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold">
            <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            {t('settingsPage.updates.updateAvailable')}
          </span>
        )}
        {updateStatus === 'downloaded' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full text-xs font-bold">
            <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            {t('settingsPage.updates.readyToInstall')}
          </span>
        )}
      </div>

      {/* Error */}
      {updateStatus === 'error' && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 rounded-lg text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
          <svg {...stroke} className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Update Available Info */}
      {updateStatus === 'available' && updateInfo && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-900/50 rounded-lg space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center flex-shrink-0">
              <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5 14.25 3l-1.5 7.5h6l-10.5 10.5 1.5-7.5h-6Z" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.updates.newUpdateAvailable')}</p>
              {updateInfo.version && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('settingsPage.updates.version')}: <span className="font-mono font-bold">v{updateInfo.version}</span></p>
              )}
            </div>
          </div>
          {updateInfo.releaseNotes && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 max-h-24 overflow-y-auto text-xs text-gray-600 dark:text-gray-400 ring-1 ring-blue-100 dark:ring-gray-700">
              {updateInfo.releaseNotes.split('\n').slice(0, 5).map((line: string, i: number) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}
          <button
            onClick={handleDownload}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            <svg {...stroke} className="w-5 h-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {t('settingsPage.updates.downloadUpdate')}
          </button>
        </div>
      )}

      {/* Download Progress */}
      {updateStatus === 'downloading' && (
        <div className="p-4 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-900/50 rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <svg {...stroke} className="w-5 h-5 animate-spin text-primary-700 dark:text-primary-400" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.updates.downloading')}</p>
          </div>
          <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-primary-500 h-full transition-[width] duration-300 rounded-full"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
          <p className="text-center text-sm font-bold text-gray-600 dark:text-gray-400">{downloadProgress}%</p>
        </div>
      )}

      {/* Downloaded - Ready to Install */}
      {updateStatus === 'downloaded' && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 rounded-lg space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 flex items-center justify-center flex-shrink-0">
              <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.updates.downloadComplete')}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('settingsPage.updates.downloadCompleteDesc')}</p>
            </div>
          </div>
          <button
            onClick={handleInstall}
            className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            <svg {...stroke} className="w-5 h-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t('settingsPage.updates.restartAndInstall')}
          </button>
        </div>
      )}

      {/* Checking Spinner */}
      {updateStatus === 'checking' && (
        <div className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-lg flex items-center justify-center gap-2">
          <svg {...stroke} className="w-5 h-5 animate-spin" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {t('settingsPage.updates.checking')}
        </div>
      )}

      {/* Check Button */}
      {isElectronApp ? (
        (updateStatus === 'idle' || updateStatus === 'up-to-date' || updateStatus === 'error') && (
          <button
            onClick={handleCheckForUpdates}
            className="w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-800 text-white font-bold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            <svg {...stroke} className="w-5 h-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            {t('settingsPage.updates.checkForUpdates')}
          </button>
        )
      ) : (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 rounded-lg text-amber-700 dark:text-amber-300 text-sm flex items-start gap-2">
          <svg {...stroke} className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <span>{t('settingsPage.updates.electronOnly')}</span>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const { locale, setLanguage, t, direction } = useLanguage()
  const { isDarkMode, toggleDarkMode } = useDarkMode()
  const { refetch: refetchServiceSettings } = useServiceSettings()
  const toast = useToast()
  const [confirmState, setConfirmState] = useState<{ open: boolean; message: string; title?: string; type?: 'danger' | 'warning' | 'info'; onConfirm: () => void }>({ open: false, message: '', onConfirm: () => {} })
  const [user, setUser] = useState<any>(null)

  //  تاب البروفايل (لكل موظف) — صورة + تغيير كلمة السر
  const [profileImg, setProfileImg] = useState<string | null>(null)
  const [savingPhoto, setSavingPhoto] = useState(false)
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [showPw, setShowPw] = useState({ old: false, new: false, confirm: false })

  //  بنقرأ الـ section من الـ URL hash (مثل /settings#quick-links)
  // عشان لما اليوزر يرجع من /admin/users يلاقي نفس الـ section مفتوحة
  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const fromHash = window.location.hash.replace('#', '')
      if (fromHash) return fromHash
    }
    return 'display'
  })
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isAwardingBirthday, setIsAwardingBirthday] = useState(false)
  const [birthdayResult, setBirthdayResult] = useState<any>(null)
  const [gymName, setGymName] = useState('')
  const [gymLogo, setGymLogo] = useState<string | null>(null)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [primaryColor, setPrimaryColor] = useState<string | null>(null)
  const [customColorInput, setCustomColorInput] = useState('')
  const [isSavingColor, setIsSavingColor] = useState(false)
  const [primaryTextOverride, setPrimaryTextOverrideState] = useState<'auto' | 'white' | 'black'>('auto')

  const [serviceSettings, setServiceSettings] = useState({
    nutritionEnabled: true,
    physiotherapyEnabled: true,
    groupClassEnabled: true,
    spaEnabled: true,
    inBodyEnabled: true,
    poolEnabled: true,
    padelEnabled: true,
    assessmentEnabled: true,
    lostFoundEnabled: true,
    gymName: '',
    websiteUrl: 'https://www.xgym.website',
    showWebsiteOnReceipts: true,
    receiptTerms: '',
    pointsEnabled: false,
    pointsPerCheckIn: 0,
    pointsPerInvitation: 0,
    pointsPerReferral: 0,
    pointsPerEGPSpent: 0,
    pointsPerBirthday: 10,
    pointsValueInEGP: 0,
    nutritionReferralEnabled: false,
    nutritionReferralPercentage: 0,
    physioReferralEnabled: false,
    physioReferralPercentage: 0,
    trackFreeSessionsCost: false,
    freePTSessionPrice: 0,
    freeNutritionSessionPrice: 0,
    freePhysioSessionPrice: 0,
    freeGroupClassSessionPrice: 0,
    remainingEnabled: false,
    ptFreezeEnabled: false,
    ptUpgradeEnabled: false,
    payrollLateGraceMinutes: 5,
    payrollWorkingDaysPerMonth: 26,
    payrollMonthEndDay: 28,
    payrollSuggestedLatePerMinute: 2,
    requireSelfieOnCheckIn: false, //  Anti buddy-punching
  })

  const [nextReceiptNumber, setNextReceiptNumber] = useState(1)
  const [nextMemberNumber, setNextMemberNumber] = useState(1)
  const [editingReceiptNumber, setEditingReceiptNumber] = useState(false)
  const [editingMemberNumber, setEditingMemberNumber] = useState(false)
  const [tempReceiptNumber, setTempReceiptNumber] = useState(1)
  const [tempMemberNumber, setTempMemberNumber] = useState(1)
  const [savingReceiptNumber, setSavingReceiptNumber] = useState(false)
  const [savingMemberNumber, setSavingMemberNumber] = useState(false)

  // Database states
  const [dbUploading, setDbUploading] = useState(false)
  const [dbUploadResult, setDbUploadResult] = useState<{ success?: string; error?: string } | null>(null)

  // Database Sync state (all-in-one)
  const [syncingDatabase, setSyncingDatabase] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string; steps?: any[] } | null>(null)

  // Database Optimize (VACUUM) state
  const [optimizingDb, setOptimizingDb] = useState(false)
  const [optimizeMessage, setOptimizeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [dbFiles, setDbFiles] = useState<Array<{ name: string; sizeMB: number; sizeBytes: number; isLive: boolean; modified: string }>>([])
  const [dbFilesTotalMB, setDbFilesTotalMB] = useState<number>(0)
  const [loadingDbFiles, setLoadingDbFiles] = useState(false)

  // 🗜️ Base64 Image Migration state
  const [cleanupInfo, setCleanupInfo] = useState<{ candidates: number; currentDbSizeMb: number; estimatedBase64Mb: number } | null>(null)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupRunning, setCleanupRunning] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<{ migrated: number; failed: number; before: { mb: number }; after: { mb: number }; saved: { mb: number; percent: number }; failures: Array<{ id: string; name: string; reason: string }>; backup?: { filename: string }; vacuumError?: string | null } | null>(null)

  // Save notification state
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 📦 Apply Package Features state
  const [applyingFeatures, setApplyingFeatures] = useState(false)
  const [applyFeaturesResult, setApplyFeaturesResult] = useState<{
    processed: number
    updated: number
    skipped: number
    noDurationMatch: number
    results: Array<{ memberId: string; memberNumber: string | null; name: string; status: 'updated' | 'skipped' | 'no-duration-match'; reason?: string }>
  } | null>(null)
  const [applyFeaturesError, setApplyFeaturesError] = useState<string | null>(null)
  const [applyFeaturesConfirm, setApplyFeaturesConfirm] = useState<'fresh' | 'force' | null>(null)

  // Port Forwarding states
  const [localIP, setLocalIP] = useState<string>('')
  const [localURL, setLocalURL] = useState<string>('')
  const [isLoadingIP, setIsLoadingIP] = useState(false)

  // License states
  const [gyms, setGyms] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [selectedGymId, setSelectedGymId] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [currentLicense, setCurrentLicense] = useState<any>(null)
  const [loadingGyms, setLoadingGyms] = useState(false)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [savingLicense, setSavingLicense] = useState(false)

  // Offline Mode states
  const [offlineStatus, setOfflineStatus] = useState<{
    offlineModeEnabled: boolean
    stats: {
      pending: number
      failed: number
      sent: number
      lastSentAt: string | null
      lastError?: string | null
      lastErrorResource?: string | null
      lastErrorAttempts?: number
    }
  } | null>(null)
  const [offlineToggling, setOfflineToggling] = useState(false)
  const [flushingSync, setFlushingSync] = useState(false)

  useEffect(() => {
    checkAuth()
    fetchServiceSettings()
    fetchNumbers()
    fetchLocalIP()
  }, [])

  // Fetch license data when user is loaded and is OWNER
  useEffect(() => {
    if (user?.role === 'OWNER') {
      fetchCurrentLicense()
      fetchGyms()
      fetchOfflineStatus()
    }
  }, [user])

  //  بنحدّث الـ URL hash كل ما الـ section يتغير
  // عشان لو اليوزر دخل صفحة تانية ورجع، الـ browser يرجع لنفس الـ section
  // (مثلاً: /settings#quick-links → /admin/users → back → /settings#quick-links)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const newHash = `#${activeSection}`
    if (window.location.hash !== newHash) {
      //  بنستخدم replaceState عشان مايضيفش history entry جديد كل scroll
      window.history.replaceState(null, '', newHash)
    }
  }, [activeSection])

  // Refresh offline sync stats every 30s while on the license tab
  useEffect(() => {
    if (user?.role !== 'OWNER' || activeSection !== 'license') return
    const interval = setInterval(fetchOfflineStatus, 30_000)
    return () => clearInterval(interval)
  }, [user, activeSection])

  // Fetch DB files list when database section is opened
  useEffect(() => {
    if (activeSection === 'database' && user?.role === 'OWNER') {
      fetchDbFiles()
      fetchCleanupInfo()
    }
  }, [activeSection, user])

  // Load primary-text override from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('primaryTextOverride')
    if (saved === 'white' || saved === 'black' || saved === 'auto') {
      setPrimaryTextOverrideState(saved)
    }
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        // السماح لجميع المستخدمين بالوصول لصفحة الإعدادات
        // (navigationItems تتحكم في الأقسام المتاحة لكل مستخدم)
        setUser(data.user)
        setProfileImg(data.user?.profileImage ?? null)
      } else {
        router.push('/login')
      }
    } catch (error) {
      router.push('/login')
    }
  }

  const fetchServiceSettings = async () => {
    try {
      const response = await fetch('/api/settings/services')
      if (response.ok) {
        const data = await response.json()
        setServiceSettings(data)
        if (data.gymName) setGymName(data.gymName)
        if (data.gymLogo) setGymLogo(data.gymLogo)
        if (data.primaryColor) setPrimaryColor(data.primaryColor)
        if (data.primaryTextColor === 'white' || data.primaryTextColor === 'black' || data.primaryTextColor === 'auto') {
          setPrimaryTextOverrideState(data.primaryTextColor)
        }
      }
    } catch (error) {
      console.error('Error fetching service settings:', error)
    }
  }

  const fetchNumbers = async () => {
    try {
      const receiptResponse = await fetch('/api/receipts/next-number')
      if (receiptResponse.ok) {
        const receiptData = await receiptResponse.json()
        setNextReceiptNumber(receiptData.nextNumber)
      }
      const memberResponse = await fetch('/api/members/next-number')
      if (memberResponse.ok) {
        const memberData = await memberResponse.json()
        setNextMemberNumber(memberData.nextNumber)
      }
    } catch (error) {
      console.error('Error fetching numbers:', error)
    }
  }

  const saveReceiptNumber = async () => {
    if (tempReceiptNumber < 1) return
    setSavingReceiptNumber(true)
    try {
      const res = await fetch('/api/receipts/next-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startNumber: tempReceiptNumber })
      })
      if (res.ok) {
        setNextReceiptNumber(tempReceiptNumber)
        setEditingReceiptNumber(false)
        setSaveMessage({ type: 'success', text: 'تم تحديث رقم الإيصال القادم' })
      } else {
        const data = await res.json()
        setSaveMessage({ type: 'error', text: data.error || 'فشل تحديث الرقم' })
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'حدث خطأ' })
    } finally {
      setSavingReceiptNumber(false)
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }

  const saveMemberNumber = async () => {
    if (tempMemberNumber < 1) return
    setSavingMemberNumber(true)
    try {
      const res = await fetch('/api/members/next-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startNumber: tempMemberNumber })
      })
      if (res.ok) {
        setNextMemberNumber(tempMemberNumber)
        setEditingMemberNumber(false)
        setSaveMessage({ type: 'success', text: 'تم تحديث رقم العضوية القادم' })
      } else {
        const data = await res.json()
        setSaveMessage({ type: 'error', text: data.error || 'فشل تحديث الرقم' })
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'حدث خطأ' })
    } finally {
      setSavingMemberNumber(false)
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }

  const saveServiceSettings = async () => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      // Exclude gymLogo and primaryColor — they are managed by their own dedicated APIs
      // Including them here could accidentally overwrite them to null
      const { gymLogo: _gl, primaryColor: _pc, id: _id, createdAt: _ca, updatedAt: _ua, updatedBy: _ub, ...settingsToSave } = serviceSettings as any
      const response = await fetch('/api/settings/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsToSave)
      })
      if (response.ok) {
        localStorage.removeItem('serviceSettingsCache')
        refetchServiceSettings()
        setSaveMessage({
          type: 'success',
          text: t('settingsPage.saveSuccess')
        })
        setTimeout(() => setSaveMessage(null), 5000)
      } else {
        setSaveMessage({
          type: 'error',
          text: t('settingsPage.saveError')
        })
      }
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: t('settingsPage.saveNetworkError')
      })
    } finally {
      setIsSaving(false)
    }
  }

  const awardBirthdayPoints = async () => {
    setConfirmState({
      open: true,
      message: t('settingsPage.points.confirmAward'),
      title: t('common.confirm'),
      type: 'warning',
      onConfirm: async () => {
        setIsAwardingBirthday(true)
        setBirthdayResult(null)
        try {
          const response = await fetch('/api/birthday-points', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer birthday-points-secret-2024'
            }
          })
          const data = await response.json()

          if (response.ok && data.success) {
            setBirthdayResult({
              type: 'success',
              message: data.message,
              count: data.count,
              members: data.members
            })
            setTimeout(() => setBirthdayResult(null), 10000)
          } else {
            setBirthdayResult({
              type: 'error',
              message: data.message || t('settingsPage.points.failedToAward')
            })
          }
        } catch (error) {
          setBirthdayResult({
            type: 'error',
            message: t('settingsPage.networkError')
          })
        } finally {
          setIsAwardingBirthday(false)
        }
      },
    })
  }

  const toggleService = (serviceName: string) => {
    setServiceSettings(prev => ({
      ...prev,
      [`${serviceName}Enabled`]: !prev[`${serviceName}Enabled` as keyof typeof prev]
    }))
  }

  const updateSetting = (key: string, value: any) => {
    setServiceSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleLanguageChange = (newLocale: string) => {
    setLanguage(newLocale as 'ar' | 'en')
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)
      const res = await fetch('/api/settings/gym-logo', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok && data.logoUrl) {
        setGymLogo(data.logoUrl)
        localStorage.setItem('gymLogo', data.logoUrl)
        localStorage.removeItem('serviceSettingsCache')
        refetchServiceSettings()
      } else {
        toast.error(data.error || t('settingsPage.display.logoUploadFailed'))
      }
    } catch {
      toast.error(t('settingsPage.display.logoUploadFailed'))
    } finally {
      setIsUploadingLogo(false)
      e.target.value = ''
    }
  }

  const handleLogoRemove = async () => {
    setConfirmState({
      open: true,
      message: t('settingsPage.display.confirmRemoveLogo'),
      title: t('settingsPage.display.removeLogo'),
      type: 'danger',
      onConfirm: async () => {
        setIsUploadingLogo(true)
        try {
          const res = await fetch('/api/settings/gym-logo', { method: 'DELETE' })
          if (res.ok) {
            setGymLogo(null)
            localStorage.removeItem('gymLogo')
            localStorage.removeItem('serviceSettingsCache')
            refetchServiceSettings()
          }
        } catch {
          toast.error(t('settingsPage.display.logoRemoveFailed'))
        } finally {
          setIsUploadingLogo(false)
        }
      },
    })
  }

  const handleColorChange = async (color: string | null) => {
    setIsSavingColor(true)
    try {
      // Preview مباشر
      if (color) {
        const { applyPaletteToDOM } = await import('../../lib/theme/generatePalette')
        applyPaletteToDOM(color)
      } else {
        // Reset to defaults
        const root = document.documentElement
        const shades = ['50','100','200','300','400','500','600','700','800','900','950']
        shades.forEach(s => {
          root.style.removeProperty(`--color-primary-${s}`)
          root.style.removeProperty(`--color-primary-${s}-rgb`)
        })
      }

      const res = await fetch('/api/settings/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryColor: color })
      })
      if (res.ok) {
        setPrimaryColor(color)
        localStorage.removeItem('serviceSettingsCache')
        if (color) {
          localStorage.setItem('primaryColor', color)
        } else {
          localStorage.removeItem('primaryColor')
        }
        refetchServiceSettings()
      }
    } catch {
      toast.error(t('settingsPage.display.colorSaveFailed'))
    } finally {
      setIsSavingColor(false)
    }
  }

  // Update primary-text contrast override (auto / white / black)
  // عام لكل السيستم: بيتحفظ سيرفر-سايد (زي primaryColor) + localStorage للـ blocking script
  const handlePrimaryTextOverride = async (value: 'auto' | 'white' | 'black') => {
    setIsSavingColor(true)
    const prev = primaryTextOverride
    setPrimaryTextOverrideState(value)
    try {
      // Preview مباشر
      const { applyPrimaryTextOverride } = await import('../../lib/theme/generatePalette')
      const baseHex = primaryColor || '#fbe003'
      applyPrimaryTextOverride(baseHex, value)

      const res = await fetch('/api/settings/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryTextColor: value })
      })
      if (res.ok) {
        if (value === 'auto') {
          localStorage.removeItem('primaryTextOverride')
        } else {
          localStorage.setItem('primaryTextOverride', value)
        }
        localStorage.removeItem('serviceSettingsCache')
        refetchServiceSettings()
      } else {
        setPrimaryTextOverrideState(prev)
        applyPrimaryTextOverride(baseHex, prev)
        toast.error(t('settingsPage.display.colorSaveFailed'))
      }
    } catch (err) {
      console.error('Failed to apply primary text override:', err)
      setPrimaryTextOverrideState(prev)
    } finally {
      setIsSavingColor(false)
    }
  }

  const handleDbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setDbUploading(true)
    setDbUploadResult(null)
    try {
      const formData = new FormData()
      formData.append('database', file)
      const res = await fetch('/api/settings/restore-db', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok && data.success) {
        setDbUploadResult({ success: data.message })
      } else {
        setDbUploadResult({ error: data.error || t('settingsPage.unexpectedError') })
      }
    } catch (err: any) {
      setDbUploadResult({ error: err.message })
    } finally {
      setDbUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleSyncDatabase = async () => {
    setConfirmState({
      open: true,
      message: 'هل تريد تحديث قاعدة البيانات؟\n\nسيتم:\n• إصلاح الصلاحيات\n• مزامنة Schema\n• تطبيق Migrations\n• تحديث Prisma Client',
      title: 'تحديث قاعدة البيانات',
      type: 'warning',
      onConfirm: async () => {
        setSyncingDatabase(true)
        setSyncMessage(null)

        try {
          const response = await fetch('/api/database/sync', {
            method: 'POST',
          })

          const data = await response.json()

          if (data.success) {
            const stepsText = data.steps
              ? '\n\n' + data.steps.map((s: any) => `${s.status === 'success' ? '[OK]' : s.status === 'error' ? '[X]' : '[-]'} ${s.message}`).join('\n')
              : ''

            setSyncMessage({
              type: 'success',
              text: `${data.message}${stepsText}`,
              steps: data.steps
            })
            setTimeout(() => setSyncMessage(null), 20000)
          } else {
            const stepsText = data.steps
              ? '\n\n' + data.steps.map((s: any) => `${s.status === 'success' ? '[OK]' : s.status === 'error' ? '[X]' : '[-]'} ${s.message}`).join('\n')
              : ''

            setSyncMessage({
              type: 'error',
              text: `${data.error || 'فشل التحديث'}${stepsText}`,
              steps: data.steps
            })
          }
        } catch (error) {
          setSyncMessage({
            type: 'error',
            text: 'حدث خطأ أثناء تحديث قاعدة البيانات'
          })
        } finally {
          setSyncingDatabase(false)
        }
      },
    })
  }

  // 📦 تطبيق مميزات الباقة على الأعضاء (الحصص + الفريز + الدعوات)
  const handleApplyPackageFeatures = async (mode: 'fresh' | 'force') => {
    setApplyFeaturesConfirm(null)
    setApplyingFeatures(true)
    setApplyFeaturesError(null)
    setApplyFeaturesResult(null)
    try {
      const res = await fetch('/api/admin/apply-package-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setApplyFeaturesError(data.error || 'فشل تطبيق المميزات')
      } else {
        setApplyFeaturesResult({
          processed: data.processed,
          updated: data.updated,
          skipped: data.skipped,
          noDurationMatch: data.noDurationMatch,
          results: data.results || [],
        })
      }
    } catch (err: any) {
      setApplyFeaturesError(err?.message || 'خطأ في الاتصال بالسيرفر')
    } finally {
      setApplyingFeatures(false)
    }
  }

  const fetchDbFiles = async () => {
    setLoadingDbFiles(true)
    try {
      const res = await fetch('/api/settings/database/optimize')
      if (res.ok) {
        const data = await res.json()
        setDbFiles(Array.isArray(data.files) ? data.files : [])
        setDbFilesTotalMB(Number(data.totalMB) || 0)
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingDbFiles(false)
    }
  }

  const handleOptimizeDb = async (target?: string, all?: boolean) => {
    const isLive = !target || target === 'gym.db'
    const confirmMsg = all
      ? 'هل تريد تنظيف كل النسخ الاحتياطية القديمة؟\n\nالعملية بتشغّل VACUUM على كل ملفات gym.db.backup-* وبتصغّر حجمها.\nالملف الأساسي (gym.db) مش هيتأثر.'
      : isLive
        ? 'هل تريد تنظيف ملف قاعدة البيانات الأساسي (gym.db)؟\n\nالعملية آمنة وبتصغّر الحجم من غير ما تغيّر في البيانات.\nيُفضَّل عمل نسخة احتياطية قبلها من زر "النسخ الاحتياطي".'
        : `هل تريد تنظيف الملف "${target}"؟`

    setConfirmState({
      open: true,
      message: confirmMsg,
      title: 'تنظيف قاعدة البيانات',
      type: 'warning',
      onConfirm: async () => {
        setOptimizingDb(true)
        setOptimizeMessage(null)
        try {
          const res = await fetch('/api/settings/database/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(all ? { all: true } : { target: target || 'gym.db' }),
          })
          const data = await res.json()

          if (!res.ok || data.success === false) {
            setOptimizeMessage({ type: 'error', text: data.error || 'فشل تنظيف الملف' })
            return
          }

          if (all) {
            const lines = (data.results || []).map((r: any) =>
              r.success
                ? `[OK] ${r.name}: ${r.before?.mb} MB → ${r.after?.mb} MB (وفّر ${r.saved?.mb} MB)`
                : `[X] ${r.name}: ${r.error || 'فشل'}`
            )
            setOptimizeMessage({
              type: 'success',
              text: `تم تنظيف ${data.results?.length || 0} ملف\nالإجمالي المُوفَّر: ${data.totalSavedMB} MB\n\n${lines.join('\n')}`,
            })
          } else {
            const msg = data.success
              ? `${data.target}: ${data.before?.mb} MB → ${data.after?.mb} MB\nوفّر ${data.saved?.mb} MB (${data.saved?.percent}%)`
              : data.error || 'فشل التنظيف'
            setOptimizeMessage({ type: data.success ? 'success' : 'error', text: msg })
          }

          fetchDbFiles()
        } catch (err: any) {
          setOptimizeMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء التنظيف' })
        } finally {
          setOptimizingDb(false)
        }
      },
    })
  }

  // 🗜️ Base64 image cleanup — preflight + run
  const fetchCleanupInfo = async () => {
    setCleanupLoading(true)
    try {
      const res = await fetch('/api/settings/database/migrate-base64-images')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setCleanupInfo({
            candidates: data.candidates,
            currentDbSizeMb: data.currentDbSizeMb,
            estimatedBase64Mb: data.estimatedBase64Mb,
          })
        }
      }
    } catch {
      /* ignore */
    } finally {
      setCleanupLoading(false)
    }
  }

  const handleRunCleanup = async () => {
    if (!cleanupInfo || cleanupInfo.candidates === 0) return
    setConfirmState({
      open: true,
      message:
        `هذه العملية ستقوم بالتالي:\n\n` +
        `1️⃣ حفظ نسخة احتياطية من قاعدة البيانات\n` +
        `2️⃣ نقل ${cleanupInfo.candidates} صورة من قاعدة البيانات لملفات\n` +
        `3️⃣ ضغط قاعدة البيانات (VACUUM)\n\n` +
        `الوقت المتوقع: ١-٢ دقيقة. تأكد إن مفيش حد بيستخدم النظام.\n\n` +
        `هل تريد المتابعة؟`,
      title: 'تنظيف الصور',
      type: 'warning',
      onConfirm: async () => {
        setCleanupRunning(true)
        setCleanupResult(null)
        try {
          const res = await fetch('/api/settings/database/migrate-base64-images', { method: 'POST' })
          const data = await res.json()
          if (data.success) {
            setCleanupResult(data)
            await fetchCleanupInfo()
          } else {
            toast.error(`فشل التنظيف: ${data.error || 'خطأ غير معروف'}`)
          }
        } catch (err: any) {
          toast.error(`حدث خطأ أثناء التنظيف: ${err.message}`)
        } finally {
          setCleanupRunning(false)
        }
      },
    })
  }

  const fetchLocalIP = async () => {
    setIsLoadingIP(true)
    try {
      const response = await fetch('/api/network/local-ip')
      if (response.ok) {
        const data = await response.json()
        setLocalIP(data.ip)
        setLocalURL(data.url)
      }
    } catch (error) {
      console.error('Error fetching local IP:', error)
    } finally {
      setIsLoadingIP(false)
    }
  }

  // License functions
  const fetchCurrentLicense = async () => {
    try {
      const response = await fetch('/api/license/current')
      if (response.ok) {
        const data = await response.json()
        if (data.license) {
          setCurrentLicense(data.license)
          setSelectedGymId(data.license.gymId)
          setSelectedBranchId(data.license.branchId)
          if (data.license.gymId) {
            fetchBranches(data.license.gymId)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching current license:', error)
    }
  }

  // Offline Mode functions
  const fetchOfflineStatus = async () => {
    try {
      const res = await fetch('/api/offline-mode/status')
      if (!res.ok) return
      const data = await res.json()
      if (data.configured) {
        setOfflineStatus({
          offlineModeEnabled: data.offlineModeEnabled,
          stats: data.stats
        })
      }
    } catch (error) {
      console.error('Error fetching offline status:', error)
    }
  }

  const flushSyncQueue = async () => {
    setFlushingSync(true)
    try {
      const res = await fetch('/api/offline-mode/flush', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'فشل الإرسال')
      } else {
        await fetchOfflineStatus()
        toast.success(`تم: ${data.sent} ناجح، ${data.failed} فشل`)
      }
    } catch (error) {
      console.error('Flush sync error:', error)
      toast.error('خطأ في الاتصال')
    } finally {
      setFlushingSync(false)
    }
  }

  const toggleOfflineMode = async () => {
    if (!offlineStatus) return
    const next = !offlineStatus.offlineModeEnabled
    const confirmMsg = next
      ? 'تفعيل وضع الأوفلاين؟ كل إيصال ومصروف هيتبعت لـ Fitboost dashboard تلقائياً.'
      : 'إيقاف وضع الأوفلاين؟ مش هيتبعت أي إيصال جديد بعد كده.'
    setConfirmState({
      open: true,
      message: confirmMsg,
      title: 'وضع الأوفلاين',
      type: 'warning',
      onConfirm: async () => {
        setOfflineToggling(true)
        try {
          const res = await fetch('/api/offline-mode/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: next })
          })
          const data = await res.json()
          if (!res.ok) {
            toast.error(data.error || 'فشل التبديل')
          } else {
            await fetchOfflineStatus()
          }
        } catch (error) {
          console.error('Toggle offline mode error:', error)
          toast.error('خطأ في الاتصال')
        } finally {
          setOfflineToggling(false)
        }
      },
    })
  }

  const fetchGyms = async () => {
    setLoadingGyms(true)
    try {
      const response = await fetch('/api/license/gyms')
      if (response.ok) {
        const data = await response.json()
        setGyms(data.gyms || [])
        if (!data.gyms || data.gyms.length === 0) {
          setSaveMessage({ type: 'error', text: 'لا توجد صالات متاحة في قاعدة البيانات' })
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        setSaveMessage({ type: 'error', text: errorData.error || 'فشل جلب الصالات' })
      }
    } catch (error) {
      console.error('Exception fetching gyms:', error)
      setSaveMessage({ type: 'error', text: 'خطأ في الاتصال - تحقق من الإنترنت أو إعدادات Supabase' })
    } finally {
      setLoadingGyms(false)
    }
  }

  const fetchBranches = async (gymId: string) => {
    if (!gymId) {
      setBranches([])
      return
    }
    setLoadingBranches(true)
    try {
      const response = await fetch(`/api/license/branches?gymId=${gymId}`)
      if (response.ok) {
        const data = await response.json()
        setBranches(data.branches || [])
      }
    } catch (error) {
      console.error('Error fetching branches:', error)
    } finally {
      setLoadingBranches(false)
    }
  }

  const handleGymChange = (gymId: string) => {
    setSelectedGymId(gymId)
    setSelectedBranchId('')
    setBranches([])
    if (gymId) {
      fetchBranches(gymId)
    }
  }

  const saveLicenseSelection = async () => {
    if (!selectedGymId || !selectedBranchId) {
      setSaveMessage({ type: 'error', text: 'يرجى اختيار الصالة والفرع' })
      return
    }

    setSavingLicense(true)
    try {
      const selectedGym = gyms.find(g => g.id === selectedGymId)
      const selectedBranch = branches.find(b => b.id === selectedBranchId)

      const response = await fetch('/api/license/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gymId: selectedGymId,
          gymName: selectedGym?.name_ar || selectedGym?.name_en,
          branchId: selectedBranchId,
          branchName: selectedBranch?.name_ar || selectedBranch?.name_en,
          systemLicense: selectedBranch?.system_license
        })
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentLicense(data.license)
        setSaveMessage({ type: 'success', text: 'تم حفظ اختيار الصالة والفرع بنجاح' })
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        setSaveMessage({ type: 'error', text: 'فشل حفظ الاختيار' })
      }
    } catch (error) {
      console.error('Error saving license:', error)
      setSaveMessage({ type: 'error', text: 'حدث خطأ أثناء الحفظ' })
    } finally {
      setSavingLicense(false)
    }
  }

  //  حفظ صورة البروفايل (self-service)
  const handleProfileImageChange = async (imageUrl: string | null) => {
    setSavingPhoto(true)
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileImage: imageUrl }),
      })
      if (res.ok) {
        setProfileImg(imageUrl)
        toast.success(imageUrl
          ? (locale === 'ar' ? 'تم تحديث صورة البروفايل' : 'Profile photo updated')
          : (locale === 'ar' ? 'تم حذف صورة البروفايل' : 'Profile photo removed'))
      } else {
        toast.error(locale === 'ar' ? 'فشل حفظ الصورة' : 'Failed to save photo')
      }
    } catch {
      toast.error(locale === 'ar' ? 'حدث خطأ في الاتصال' : 'Connection error')
    } finally {
      setSavingPhoto(false)
    }
  }

  //  تغيير كلمة السر (self-service)
  const handleChangePassword = async () => {
    if (!pwForm.oldPassword || !pwForm.newPassword) {
      toast.warning(locale === 'ar' ? 'اكتب كلمة السر القديمة والجديدة' : 'Enter old and new password')
      return
    }
    if (pwForm.newPassword.length < 8) {
      toast.error(locale === 'ar' ? 'كلمة السر الجديدة لازم 8 أحرف على الأقل' : 'New password must be at least 8 characters')
      return
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error(locale === 'ar' ? 'تأكيد كلمة السر مش مطابق' : 'Password confirmation does not match')
      return
    }
    setPwLoading(true)
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: pwForm.oldPassword, newPassword: pwForm.newPassword }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || (locale === 'ar' ? 'تم تغيير كلمة السر' : 'Password changed'))
        setPwForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        toast.error(data.error || (locale === 'ar' ? 'فشل تغيير كلمة السر' : 'Failed to change password'))
      }
    } catch {
      toast.error(locale === 'ar' ? 'حدث خطأ في الاتصال' : 'Connection error')
    } finally {
      setPwLoading(false)
    }
  }

  // تحديد من يمتلك صلاحيات الإعدادات الإدارية
  const hasAdminAccess = user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.permissions?.canAccessSettings === true

  const navigationItems: Array<{ id: string; label: string }> = [
    //  البروفايل — متاح لكل المستخدمين (بما فيهم الأدمن/الأونر)
    { id: 'profile', label: locale === 'ar' ? 'بروفايل' : 'Profile' },
    ...(user?.role === 'ADMIN' || user?.role === 'OWNER' ? [{ id: 'quick-links', label: t('settingsPage.navigation.quickLinks') }] : []),
    ...(hasAdminAccess ? [
      { id: 'services', label: t('settingsPage.navigation.services') },
      { id: 'points', label: t('settingsPage.navigation.points') },
      { id: 'referral', label: t('settingsPage.navigation.referral') },
      { id: 'free-sessions', label: t('settingsPage.navigation.freeSessions') },
      { id: 'receipts', label: t('settingsPage.navigation.receipts') },
      { id: 'port-forwarding', label: t('settingsPage.navigation.portForwarding') }
    ] : []),
    ...(user?.role !== 'COACH' ? [{ id: 'whatsapp', label: t('settingsPage.navigation.whatsapp') }] : []),
    { id: 'display', label: t('settingsPage.navigation.display') },
    ...(user?.role === 'OWNER' ? [
      { id: 'license', label: t('settingsPage.navigation.license') },
      { id: 'database', label: t('settingsPage.navigation.database') },
      { id: 'tunnel', label: 'تانل' },
      { id: 'apply-features', label: 'تطبيق مميزات الباقات' }
    ] : []),
    ...(typeof window !== 'undefined' && (window as any).electron?.isElectron ? [{ id: 'updates', label: t('settingsPage.navigation.updates') }] : []),
    { id: 'support', label: t('settingsPage.navigation.support') }
  ]

  const services = [
    { id: 'nutrition', name: t('settingsPage.services.nutrition.name'), desc: t('settingsPage.services.nutrition.desc') },
    { id: 'physiotherapy', name: t('settingsPage.services.physiotherapy.name'), desc: t('settingsPage.services.physiotherapy.desc') },
    { id: 'groupClass', name: t('settingsPage.services.groupClass.name'), desc: t('settingsPage.services.groupClass.desc') },
    { id: 'spa', name: t('settingsPage.services.spa.name'), desc: t('settingsPage.services.spa.desc') },
    { id: 'inBody', name: t('settingsPage.services.inBody.name'), desc: t('settingsPage.services.inBody.desc') },
    { id: 'pool', name: t('settingsPage.services.pool.name'), desc: t('settingsPage.services.pool.desc') },
    { id: 'padel', name: t('settingsPage.services.padel.name'), desc: t('settingsPage.services.padel.desc') },
    { id: 'assessment', name: t('settingsPage.services.assessment.name'), desc: t('settingsPage.services.assessment.desc') },
    { id: 'lostFound', name: locale === 'ar' ? 'المتعلقات المفقودة' : 'Lost & Found', desc: locale === 'ar' ? 'تسجيل الحاجات المفقودة اللي بتتلاقى في الجيم' : 'Track items found in the gym' }
  ]

  if (!user) {
    return <LoadingScreen fullScreen message={t('settingsPage.loading')} />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" dir={direction}>
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              aria-label="Toggle navigation"
            >
              <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
              <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.title')}</h1>
          </div>
        </div>
      </div>

      <div className="flex relative">
        {/* Sidebar Overlay for Mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed lg:sticky
            top-[73px]
            ltr:left-0 rtl:right-0
            z-50 lg:z-30
            h-[calc(100vh-73px)]
            w-72 sm:w-80 lg:w-64
            bg-white dark:bg-gray-800
            ltr:border-r rtl:border-l border-gray-200 dark:border-gray-700
            shadow-2xl lg:shadow-none
            transition-[transform,opacity] duration-300 ease-in-out
            ${isSidebarOpen
              ? 'translate-x-0 opacity-100'
              : `${direction === 'rtl' ? 'translate-x-full' : '-translate-x-full'} opacity-0 lg:translate-x-0 lg:opacity-100`
            }
          `}
        >
          {/* Sidebar Header - Mobile Only */}
          <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {t('settingsPage.navigation.quickLinks')}
            </h2>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close sidebar"
            >
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 lg:p-4 space-y-1 overflow-y-auto h-[calc(100%-73px)] lg:h-full scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setIsSidebarOpen(false);
                  // تانل صفحة مستقلة (route) مش قسم inline
                  if (item.id === 'tunnel') { router.push('/settings/tunnel'); return; }
                  setActiveSection(item.id);
                }}
                aria-current={activeSection === item.id ? 'page' : undefined}
                className={`
                  w-full text-start
                  px-3 py-2.5
                  rounded-lg
                  transition-colors duration-200
                  flex items-center gap-3
                  ${activeSection === item.id
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-bold shadow-sm'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                <span className={`${activeSection === item.id ? 'text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400'} flex-shrink-0`}>
                  <svg {...stroke} className="w-5 h-5" aria-hidden="true">{NAV_ICON_PATHS[item.id] || NAV_ICON_PATHS['support']}</svg>
                </span>
                <span className="flex-1 truncate text-sm">{item.label}</span>
                {activeSection === item.id && (
                  <span className="end-0 h-5 w-1 bg-primary-600 dark:bg-primary-400 rounded-full" aria-hidden="true" />
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6 lg:p-8 max-w-5xl mx-auto w-full">
          {/* Save Notification Toast */}
          {saveMessage && (
            <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 p-4 rounded-xl ring-1 shadow-xl backdrop-blur-sm ${saveMessage.type === 'success' ? 'bg-green-50/95 dark:bg-green-900/40 ring-green-200 dark:ring-green-900/50' : 'bg-red-50/95 dark:bg-red-900/40 ring-red-200 dark:ring-red-900/50'}`} role="status" aria-live="polite">
              <div className="flex items-center gap-3 min-w-[320px]">
                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${saveMessage.type === 'success' ? 'bg-green-100 dark:bg-green-800/50 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-800/50 text-red-700 dark:text-red-300'}`}>
                  <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                    {saveMessage.type === 'success' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    )}
                  </svg>
                </div>
                <p className={`flex-1 text-sm font-bold ${saveMessage.type === 'success' ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>{saveMessage.text}</p>
                <button
                  onClick={() => setSaveMessage(null)}
                  className={`flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-200 ${saveMessage.type === 'success' ? 'hover:bg-green-200 dark:hover:bg-green-700/50 text-green-700 dark:text-green-200' : 'hover:bg-red-200 dark:hover:bg-red-700/50 text-red-700 dark:text-red-200'}`}
                  aria-label="Dismiss"
                >
                  <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {activeSection === 'services' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                    <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3 2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75 2.25-1.313M12 21.75V19.5m0 2.25-2.25-1.313m0-16.875L12 2.25l2.25 1.313" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.services.title')}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('settingsPage.services.description')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                <div className="grid gap-3">
                  {services.map((service) => (
                    <div key={service.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/40 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                          <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3 2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75 2.25-1.313M12 21.75V19.5m0 2.25-2.25-1.313m0-16.875L12 2.25l2.25 1.313" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-gray-100">{service.name}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{service.desc}</p>
                        </div>
                      </div>
                      <label className="toggle-switch toggle-green">
                        <input
                          type="checkbox"
                          checked={serviceSettings[`${service.id}Enabled` as keyof typeof serviceSettings] as boolean}
                          onChange={() => toggleService(service.id)}
                        />
                        <span className="toggle-track">
                          <span className="toggle-thumb"></span>
                        </span>
                      </label>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={saveServiceSettings}
                    disabled={isSaving}
                    className="bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSaving ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'points' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                    <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.points.title')}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('settingsPage.points.description')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/40 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 mb-6">
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.points.enable')}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('settingsPage.points.enableDesc')}</p>
                  </div>
                  <label className="toggle-switch toggle-yellow">
                    <input
                      type="checkbox"
                      checked={serviceSettings.pointsEnabled}
                      onChange={() => updateSetting('pointsEnabled', !serviceSettings.pointsEnabled)}
                    />
                    <span className="toggle-track">
                      <span className="toggle-thumb"></span>
                    </span>
                  </label>
                </div>
                {serviceSettings.pointsEnabled && (
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg">
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('settingsPage.points.perCheckIn')}</label>
                      <input type="number" min="0" value={serviceSettings.pointsPerCheckIn} onChange={(e) => updateSetting('pointsPerCheckIn', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200" />
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{t('settingsPage.points.perCheckInDesc')}</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg">
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('settingsPage.points.perInvitation')}</label>
                      <input type="number" min="0" value={serviceSettings.pointsPerInvitation} onChange={(e) => updateSetting('pointsPerInvitation', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200" />
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{t('settingsPage.points.perInvitationDesc')}</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                        <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                        </svg>
                        {t('settingsPage.points.perReferral')}
                      </label>
                      <input type="number" min="0" value={serviceSettings.pointsPerReferral} onChange={(e) => updateSetting('pointsPerReferral', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200" />
                      <p className="flex items-start gap-1 text-xs text-gray-600 dark:text-gray-400 mt-2">
                        <svg {...stroke} className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                        </svg>
                        <span>{t('settingsPage.points.perReferralDesc')}</span>
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                        <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21" />
                        </svg>
                        {t('settingsPage.points.perBirthday')}
                      </label>
                      <input type="number" min="0" value={serviceSettings.pointsPerBirthday || 10} onChange={(e) => updateSetting('pointsPerBirthday', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200" />
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{t('settingsPage.points.perBirthdayDesc')}</p>

                      <button
                        onClick={awardBirthdayPoints}
                        disabled={isAwardingBirthday || !serviceSettings.pointsEnabled}
                        className="mt-4 w-full px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isAwardingBirthday ? (
                          <>
                            <svg {...stroke} className="w-5 h-5 animate-spin" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>{t('settingsPage.points.awardingPoints')}</span>
                          </>
                        ) : (
                          <>
                            <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21" />
                            </svg>
                            <span>{t('settingsPage.points.awardNow')}</span>
                          </>
                        )}
                      </button>

                      {birthdayResult && (
                        <div className={`mt-3 p-3 rounded-lg ring-1 ${
                          birthdayResult.type === 'success'
                            ? 'bg-green-50 dark:bg-green-900/20 ring-green-200 dark:ring-green-900/50 text-green-800 dark:text-green-300'
                            : 'bg-red-50 dark:bg-red-900/20 ring-red-200 dark:ring-red-900/50 text-red-800 dark:text-red-300'
                        }`}>
                          <div className="font-bold">{birthdayResult.message}</div>
                          {birthdayResult.members && birthdayResult.members.length > 0 && (
                            <div className="mt-2 text-sm space-y-1">
                              {birthdayResult.members.map((member: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <svg {...stroke} className="w-4 h-4 flex-shrink-0" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                  </svg>
                                  <span>{member.name} (#{member.memberNumber}): +{member.pointsAwarded} {t('members.pointsLabel')}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg">
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('settingsPage.points.perEGP')}</label>
                      <input type="number" min="0" step="0.1" value={serviceSettings.pointsPerEGPSpent} onChange={(e) => updateSetting('pointsPerEGPSpent', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200" />
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{t('settingsPage.points.perEGPDesc')}</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg">
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('settingsPage.points.valueInEGP')}</label>
                      <input type="number" min="0" step="0.1" value={serviceSettings.pointsValueInEGP} onChange={(e) => updateSetting('pointsValueInEGP', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200" />
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{t('settingsPage.points.valueInEGPDesc')}</p>
                    </div>
                  </div>
                )}
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={saveServiceSettings}
                    disabled={isSaving}
                    className="bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSaving ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'referral' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                    <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.referral.title')}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('settingsPage.referral.description')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 space-y-5">
                <div className="p-4 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 flex items-center justify-center flex-shrink-0">
                        <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0v-9m0 0a4.5 4.5 0 0 0 4.5-4.5M12 12a4.5 4.5 0 0 1-4.5-4.5" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.referral.nutritionTitle')}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{t('settingsPage.referral.nutritionDesc')}</p>
                      </div>
                    </div>
                    <label className="toggle-switch toggle-purple">
                      <input
                        type="checkbox"
                        checked={serviceSettings.nutritionReferralEnabled}
                        onChange={() => updateSetting('nutritionReferralEnabled', !serviceSettings.nutritionReferralEnabled)}
                      />
                      <span className="toggle-track">
                        <span className="toggle-thumb"></span>
                      </span>
                    </label>
                  </div>
                  {serviceSettings.nutritionReferralEnabled && (
                    <div className="mt-3 p-4 bg-white dark:bg-gray-800 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('settingsPage.referral.percentage')}</label>
                      <input type="number" min="0" max="100" step="0.5" value={serviceSettings.nutritionReferralPercentage} onChange={(e) => updateSetting('nutritionReferralPercentage', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200" placeholder="5" />
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{t('settingsPage.referral.exampleNutrition')}</p>
                    </div>
                  )}
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 flex items-center justify-center flex-shrink-0">
                        <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.referral.physioTitle')}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{t('settingsPage.referral.physioDesc')}</p>
                      </div>
                    </div>
                    <label className="toggle-switch toggle-pink">
                      <input
                        type="checkbox"
                        checked={serviceSettings.physioReferralEnabled}
                        onChange={() => updateSetting('physioReferralEnabled', !serviceSettings.physioReferralEnabled)}
                      />
                      <span className="toggle-track">
                        <span className="toggle-thumb"></span>
                      </span>
                    </label>
                  </div>
                  {serviceSettings.physioReferralEnabled && (
                    <div className="mt-3 p-4 bg-white dark:bg-gray-800 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('settingsPage.referral.percentage')}</label>
                      <input type="number" min="0" max="100" step="0.5" value={serviceSettings.physioReferralPercentage} onChange={(e) => updateSetting('physioReferralPercentage', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200" placeholder="3" />
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{t('settingsPage.referral.examplePhysio')}</p>
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={saveServiceSettings}
                    disabled={isSaving}
                    className="bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSaving ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'receipts' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                    <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h4m6-4V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3-2 3 2 3-2 3 2v-4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.receipts.title')}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('settingsPage.receipts.description')}</p>
                  </div>
                </div>
              </div>

              {/* الموقع الإلكتروني */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 space-y-5">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                  {t('settingsPage.receipts.website')}
                </h3>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('settingsPage.receipts.websiteUrl')}</label>
                  <input type="url" value={serviceSettings.websiteUrl} onChange={(e) => updateSetting('websiteUrl', e.target.value)} placeholder="https://www.example.com" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200" dir="ltr" />
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{t('settingsPage.receipts.websiteUrlDesc')}</p>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/40 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.receipts.showOnReceipts')}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('settingsPage.receipts.showOnReceiptsDesc')}</p>
                  </div>
                  <label className="toggle-switch toggle-indigo">
                    <input
                      type="checkbox"
                      checked={serviceSettings.showWebsiteOnReceipts}
                      onChange={() => updateSetting('showWebsiteOnReceipts', !serviceSettings.showWebsiteOnReceipts)}
                    />
                    <span className="toggle-track">
                      <span className="toggle-thumb"></span>
                    </span>
                  </label>
                </div>
              </div>

              {/* عرض QR التطبيق في الإيصالات */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                      <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-gray-100">عرض QR التطبيق في الإيصال المطبوع والواتساب</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">يظهر QR code الأندرويد والـ iOS في أسفل الإيصال</p>
                    </div>
                  </div>
                  <label className="toggle-switch toggle-indigo">
                    <input type="checkbox" checked={(serviceSettings as any).showAppLinksOnReceipts || false} onChange={() => updateSetting('showAppLinksOnReceipts', !(serviceSettings as any).showAppLinksOnReceipts)} />
                    <span className="toggle-track"><span className="toggle-thumb"></span></span>
                  </label>
                </div>
              </div>

              {/* الأرقام التسلسلية */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 space-y-4">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
                  </svg>
                  {t('settingsPage.receipts.serialNumbers')}
                </h3>
                <div className="p-4 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-1">{t('settingsPage.receipts.nextReceiptNumber')}</h4>
                      {editingReceiptNumber ? (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="number"
                            min={1}
                            value={tempReceiptNumber}
                            onChange={(e) => setTempReceiptNumber(parseInt(e.target.value) || 1)}
                            className="w-32 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                            autoFocus
                          />
                          <button
                            onClick={saveReceiptNumber}
                            disabled={savingReceiptNumber}
                            className="inline-flex items-center justify-center w-9 h-9 bg-primary-500 hover:bg-primary-600 text-primary-contrast rounded-lg transition-colors duration-200 disabled:opacity-50"
                            aria-label="Save receipt number"
                          >
                            {savingReceiptNumber ? (
                              <svg {...stroke} className="w-4 h-4 animate-spin" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            ) : (
                              <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => setEditingReceiptNumber(false)}
                            className="inline-flex items-center justify-center w-9 h-9 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors duration-200"
                            aria-label="Cancel editing"
                          >
                            <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-3xl font-bold text-primary-700 dark:text-primary-400">{nextReceiptNumber}</p>
                          <button
                            onClick={() => { setTempReceiptNumber(nextReceiptNumber); setEditingReceiptNumber(true) }}
                            className="inline-flex items-center justify-center w-8 h-8 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
                            aria-label="Edit next receipt number"
                          >
                            <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                      <svg {...stroke} className="w-7 h-7" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h4m6-4V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3-2 3 2 3-2 3 2v-4" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-1">{t('settingsPage.receipts.nextMemberNumber')}</h4>
                      {editingMemberNumber ? (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="number"
                            min={1}
                            value={tempMemberNumber}
                            onChange={(e) => setTempMemberNumber(parseInt(e.target.value) || 1)}
                            className="w-32 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                            autoFocus
                          />
                          <button
                            onClick={saveMemberNumber}
                            disabled={savingMemberNumber}
                            className="inline-flex items-center justify-center w-9 h-9 bg-primary-500 hover:bg-primary-600 text-primary-contrast rounded-lg transition-colors duration-200 disabled:opacity-50"
                            aria-label="Save member number"
                          >
                            {savingMemberNumber ? (
                              <svg {...stroke} className="w-4 h-4 animate-spin" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            ) : (
                              <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => setEditingMemberNumber(false)}
                            className="inline-flex items-center justify-center w-9 h-9 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors duration-200"
                            aria-label="Cancel editing"
                          >
                            <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{nextMemberNumber}</p>
                          <button
                            onClick={() => { setTempMemberNumber(nextMemberNumber); setEditingMemberNumber(true) }}
                            className="inline-flex items-center justify-center w-8 h-8 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
                            aria-label="Edit next member number"
                          >
                            <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                      <svg {...stroke} className="w-7 h-7" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 rounded-lg flex items-start gap-2">
                  <svg {...stroke} className="w-5 h-5 text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                  </svg>
                  <p className="text-sm text-amber-800 dark:text-amber-200">{t('settingsPage.receipts.serialInfo')}</p>
                </div>
              </div>

              {/* شروط وأحكام الإيصال */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487 18.549 2.799a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                  </svg>
                  {t('settingsPage.receipts.terms')}
                </h3>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('settingsPage.receipts.termsLabel')}</label>
                <textarea value={serviceSettings.receiptTerms} onChange={(e) => updateSetting('receiptTerms', e.target.value)} rows={12} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 resize-none" placeholder={t('settingsPage.receipts.termsPlaceholder')} />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{t('settingsPage.receipts.termsDesc')}</p>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={saveServiceSettings}
                    disabled={isSaving}
                    className="bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSaving ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'quick-links' && (user?.role === 'ADMIN' || user?.role === 'OWNER') && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                    <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.quickLinks.title')}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('settingsPage.quickLinks.description')}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link href="/admin/users" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 hover:ring-primary-300 dark:hover:ring-primary-700 transition-colors duration-200 group">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                      <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.quickLinks.users.title')}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t('settingsPage.quickLinks.users.desc')}</p>
                    </div>
                    <svg {...stroke} className={`w-5 h-5 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors ${direction === 'rtl' ? 'rotate-180' : ''}`} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </Link>
                <Link href="/offers" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 hover:ring-primary-300 dark:hover:ring-primary-700 transition-colors duration-200 group">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 flex items-center justify-center flex-shrink-0">
                      <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.quickLinks.offers.title')}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t('settingsPage.quickLinks.offers.desc')}</p>
                    </div>
                    <svg {...stroke} className={`w-5 h-5 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors ${direction === 'rtl' ? 'rotate-180' : ''}`} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </Link>
                <Link href="/settings/packages" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 hover:ring-primary-300 dark:hover:ring-primary-700 transition-colors duration-200 group">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                      <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.quickLinks.packages.title')}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t('settingsPage.quickLinks.packages.desc')}</p>
                    </div>
                    <svg {...stroke} className={`w-5 h-5 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors ${direction === 'rtl' ? 'rotate-180' : ''}`} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </Link>
                <Link href="/admin/audit" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 hover:ring-primary-300 dark:hover:ring-primary-700 transition-colors duration-200 group">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
                      <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.quickLinks.audit.title')}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t('settingsPage.quickLinks.audit.desc')}</p>
                    </div>
                    <svg {...stroke} className={`w-5 h-5 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors ${direction === 'rtl' ? 'rotate-180' : ''}`} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </Link>
                <Link href="/settings/system" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 hover:ring-primary-300 dark:hover:ring-primary-700 transition-colors duration-200 group">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                      <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 7h10v10H7zM10 10h4v4h-4z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.quickLinks.system.title')}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t('settingsPage.quickLinks.system.desc')}</p>
                    </div>
                    <svg {...stroke} className={`w-5 h-5 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors ${direction === 'rtl' ? 'rotate-180' : ''}`} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </Link>
              </div>
            </div>
          )}

          {activeSection === 'free-sessions' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                    <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.freeSessions.title')}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('settingsPage.freeSessions.description')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 space-y-5">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/40 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.freeSessions.enable')}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('settingsPage.freeSessions.enableDesc')}</p>
                  </div>
                  <label className="toggle-switch toggle-teal">
                    <input
                      type="checkbox"
                      checked={serviceSettings.trackFreeSessionsCost}
                      onChange={() => updateSetting('trackFreeSessionsCost', !serviceSettings.trackFreeSessionsCost)}
                    />
                    <span className="toggle-track">
                      <span className="toggle-thumb"></span>
                    </span>
                  </label>
                </div>
                {serviceSettings.trackFreeSessionsCost && (
                  <div className="space-y-3">
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg">
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('settingsPage.freeSessions.ptPrice')}</label>
                      <input type="number" min="0" value={serviceSettings.freePTSessionPrice} onChange={(e) => updateSetting('freePTSessionPrice', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200" />
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg">
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('settingsPage.freeSessions.nutritionPrice')}</label>
                      <input type="number" min="0" value={serviceSettings.freeNutritionSessionPrice} onChange={(e) => updateSetting('freeNutritionSessionPrice', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200" />
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg">
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('settingsPage.freeSessions.physioPrice')}</label>
                      <input type="number" min="0" value={serviceSettings.freePhysioSessionPrice} onChange={(e) => updateSetting('freePhysioSessionPrice', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200" />
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg">
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('settingsPage.freeSessions.groupClassPrice')}</label>
                      <input type="number" min="0" value={serviceSettings.freeGroupClassSessionPrice} onChange={(e) => updateSetting('freeGroupClassSessionPrice', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200" />
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  <button
                    onClick={saveServiceSettings}
                    disabled={isSaving}
                    className="bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSaving ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
                  </button>
                </div>
              </div>

              {/* نظام بواقي الاشتراك */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                      <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-gray-100">
                        {locale === 'ar' ? 'نظام بواقي الاشتراك' : 'Remaining Balance System'}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {locale === 'ar'
                          ? 'يتيح تسجيل مبلغ متبقي على العضو عند إنشاء/تجديد/ترقية الاشتراك - يظهر في الإيصال والفلتر'
                          : 'Allows recording a remaining balance when creating/renewing/upgrading subscriptions'}
                      </p>
                    </div>
                  </div>
                  <label className="toggle-switch toggle-orange">
                    <input
                      type="checkbox"
                      checked={serviceSettings.remainingEnabled}
                      onChange={() => updateSetting('remainingEnabled', !serviceSettings.remainingEnabled)}
                    />
                    <span className="toggle-track">
                      <span className="toggle-thumb"></span>
                    </span>
                  </label>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={saveServiceSettings}
                    disabled={isSaving}
                    className="bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSaving ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'profile' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Header */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center flex-shrink-0">
                    <svg {...stroke} className="w-6 h-6" aria-hidden="true">{NAV_ICON_PATHS['profile']}</svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{locale === 'ar' ? 'البروفايل' : 'Profile'}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {user?.name}{user?.email ? ` · ${user.email}` : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* صورة البروفايل */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">{locale === 'ar' ? 'صورة البروفايل' : 'Profile Photo'}</h3>
                <ImageUpload
                  variant="profile"
                  currentImage={profileImg}
                  onImageChange={handleProfileImageChange}
                  disabled={savingPhoto}
                  label={locale === 'ar' ? 'صورتك الشخصية' : 'Your photo'}
                />
              </div>

              {/* تغيير كلمة السر */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
                <div className="flex items-center justify-center gap-3 px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-700/60 text-center">
                  <span className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center flex-shrink-0">
                    <svg {...stroke} className="w-5 h-5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{locale === 'ar' ? 'تغيير كلمة السر' : 'Change Password'}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{locale === 'ar' ? 'اكتب كلمة السر القديمة ثم الجديدة' : 'Enter your current then new password'}</p>
                  </div>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); handleChangePassword() }} className="p-5 sm:p-6 space-y-4 max-w-md mx-auto">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'كلمة السر الحالية' : 'Current password'}</label>
                    <div className="relative">
                      <input type={showPw.old ? 'text' : 'password'} autoComplete="current-password" value={pwForm.oldPassword} onChange={(e) => setPwForm({ ...pwForm, oldPassword: e.target.value })} className="w-full ps-3 pe-11 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors" placeholder="••••••••" />
                      <button type="button" onClick={() => setShowPw({ ...showPw, old: !showPw.old })} aria-label={showPw.old ? (locale === 'ar' ? 'إخفاء' : 'Hide') : (locale === 'ar' ? 'إظهار' : 'Show')} className="absolute inset-y-0 end-0 flex items-center pe-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        {showPw.old ? EYE_OFF : EYE}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-gray-200 dark:border-gray-700 pt-4">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'كلمة السر الجديدة' : 'New password'}</label>
                    <div className="relative">
                      <input type={showPw.new ? 'text' : 'password'} autoComplete="new-password" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} className="w-full ps-3 pe-11 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors" placeholder="••••••••" />
                      <button type="button" onClick={() => setShowPw({ ...showPw, new: !showPw.new })} aria-label={showPw.new ? (locale === 'ar' ? 'إخفاء' : 'Hide') : (locale === 'ar' ? 'إظهار' : 'Show')} className="absolute inset-y-0 end-0 flex items-center pe-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        {showPw.new ? EYE_OFF : EYE}
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">{locale === 'ar' ? '8 أحرف على الأقل، وتحتوي على حروف وأرقام' : 'At least 8 chars, with letters and numbers'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'تأكيد كلمة السر الجديدة' : 'Confirm new password'}</label>
                    <div className="relative">
                      <input type={showPw.confirm ? 'text' : 'password'} autoComplete="new-password" value={pwForm.confirmPassword} onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })} className={`w-full ps-3 pe-11 py-2.5 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword ? 'border-red-400 dark:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-primary-500'}`} placeholder="••••••••" />
                      <button type="button" onClick={() => setShowPw({ ...showPw, confirm: !showPw.confirm })} aria-label={showPw.confirm ? (locale === 'ar' ? 'إخفاء' : 'Hide') : (locale === 'ar' ? 'إظهار' : 'Show')} className="absolute inset-y-0 end-0 flex items-center pe-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        {showPw.confirm ? EYE_OFF : EYE}
                      </button>
                    </div>
                    {pwForm.confirmPassword && (
                      pwForm.newPassword === pwForm.confirmPassword ? (
                        <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">✓ {locale === 'ar' ? 'كلمتا السر متطابقتان' : 'Passwords match'}</p>
                      ) : (
                        <p className="text-[11px] font-bold text-red-500 mt-1.5">{locale === 'ar' ? 'كلمتا السر غير متطابقتين' : 'Passwords do not match'}</p>
                      )
                    )}
                  </div>

                  <button type="submit" disabled={pwLoading} className="w-full inline-flex items-center justify-center gap-2 bg-primary-600 text-primary-contrast px-6 py-2.5 rounded-lg hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed font-bold text-sm transition-colors">
                    <svg {...stroke} className="w-4 h-4" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    {pwLoading ? (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (locale === 'ar' ? 'حفظ كلمة السر' : 'Save Password')}
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeSection === 'display' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                    <svg {...stroke} className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.display.title')}</h2>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1">{t('settingsPage.display.description')}</p>
                  </div>
                </div>
              </div>

              {/* لوجو واسم الجيم - OWNER فقط */}
              {user?.role === 'OWNER' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-5">
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                    <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400 shrink-0" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                    </svg>
                    <span>{locale === 'ar' ? 'لوجو واسم الجيم' : 'Gym Logo & Name'}</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">{locale === 'ar' ? 'ارفع لوجو الجيم واكتب اسمه (يظهر في الإيصالات والسايدبار)' : 'Upload gym logo and set its name (shown on receipts & sidebar)'}</p>

                  {/* اسم الجيم */}
                  <div className="mb-4">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487 18.549 2.799a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                      </svg>
                      {locale === 'ar' ? 'اسم الجيم' : 'Gym Name'}
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={serviceSettings.gymName || ''}
                        onChange={(e) => updateSetting('gymName', e.target.value)}
                        placeholder={locale === 'ar' ? 'مثال: FitBoost Gym' : 'e.g. FitBoost Gym'}
                        className="flex-1 min-w-0 px-3 py-2.5 min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-base sm:text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                      />
                      <button
                        onClick={saveServiceSettings}
                        disabled={isSaving}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
                      >
                        {isSaving ? (
                          <svg {...stroke} className="w-4 h-4 animate-spin" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        ) : (
                          <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                          </svg>
                        )}
                        {locale === 'ar' ? 'حفظ' : 'Save'}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-900/40 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl ring-2 ring-dashed ring-gray-300 dark:ring-gray-600 flex items-center justify-center overflow-hidden bg-white dark:bg-gray-800 shrink-0">
                      <img
                        src={gymLogo || '/assets/icon.png'}
                        alt="Gym Logo"
                        className="w-full h-full object-contain p-1"
                      />
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                      <label className={`cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-colors duration-200 ${isUploadingLogo ? 'bg-gray-300 dark:bg-gray-600 text-gray-700 cursor-not-allowed' : 'bg-primary-500 hover:bg-primary-600 text-primary-contrast'}`}>
                        {isUploadingLogo ? (
                          <svg {...stroke} className="w-4 h-4 animate-spin" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        ) : (
                          <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                          </svg>
                        )}
                        {t('settingsPage.display.uploadLogo')}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleLogoUpload}
                          disabled={isUploadingLogo}
                          className="hidden"
                        />
                      </label>
                      {gymLogo && (
                        <button
                          onClick={handleLogoRemove}
                          disabled={isUploadingLogo}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm ring-1 ring-red-300 dark:ring-red-900/50 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
                        >
                          <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                          {t('settingsPage.display.removeLogo')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* اللون الأساسي - OWNER فقط */}
              {user?.role === 'OWNER' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-5">
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                    <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400 shrink-0" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
                    </svg>
                    <span>{t('settingsPage.display.primaryColor')}</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">{t('settingsPage.display.primaryColorDesc')}</p>

                  {/* ألوان جاهزة */}
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 sm:gap-3 mb-4">
                    {[
                      { hex: '#fbe003', label: 'أصفر' },
                      { hex: '#ef4444', label: 'أحمر' },
                      { hex: '#3b82f6', label: 'أزرق' },
                      { hex: '#10b981', label: 'أخضر' },
                      { hex: '#f97316', label: 'برتقالي' },
                      { hex: '#8b5cf6', label: 'بنفسجي' },
                      { hex: '#14b8a6', label: 'تركواز' },
                      { hex: '#ec4899', label: 'وردي' },
                    ].map(c => (
                      <button
                        key={c.hex}
                        onClick={() => handleColorChange(c.hex)}
                        disabled={isSavingColor}
                        aria-label={`Set primary color to ${c.label}`}
                        className={`w-full aspect-square rounded-xl transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500 ${
                          primaryColor === c.hex || (!primaryColor && c.hex === '#fbe003')
                            ? 'ring-2 ring-offset-2 ring-gray-800 dark:ring-white shadow-sm'
                            : 'ring-1 ring-gray-200 dark:ring-gray-700'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.label}
                      />
                    ))}
                  </div>

                  {/* لون مخصص */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
                    <input
                      type="color"
                      value={primaryColor || '#fbe003'}
                      onChange={(e) => {
                        setCustomColorInput(e.target.value)
                        handleColorChange(e.target.value)
                      }}
                      aria-label="Pick custom color"
                      className="w-11 h-11 rounded-lg ring-1 ring-gray-300 dark:ring-gray-600 cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      placeholder="#fbe003"
                      value={customColorInput || primaryColor || ''}
                      onChange={(e) => setCustomColorInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && /^#[0-9a-fA-F]{6}$/.test(customColorInput)) {
                          handleColorChange(customColorInput)
                        }
                      }}
                      className="flex-1 min-w-0 px-3 py-2 min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                      dir="ltr"
                    />
                    {primaryColor && primaryColor !== '#fbe003' && (
                      <button
                        onClick={() => { handleColorChange('#fbe003'); setCustomColorInput('') }}
                        disabled={isSavingColor}
                        className="min-h-[44px] w-full sm:w-auto px-3 py-2 text-sm font-bold rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
                      >
                        {t('settingsPage.display.resetColor')}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* لون النص على الـ Primary (Auto / White / Black) — الأونر بس، عام لكل السيستم */}
              {user?.role === 'OWNER' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-5">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                  <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400 shrink-0" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.42 15.171a4.5 4.5 0 0 0 1.242 7.244l.83.41a48.282 48.282 0 0 0 8.835-2.535 4.5 4.5 0 0 0 .732-7.844l-3.41-3.41a.75.75 0 0 0-1.06 0L9.51 12.36a.75.75 0 0 1-1.06 0L6.42 15.171Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 7.5 19.5 2.25M19.5 2.25 22.5 5.25M19.5 2.25 16.5 5.25" />
                  </svg>
                  <span>{locale === 'ar' ? 'لون النص على الـ Primary' : 'Text Color on Primary'}</span>
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {locale === 'ar'
                    ? 'لون النص اللي بيظهر على الأزرار والعناصر اللي خلفيتها بلون البراند. تلقائي بيختار الأفضل حسب التباين، أو اختاره يدوياً.'
                    : 'Text color on buttons and elements with the brand background. Auto picks the best by contrast, or set it manually.'}
                </p>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {(['auto', 'white', 'black'] as const).map(opt => {
                    const isActive = primaryTextOverride === opt
                    const labels = {
                      auto: locale === 'ar' ? 'تلقائي' : 'Auto',
                      white: locale === 'ar' ? 'أبيض' : 'White',
                      black: locale === 'ar' ? 'أسود' : 'Black',
                    }
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handlePrimaryTextOverride(opt)}
                        aria-pressed={isActive}
                        className={`min-h-[60px] flex flex-col items-center justify-center gap-1.5 rounded-xl ring-1 transition-colors duration-200 ${
                          isActive
                            ? 'ring-primary-500 bg-primary-50 dark:bg-primary-900/30 shadow-sm'
                            : 'ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/40'
                        }`}
                      >
                        {/* Preview pill */}
                        <span
                          className={`inline-flex items-center justify-center min-w-[44px] px-2 py-0.5 rounded-full text-xs font-bold bg-primary-500 ${
                            opt === 'white' ? 'text-white' : opt === 'black' ? 'text-[#0F172A]' : 'text-primary-contrast'
                          }`}
                        >
                          Aa
                        </span>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{labels[opt]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              )}

              {/* المظهر */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-5">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
                  <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400 shrink-0" aria-hidden="true">
                    {isDarkMode ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                    )}
                  </svg>
                  <span>{t('settingsPage.display.appearance')}</span>
                </h3>
                <div className="flex items-center justify-between gap-3 p-3 sm:p-4 bg-gray-50 dark:bg-gray-900/40 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100 mb-0.5 sm:mb-1">{isDarkMode ? t('settingsPage.display.darkMode') : t('settingsPage.display.lightMode')}</h4>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{isDarkMode ? t('settingsPage.display.switchToLight') : t('settingsPage.display.switchToDark')}</p>
                  </div>
                  <button
                    onClick={toggleDarkMode}
                    aria-label="Toggle dark mode"
                    aria-pressed={isDarkMode}
                    className={`relative inline-flex h-10 w-20 items-center rounded-full transition-colors duration-200 shrink-0 ${isDarkMode ? 'bg-slate-700' : 'bg-gray-300'}`}
                    dir="ltr"
                  >
                    <span className={`flex h-8 w-8 rounded-full bg-white shadow-lg transition-transform items-center justify-center text-gray-700 ${isDarkMode ? 'translate-x-11' : 'translate-x-1'}`}>
                      <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                        {isDarkMode ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                        )}
                      </svg>
                    </span>
                  </button>
                </div>
              </div>

              {/* اللغة */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-5">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
                  <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400 shrink-0" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                  <span>{t('settingsPage.display.language')}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <button onClick={() => handleLanguageChange('ar')} aria-pressed={locale === 'ar'} className={`p-3 sm:p-5 min-h-[64px] rounded-xl ring-1 transition-colors duration-200 ${locale === 'ar' ? 'ring-primary-500 bg-primary-50 dark:bg-primary-900/30 shadow-sm' : 'ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/40'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0 font-bold text-sm">AR</div>
                      <div className="flex-1 min-w-0 text-start">
                        <div className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100">{t('settingsPage.display.arabic')}</div>
                        <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{t('settingsPage.display.arabicSubtitle')}</div>
                      </div>
                      {locale === 'ar' && (
                        <svg {...stroke} className="w-5 h-5 sm:w-6 sm:h-6 text-primary-700 dark:text-primary-400 shrink-0" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                  </button>
                  <button onClick={() => handleLanguageChange('en')} aria-pressed={locale === 'en'} className={`p-3 sm:p-5 min-h-[64px] rounded-xl ring-1 transition-colors duration-200 ${locale === 'en' ? 'ring-primary-500 bg-primary-50 dark:bg-primary-900/30 shadow-sm' : 'ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/40'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0 font-bold text-sm">EN</div>
                      <div className="flex-1 min-w-0 text-start">
                        <div className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100">{t('settingsPage.display.english')}</div>
                        <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{t('settingsPage.display.englishSubtitle')}</div>
                      </div>
                      {locale === 'en' && (
                        <svg {...stroke} className="w-5 h-5 sm:w-6 sm:h-6 text-primary-700 dark:text-primary-400 shrink-0" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* License Section */}
          {activeSection === 'license' && user?.role === 'OWNER' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                    <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.license.title')}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('settingsPage.license.subtitle')}</p>
                  </div>
                </div>
              </div>

              {/* Current License Info */}
              {currentLicense && (
                <div className="bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <svg {...stroke} className="w-5 h-5 text-green-700 dark:text-green-300" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <h3 className="text-base font-bold text-green-800 dark:text-green-300">{t('settingsPage.license.activated')}</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{t('settingsPage.license.gym')}:</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{currentLicense.gymName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{t('settingsPage.license.branch')}:</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{currentLicense.branchName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{t('settingsPage.license.licenseStatus')}:</span>
                      <span className={`font-bold ${currentLicense.systemLicense === 'true' || currentLicense.systemLicense === 'active' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {currentLicense.systemLicense === 'true' || currentLicense.systemLicense === 'active' ? t('settingsPage.license.statusActive') : t('settingsPage.license.statusExpired')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Offline Mode Toggle */}
              {currentLicense && offlineStatus && (
                <div className={`rounded-xl p-5 ring-1 ${offlineStatus.offlineModeEnabled
                    ? 'bg-blue-50 dark:bg-blue-900/20 ring-blue-200 dark:ring-blue-900/50'
                    : 'bg-white dark:bg-gray-800 ring-gray-200 dark:ring-gray-700'
                  }`}>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${offlineStatus.offlineModeEnabled ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                        <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                          {offlineStatus.offlineModeEnabled ? (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.652a3.75 3.75 0 0 1 0-5.304m5.304 0a3.75 3.75 0 0 1 0 5.304m-7.425 2.121a6.75 6.75 0 0 1 0-9.546m9.546 0a6.75 6.75 0 0 1 0 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.788m13.788 0c3.808 3.808 3.808 9.98 0 13.788M12 12h.008v.008H12V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                          )}
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                          وضع الأوفلاين (Offline Mode)
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          لما تفعّله، كل إيصال ومصروف هيتبعت تلقائياً لـ Fitboost dashboard
                          <br />
                          عشان تقدر تتابع الـ closing من غير ما الجهاز يكون فاتح
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={toggleOfflineMode}
                      disabled={offlineToggling}
                      aria-label="Toggle offline mode"
                      aria-pressed={offlineStatus.offlineModeEnabled}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 shrink-0 ${offlineStatus.offlineModeEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'} ${offlineToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${offlineStatus.offlineModeEnabled ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1 rtl:-translate-x-1'}`} />
                    </button>
                  </div>

                  {/* Sync Stats */}
                  {offlineStatus.offlineModeEnabled && (
                    <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-900/50">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div className="bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-700 p-3 rounded-lg">
                          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">في الانتظار</div>
                          <div className={`mt-1 text-xl font-bold ${offlineStatus.stats.pending > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100'}`}>
                            {offlineStatus.stats.pending}
                          </div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-700 p-3 rounded-lg">
                          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">تم الإرسال</div>
                          <div className="mt-1 text-xl font-bold text-green-700 dark:text-green-400">
                            {offlineStatus.stats.sent}
                          </div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-700 p-3 rounded-lg">
                          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">فشل</div>
                          <div className={`mt-1 text-xl font-bold ${offlineStatus.stats.failed > 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                            {offlineStatus.stats.failed}
                          </div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-700 p-3 rounded-lg">
                          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">آخر إرسال</div>
                          <div className="mt-1 text-sm font-bold text-gray-900 dark:text-gray-100">
                            {offlineStatus.stats.lastSentAt
                              ? new Date(offlineStatus.stats.lastSentAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                              : '—'}
                          </div>
                        </div>
                      </div>
                      {/* Last error (if any) */}
                      {offlineStatus.stats.lastError && (
                        <div className="mt-3 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <svg {...stroke} className="w-5 h-5 text-red-700 dark:text-red-300 flex-shrink-0 mt-0.5" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-red-800 dark:text-red-300 mb-1">
                                خطأ في الإرسال ({offlineStatus.stats.lastErrorResource} — {offlineStatus.stats.lastErrorAttempts} محاولة)
                              </div>
                              <div className="text-xs text-red-700 dark:text-red-400 break-all font-mono">
                                {offlineStatus.stats.lastError}
                              </div>
                              <div className="text-xs text-red-600 dark:text-red-400 mt-2">
                                لو الجداول لسه ما اتعملتش على Supabase، شغّل ملف{' '}
                                <code className="bg-red-100 dark:bg-red-900/40 px-1 rounded">offline-mode-system.sql</code>{' '}
                                الأول، وبعدين اضغط &quot;إرسال يدوي&quot;.
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-3 gap-2">
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          البيانات بتتمسح تلقائياً بعد ٦٠ يوم - بنخزن الإجمالي بس
                        </p>
                        <button
                          onClick={flushSyncQueue}
                          disabled={flushingSync}
                          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors duration-200 disabled:opacity-50 shrink-0"
                        >
                          {flushingSync ? (
                            <>
                              <svg {...stroke} className="w-3.5 h-3.5 animate-spin" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              جاري...
                            </>
                          ) : (
                            <>
                              <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              إرسال يدوي
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* License Selection Form */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 space-y-5">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                  <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                  </svg>
                  {t('settingsPage.license.selectGymAndBranch')}
                </h3>

                {/* Debug Info */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      {t('settingsPage.license.diagnosticInfo')}
                    </span>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/license/test')
                          const data = await res.json()
                          toast.info(`Test Result:\nGyms: ${data.gyms?.count || 0}\nBranches: ${data.branches?.count || 0}\nCheck console for details`)
                        } catch (err) {
                          console.error('Test failed:', err)
                          toast.error('Test failed - check console')
                        }
                      }}
                      className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors duration-200"
                    >
                      {t('settingsPage.license.testConnection')}
                    </button>
                  </div>
                  <div className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
                    <div>{t('settingsPage.license.loadedGymsCount')}: <span className="font-bold">{gyms.length}</span></div>
                    <div>{t('settingsPage.license.loadingStatus')}: <span className="font-bold">{loadingGyms ? t('settingsPage.license.loading') : t('settingsPage.license.complete')}</span></div>
                    <div>{t('settingsPage.license.userRole')}: <span className="font-bold">{user?.role || t('settingsPage.license.undefined')}</span></div>
                  </div>
                </div>

                {/* Gym Selection */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('settingsPage.license.gymLabel')}
                  </label>
                  <select
                    value={selectedGymId}
                    onChange={(e) => handleGymChange(e.target.value)}
                    disabled={loadingGyms}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 disabled:opacity-50"
                  >
                    <option value="">{t('settingsPage.license.selectGym')}</option>
                    {gyms.map(gym => (
                      <option key={gym.id} value={gym.id}>
                        {gym.name_ar || gym.name_en}
                      </option>
                    ))}
                  </select>
                  {loadingGyms && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5">جاري التحميل...</p>}
                  {!loadingGyms && gyms.length === 0 && (
                    <p className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400 mt-1.5">
                      <svg {...stroke} className="w-4 h-4 flex-shrink-0" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                      </svg>
                      لم يتم تحميل أي صالات - تحقق من الكونسول
                    </p>
                  )}
                </div>

                {/* Branch Selection */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    الفرع *
                  </label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    disabled={!selectedGymId || loadingBranches}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 disabled:opacity-50"
                  >
                    <option value="">-- اختر الفرع --</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name_ar || branch.name_en}
                        {branch.system_license === true || branch.system_license === 'true' ? ' ✓' : ' (منتهي)'}
                      </option>
                    ))}
                  </select>
                  {loadingBranches && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5">جاري تحميل الفروع...</p>}
                </div>

                {/* Save Button */}
                <div className="pt-2">
                  <button
                    onClick={saveLicenseSelection}
                    disabled={!selectedGymId || !selectedBranchId || savingLicense}
                    className="w-full bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold py-2.5 px-4 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {savingLicense ? (
                      <>
                        <svg {...stroke} className="w-5 h-5 animate-spin" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>جاري الحفظ...</span>
                      </>
                    ) : (
                      <>
                        <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                        <span>حفظ الاختيار</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Info Note */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-900/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg {...stroke} className="w-5 h-5 text-blue-700 dark:text-blue-300 flex-shrink-0 mt-0.5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                    </svg>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      <p className="font-bold mb-1">ملاحظة:</p>
                      <p>• يجب اختيار الصالة والفرع الصحيح لتفعيل الرخصة</p>
                      <p>• سيتم التحقق من حالة الترخيص تلقائياً كل 8 ساعات</p>
                      <p>• في حالة انقطاع الإنترنت، سيعمل النظام بالترخيص المحفوظ</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'database' && user?.role === 'OWNER' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                    <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.database.title')}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('settingsPage.database.description')}</p>
                  </div>
                </div>
              </div>

              {/* ☁️ النسخ الاحتياطي السحابي (Backblaze B2) — كارت مستقل للأونر */}
              <CloudBackupCard />

              {/* استعادة قاعدة البيانات */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 space-y-5">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  {t('settingsPage.database.restore')}
                </h3>

                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <svg {...stroke} className="w-5 h-5 text-amber-700 dark:text-amber-300" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    <h4 className="font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.database.warningTitle')}</h4>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{t('settingsPage.database.warningText')}</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('settingsPage.database.uploadLabel')}</label>
                  <input
                    type="file"
                    accept=".db,.bak,.gz"
                    onChange={handleDbUpload}
                    disabled={dbUploading}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 disabled:opacity-50"
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{t('settingsPage.database.uploadDesc')}</p>
                </div>

                {dbUploading && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-900/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <svg {...stroke} className="w-5 h-5 animate-spin text-blue-700 dark:text-blue-300" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="text-gray-700 dark:text-gray-300">{t('settingsPage.database.uploading')}</span>
                    </div>
                  </div>
                )}

                {dbUploadResult?.success && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 rounded-lg flex items-start gap-2">
                    <svg {...stroke} className="w-5 h-5 text-green-700 dark:text-green-300 flex-shrink-0 mt-0.5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <p className="text-green-800 dark:text-green-200">{dbUploadResult.success}</p>
                  </div>
                )}

                {dbUploadResult?.error && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 rounded-lg flex items-start gap-2">
                    <svg {...stroke} className="w-5 h-5 text-red-700 dark:text-red-300 flex-shrink-0 mt-0.5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                    <p className="text-red-800 dark:text-red-200">{dbUploadResult.error}</p>
                  </div>
                )}
              </div>

              {/* مزامنة قاعدة البيانات - All-in-One */}
              {syncMessage && (
                <div className={`p-4 rounded-xl ring-1 ${syncMessage.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 ring-green-200 dark:ring-green-900/50' : 'bg-red-50 dark:bg-red-900/20 ring-red-200 dark:ring-red-900/50'}`}>
                  <div className="flex items-start gap-3">
                    <svg {...stroke} className={`w-6 h-6 flex-shrink-0 mt-0.5 ${syncMessage.type === 'success' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`} aria-hidden="true">
                      {syncMessage.type === 'success' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                      )}
                    </svg>
                    <div className="flex-1">
                      <p className={`text-sm whitespace-pre-line ${syncMessage.type === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>{syncMessage.text}</p>
                    </div>
                    <button
                      onClick={() => setSyncMessage(null)}
                      aria-label="Dismiss"
                      className="inline-flex items-center justify-center w-8 h-8 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
                    >
                      <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 space-y-5">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  مزامنة قاعدة البيانات (الكل في واحد)
                </h3>

                <div className="p-4 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg">
                  <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                    </svg>
                    ماذا يفعل هذا الزر؟
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    زر واحد يقوم بجميع عمليات التحديث بشكل تلقائي:
                  </p>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 ms-4">
                    <li className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-bold flex-shrink-0">1</span>
                      <span><strong>إصلاح الصلاحيات:</strong> يتحقق من صلاحيات قاعدة البيانات ويصلحها تلقائياً</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex-shrink-0">2</span>
                      <span><strong>مزامنة Schema:</strong> يطبق التغييرات من schema.prisma على قاعدة البيانات</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-bold flex-shrink-0">3</span>
                      <span><strong>تطبيق Migrations:</strong> يشغل جميع التحديثات الجديدة من مجلد migrations/</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-xs font-bold flex-shrink-0">4</span>
                      <span><strong>تحديث Prisma Client:</strong> يولد Prisma Client الجديد للتعامل مع قاعدة البيانات</span>
                    </li>
                  </ul>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-900/50 rounded-lg">
                  <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <svg {...stroke} className="w-5 h-5 text-blue-700 dark:text-blue-300" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                    </svg>
                    متى تستخدم هذا الزر؟
                  </h4>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 ms-4">
                    <li>• بعد تحديث النظام لإصدار جديد</li>
                    <li>• إذا ظهرت رسالة خطأ: &quot;attempt to write a readonly database&quot;</li>
                    <li>• إذا ظهرت رسالة خطأ عن جدول أو عمود مفقود</li>
                    <li>• لتفعيل مزايا جديدة تحتاج تحديثات في قاعدة البيانات</li>
                    <li>• عند مواجهة أي مشكلة في قاعدة البيانات</li>
                  </ul>
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 rounded-lg">
                  <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <svg {...stroke} className="w-5 h-5 text-amber-700 dark:text-amber-300" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    قبل الضغط على الزر:
                  </h4>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 ms-4">
                    <li>• أغلق Prisma Studio إذا كان مفتوحاً</li>
                    <li>• أغلق أي برامج أخرى تستخدم قاعدة البيانات</li>
                    <li>• في Mac: قد تحتاج منح Full Disk Access للتطبيق في إعدادات النظام</li>
                  </ul>
                </div>

                <button
                  onClick={handleSyncDatabase}
                  disabled={syncingDatabase}
                  className="w-full px-4 py-3 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {syncingDatabase ? (
                    <>
                      <svg {...stroke} className="w-5 h-5 animate-spin" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>جاري المزامنة... (قد يستغرق دقيقة)</span>
                    </>
                  ) : (
                    <>
                      <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
                      </svg>
                      <span>مزامنة وتحديث قاعدة البيانات (الكل في واحد)</span>
                    </>
                  )}
                </button>

                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    <strong>آمن تماماً:</strong> هذا الزر يقوم بجميع العمليات بالترتيب الصحيح ولن يؤثر على بياناتك الموجودة. إذا فشلت أي خطوة، سيتوقف تلقائياً ويعرض رسالة الخطأ. يُنصح بتطبيق التحديثات بعد كل تحديث للنظام.
                  </p>
                </div>
              </div>

              {/* تنظيف وتصغير ملف قاعدة البيانات (VACUUM) */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 space-y-4">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m7.875 14.25 1.214 1.942a2.25 2.25 0 0 0 1.908 1.058h2.006c.776 0 1.497-.4 1.908-1.058l1.214-1.942M2.41 9h4.636a2.25 2.25 0 0 1 1.872 1.002l.164.246a2.25 2.25 0 0 0 1.872 1.002h2.092a2.25 2.25 0 0 0 1.872-1.002l.164-.246A2.25 2.25 0 0 1 16.954 9h4.636M2.41 9a2.25 2.25 0 0 0-.16.832V12a2.25 2.25 0 0 0 2.25 2.25h15a2.25 2.25 0 0 0 2.25-2.25V9.832c0-.287-.055-.57-.16-.832M2.41 9a2.25 2.25 0 0 1 .382-.632l3.285-3.832a2.25 2.25 0 0 1 1.708-.786h8.43c.66 0 1.288.29 1.708.786l3.285 3.832c.163.19.291.404.382.632M4.5 20.25h15A2.25 2.25 0 0 0 21.75 18v-2.625c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125V18a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  <span>تنظيف وتصغير ملف قاعدة البيانات</span>
                </h3>

                <div className="p-4 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg space-y-2">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    مع مرور الوقت، ملف قاعدة البيانات بيحتوي على صفحات فارغة (free pages) ناتجة عن الحذف والتعديل.
                    الزر ده بيشغّل <strong>VACUUM</strong> اللي بيعيد بناء الملف بدون الصفحات الفاضية — بيصغّر الحجم بنسبة 50-90% أحياناً.
                  </p>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    <li className="flex items-start gap-1.5">
                      <svg {...stroke} className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      آمن تماماً — البيانات بتفضل زي ما هي.
                    </li>
                    <li className="flex items-start gap-1.5">
                      <svg {...stroke} className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      بيعمل فحص سلامة (integrity check) قبل التنظيف، ولو الملف فيه مشكلة بيوقف.
                    </li>
                    <li className="flex items-start gap-1.5">
                      <svg {...stroke} className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                      </svg>
                      يُفضَّل عمل Backup (من زر النسخ الاحتياطي) قبل تنظيف الملف الأساسي.
                    </li>
                  </ul>
                </div>

                {loadingDbFiles ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <svg {...stroke} className="w-4 h-4 animate-spin" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    جاري تحميل قائمة الملفات...
                  </div>
                ) : dbFiles.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 px-2">
                      <span>عدد الملفات: <strong>{dbFiles.length}</strong></span>
                      <span>الحجم الإجمالي: <strong>{dbFilesTotalMB} MB</strong></span>
                    </div>

                    <div className="ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 uppercase text-xs">
                          <tr>
                            <th className="px-3 py-3 text-start font-bold">الملف</th>
                            <th className="px-3 py-3 text-start font-bold">الحجم</th>
                            <th className="px-3 py-3 text-start font-bold">آخر تعديل</th>
                            <th className="px-3 py-3 text-start font-bold">الإجراء</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                          {dbFiles.map((f) => (
                            <tr key={f.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-900 dark:text-gray-200 font-mono text-xs">{f.name}</span>
                                  {f.isLive && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">الأساسي</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{f.sizeMB} MB</td>
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">
                                {new Date(f.modified).toLocaleString()}
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => handleOptimizeDb(f.name)}
                                  disabled={optimizingDb}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-500 hover:bg-primary-600 text-primary-contrast rounded-lg font-bold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m7.875 14.25 1.214 1.942a2.25 2.25 0 0 0 1.908 1.058h2.006c.776 0 1.497-.4 1.908-1.058l1.214-1.942M2.41 9h4.636a2.25 2.25 0 0 1 1.872 1.002l.164.246a2.25 2.25 0 0 0 1.872 1.002h2.092a2.25 2.25 0 0 0 1.872-1.002l.164-.246A2.25 2.25 0 0 1 16.954 9h4.636" />
                                  </svg>
                                  تنظيف
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600 dark:text-gray-400">مفيش ملفات.</div>
                )}

                {optimizeMessage && (
                  <div
                    className={`p-3 rounded-lg text-sm whitespace-pre-line font-mono ring-1 ${
                      optimizeMessage.type === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 ring-green-200 dark:ring-green-900/50 text-green-800 dark:text-green-300'
                        : 'bg-red-50 dark:bg-red-900/20 ring-red-200 dark:ring-red-900/50 text-red-800 dark:text-red-300'
                    }`}
                  >
                    {optimizeMessage.text}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => handleOptimizeDb('gym.db')}
                    disabled={optimizingDb}
                    className="flex-1 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {optimizingDb ? (
                      <>
                        <svg {...stroke} className="w-5 h-5 animate-spin" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>جاري التنظيف...</span>
                      </>
                    ) : (
                      <>
                        <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m7.875 14.25 1.214 1.942a2.25 2.25 0 0 0 1.908 1.058h2.006c.776 0 1.497-.4 1.908-1.058l1.214-1.942M2.41 9h4.636a2.25 2.25 0 0 1 1.872 1.002l.164.246a2.25 2.25 0 0 0 1.872 1.002h2.092a2.25 2.25 0 0 0 1.872-1.002l.164-.246A2.25 2.25 0 0 1 16.954 9h4.636" />
                        </svg>
                        <span>تنظيف الملف الأساسي (gym.db)</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleOptimizeDb(undefined, true)}
                    disabled={optimizingDb || dbFiles.filter((f) => !f.isLive).length === 0}
                    className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-800 text-white font-bold rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                    </svg>
                    <span>تنظيف كل النسخ القديمة ({dbFiles.filter((f) => !f.isLive).length})</span>
                  </button>
                </div>
              </div>

              {/* تنظيف قاعدة البيانات (نقل صور base64 لملفات) */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 space-y-4">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                  </svg>
                  تنظيف قاعدة البيانات (الصور القديمة)
                </h3>

                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 rounded-lg text-sm">
                  <p className="font-bold mb-2 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <svg {...stroke} className="w-4 h-4 text-amber-700 dark:text-amber-300" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                    </svg>
                    ايه ده؟
                  </p>
                  <p className="text-gray-700 dark:text-gray-200 leading-relaxed">
                    النظام بيخزن صور الأعضاء القديمة كنصوص <strong>base64</strong> جوه قاعدة البيانات نفسها — ده بيخلي ملف <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">gym.db</code> يكبر بشكل كبير. التنظيف ده بينقل الصور دي لملفات منفصلة في فولدر <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">uploads/</code> ويرجّع حجم قاعدة البيانات لطبيعته. مفيش بيانات هتضيع.
                  </p>
                </div>

                {cleanupLoading && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg text-sm flex items-center gap-2 text-gray-700 dark:text-gray-200">
                    <svg {...stroke} className="w-4 h-4 animate-spin" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    جاري فحص حالة قاعدة البيانات...
                  </div>
                )}

                {!cleanupLoading && cleanupInfo && cleanupInfo.candidates === 0 && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 rounded-lg text-sm">
                    <p className="flex items-start gap-2 text-green-800 dark:text-green-200">
                      <svg {...stroke} className="w-5 h-5 text-green-700 dark:text-green-300 flex-shrink-0 mt-0.5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      <span>
                        قاعدة البيانات نضيفة، مفيش صور قديمة تحتاج نقل.
                        <br />
                        الحجم الحالي: <strong>{cleanupInfo.currentDbSizeMb} MB</strong>
                      </span>
                    </p>
                  </div>
                )}

                {!cleanupLoading && cleanupInfo && cleanupInfo.candidates > 0 && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 rounded-lg text-sm">
                    <p className="font-bold mb-2 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <svg {...stroke} className="w-4 h-4 text-amber-700 dark:text-amber-300" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                      </svg>
                      وُجدت بيانات قديمة:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-amber-900 dark:text-amber-200">
                      <li>عدد الصور القديمة: <strong>{cleanupInfo.candidates}</strong></li>
                      <li>الحجم في قاعدة البيانات: <strong>{cleanupInfo.estimatedBase64Mb} MB</strong></li>
                      <li>الحجم الكلي لـ <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">gym.db</code>: <strong>{cleanupInfo.currentDbSizeMb} MB</strong></li>
                      <li>الحجم المتوقع بعد التنظيف: <strong>~{Math.max(0.5, +(cleanupInfo.currentDbSizeMb - cleanupInfo.estimatedBase64Mb).toFixed(1))} MB</strong></li>
                    </ul>
                  </div>
                )}

                {cleanupResult && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 rounded-lg text-sm">
                    <p className="font-bold mb-2 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <svg {...stroke} className="w-4 h-4 text-green-700 dark:text-green-300" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                      </svg>
                      نتيجة آخر عملية تنظيف:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-green-900 dark:text-green-200">
                      <li>تم نقل: <strong>{cleanupResult.migrated}</strong> صورة</li>
                      {cleanupResult.failed > 0 && (
                        <li>فشل: <strong>{cleanupResult.failed}</strong> صورة</li>
                      )}
                      <li>قبل: <strong>{cleanupResult.before.mb} MB</strong> ← بعد: <strong>{cleanupResult.after.mb} MB</strong></li>
                      <li>وفّرت: <strong>{cleanupResult.saved.mb} MB</strong> ({cleanupResult.saved.percent}%)</li>
                      {cleanupResult.backup && (
                        <li>النسخة الاحتياطية: <code className="bg-green-100 dark:bg-green-900/40 px-1 rounded text-xs">{cleanupResult.backup.filename}</code></li>
                      )}
                    </ul>
                    {cleanupResult.vacuumError && (
                      <p className="mt-3 flex items-start gap-2 text-amber-800 dark:text-amber-300">
                        <svg {...stroke} className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                        <span>تحذير: VACUUM فشل ({cleanupResult.vacuumError}). البيانات اتنقلت بس الحجم ما اتقللش — اعمل &quot;تنظيف الملف الأساسي&quot; يدوياً من الـ section اللي فوق.</span>
                      </p>
                    )}
                    {cleanupResult.failures.length > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-amber-700 dark:text-amber-400 font-bold">عرض الأعضاء اللي فشل نقلهم ({cleanupResult.failures.length})</summary>
                        <ul className="mt-2 ms-4 space-y-1 text-xs text-gray-700 dark:text-gray-300">
                          {cleanupResult.failures.map((f) => (
                            <li key={f.id}>
                              <strong>{f.name}</strong> ({f.id.slice(0, 8)}…): {f.reason}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}

                <button
                  onClick={handleRunCleanup}
                  disabled={cleanupRunning || cleanupLoading || !cleanupInfo || cleanupInfo.candidates === 0}
                  className="w-full px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {cleanupRunning ? (
                    <>
                      <svg {...stroke} className="w-5 h-5 animate-spin" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>جاري التنظيف... (ممكن ياخد دقيقة أو اتنين)</span>
                    </>
                  ) : (
                    <>
                      <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
                      </svg>
                      <span>ابدأ التنظيف</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

          {activeSection === 'apply-features' && user?.role === 'OWNER' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                    <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">تطبيق مميزات الباقات على الأعضاء</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      السكريبت بيمشي على كل الأعضاء اللي عندهم باقة محفوظة، ويطبق عليهم الحصص + الفريز + الدعوات + InBody.
                    </p>
                  </div>
                </div>
              </div>

              {/* مميزات اشتراك PT */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                  <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.115 5.19l.319 1.913A6 6 0 0 0 8.11 10.36L9.75 12l-.387.775c-.217.433-.132.956.21 1.298l1.348 1.348c.21.21.329.497.329.795v1.089c0 .426.24.815.622 1.006l.153.076c.433.217.956.132 1.298-.21l.723-.723a8.7 8.7 0 0 0 2.288-4.042 1.087 1.087 0 0 0-.358-1.099l-1.33-1.108c-.32-.267-.526-.65-.578-1.064l-.111-.857a.972.972 0 0 0-.575-.766 1.21 1.21 0 0 1-.518-.396l-.394-.522a1.13 1.13 0 0 0-1.299-.38l-1.328.475a4.5 4.5 0 0 1-1.679.215 11.21 11.21 0 0 1-.45-2.069M3.75 12C3.75 6.96 7.96 2.75 13 2.75c5.04 0 9.25 4.21 9.25 9.25 0 5.04-4.21 9.25-9.25 9.25-5.04 0-9.25-4.21-9.25-9.25Z" />
                  </svg>
                  <span>مميزات اشتراك PT</span>
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                  تفعيل مميزات إضافية على اشتراكات الـ PT (الفريز والترقية). الزرارين بيظهروا في كروت الـ PT بعد التفعيل.
                </p>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/40 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center flex-shrink-0">
                        <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m9-9H3M5.636 5.636l12.728 12.728M18.364 5.636L5.636 18.364" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-gray-100">فريز اشتراك PT</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">السماح بتجميد اشتراك الـ PT لعدد أيام محدد ومدّ تاريخ الانتهاء.</p>
                      </div>
                    </div>
                    <label className="toggle-switch toggle-green">
                      <input
                        type="checkbox"
                        checked={!!serviceSettings.ptFreezeEnabled}
                        onChange={() => updateSetting('ptFreezeEnabled', !serviceSettings.ptFreezeEnabled)}
                      />
                      <span className="toggle-track"><span className="toggle-thumb"></span></span>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/40 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                        <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-gray-100">ترقية باقة PT</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">السماح بترقية باقة الـ PT لباقة أعلى مع حساب فرق السعر وإصدار إيصال.</p>
                      </div>
                    </div>
                    <label className="toggle-switch toggle-green">
                      <input
                        type="checkbox"
                        checked={!!serviceSettings.ptUpgradeEnabled}
                        onChange={() => updateSetting('ptUpgradeEnabled', !serviceSettings.ptUpgradeEnabled)}
                      />
                      <span className="toggle-track"><span className="toggle-thumb"></span></span>
                    </label>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={saveServiceSettings}
                    disabled={isSaving}
                    className="bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                  >
                    {isSaving ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-900/50 rounded-lg">
                  <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <svg {...stroke} className="w-5 h-5 text-blue-700 dark:text-blue-300" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                    </svg>
                    إزاي بيعرف الباقة بتاعت العضو؟
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    لما تضيف عضو جديد (أو تجدد) وتختار باقة من الفورم، الباقة بتتخزن على العضو (<code className="text-xs">offerId</code>).
                    الزرار ده بيمشي على كل عضو عنده باقة محفوظة، يجيب الباقة من جدول العروض، ويطبق مميزاتها.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-900/50 rounded-lg">
                    <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      وضع آمن (الأعضاء الجدد بس)
                    </h4>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mb-3">
                      يطبق المميزات بس على الأعضاء اللي الحصص/الفريز/الدعوات بتاعتهم لسه 0.
                      مش هيلمس أي عضو مستخدم حصصه بالفعل.
                    </p>
                    <button
                      onClick={() => setApplyFeaturesConfirm('fresh')}
                      disabled={applyingFeatures}
                      className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {applyingFeatures ? (
                        <svg {...stroke} className="w-5 h-5 animate-spin" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : (
                        <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                        </svg>
                      )}
                      <span>تطبيق على الأعضاء الجدد</span>
                    </button>
                  </div>

                  <div className="p-4 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 rounded-lg">
                    <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                      <svg {...stroke} className="w-4 h-4 text-red-700 dark:text-red-300" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                      </svg>
                      استبدال القيم (لكل الأعضاء)
                    </h4>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mb-3">
                      يستبدل الحصص/الفريز/الدعوات الحالية بقيم الباقة. مفيد بعد استيراد جديد.
                      <strong className="text-red-700 dark:text-red-300"> خطر:</strong> هيمسح الاستخدام الحالي.
                    </p>
                    <button
                      onClick={() => setApplyFeaturesConfirm('force')}
                      disabled={applyingFeatures}
                      className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {applyingFeatures ? (
                        <svg {...stroke} className="w-5 h-5 animate-spin" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : (
                        <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      )}
                      <span>استبدال لكل الأعضاء</span>
                    </button>
                  </div>
                </div>

                {applyFeaturesError && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 rounded-lg flex items-start gap-2">
                    <svg {...stroke} className="w-5 h-5 text-red-700 dark:text-red-300 flex-shrink-0 mt-0.5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                    <p className="text-red-800 dark:text-red-200 font-bold">{applyFeaturesError}</p>
                  </div>
                )}

                {applyFeaturesResult && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 rounded-lg space-y-3">
                    <h4 className="font-bold text-green-800 dark:text-green-200 flex items-center gap-2">
                      <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      <span>تم — النتيجة:</span>
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 ring-1 ring-gray-200 dark:ring-gray-700">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">اتعالج</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{applyFeaturesResult.processed}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 ring-1 ring-emerald-200 dark:ring-emerald-900/50">
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">اتحدّث</p>
                        <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">{applyFeaturesResult.updated}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 ring-1 ring-amber-200 dark:ring-amber-900/50">
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">اتخطّى</p>
                        <p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-300">{applyFeaturesResult.skipped}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 ring-1 ring-red-200 dark:ring-red-900/50">
                        <p className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">مفيش باقة بنفس المدة</p>
                        <p className="mt-1 text-2xl font-bold text-red-700 dark:text-red-300">{applyFeaturesResult.noDurationMatch}</p>
                      </div>
                    </div>

                    {applyFeaturesResult.results.length > 0 && (
                      <details className="bg-white dark:bg-gray-800 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
                        <summary className="px-4 py-2 cursor-pointer text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/40 rounded-lg">
                          عرض تفاصيل كل عضو ({applyFeaturesResult.results.length})
                        </summary>
                        <div className="max-h-96 overflow-y-auto border-t border-gray-200 dark:border-gray-700">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 uppercase sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-start font-bold">رقم العضوية</th>
                                <th className="px-3 py-2 text-start font-bold">الاسم</th>
                                <th className="px-3 py-2 text-start font-bold">الحالة</th>
                                <th className="px-3 py-2 text-start font-bold">السبب</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                              {applyFeaturesResult.results.map((r, i) => (
                                <tr key={r.memberId + i} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                                  <td className="px-3 py-1.5 font-mono text-gray-700 dark:text-gray-300">{r.memberNumber || '—'}</td>
                                  <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{r.name}</td>
                                  <td className="px-3 py-1.5">
                                    {r.status === 'updated' && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">اتحدّث</span>}
                                    {r.status === 'skipped' && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">اتخطّى</span>}
                                    {r.status === 'no-duration-match' && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">مفيش باقة بنفس المدة</span>}
                                  </td>
                                  <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{r.reason || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    )}
                  </div>
                )}

                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    <strong>إزاي بيشتغل:</strong> السكريبت بيطابق كل عضو بالباقة المناسبة بناءً على <strong>مدة الاشتراك</strong> (الفرق بين تاريخ البداية والنهاية) مع تسامح ±3 أيام —
                    يعني عضو مشترك 28 أو 29 أو 30 أو 31 يوم بياخد مميزات الباقة الشهرية تلقائياً، حتى لو الـ <code>offerId</code> فاضي عنده.
                  </p>
                </div>
              </div>

              {applyFeaturesConfirm && (
                <div
                  className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in z-[10000] flex items-center justify-center p-4"
                  onClick={() => !applyingFeatures && setApplyFeaturesConfirm(null)}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="apply-features-confirm-title"
                  onKeyDown={(e) => { if (e.key === 'Escape' && !applyingFeatures) setApplyFeaturesConfirm(null) }}
                >
                  <div
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-md w-full overflow-hidden animate-modal-in"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className={`p-5 text-white flex items-center gap-3 ${
                        applyFeaturesConfirm === 'force'
                          ? 'bg-red-600'
                          : 'bg-emerald-600'
                      }`}
                    >
                      <svg {...stroke} className="w-7 h-7" aria-hidden="true">
                        {applyFeaturesConfirm === 'force' ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                        )}
                      </svg>
                      <h3 id="apply-features-confirm-title" className="text-xl font-bold">
                        {applyFeaturesConfirm === 'force'
                          ? 'تأكيد استبدال القيم'
                          : 'تأكيد تطبيق المميزات'}
                      </h3>
                    </div>

                    <div className="p-5 space-y-3">
                      {applyFeaturesConfirm === 'force' ? (
                        <>
                          <p className="text-gray-900 dark:text-gray-100 font-bold">
                            هل تريد تطبيق مميزات الباقات على <strong>كل الأعضاء</strong> (استبدال القيم الحالية)؟
                          </p>
                          <div className="p-3 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 rounded-lg text-sm text-red-800 dark:text-red-200">
                            القيم الحالية للحصص/الفريز/الدعوات هتتمسح وتترجع لقيم الباقة.
                            <br />
                            ده مناسب لو لسه عاملين استيراد جديد.
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-gray-900 dark:text-gray-100 font-bold">
                            تطبيق مميزات الباقات على <strong>الأعضاء الجدد</strong> (اللي قيمهم لسه 0)؟
                          </p>
                          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-900/50 rounded-lg text-sm text-emerald-800 dark:text-emerald-200">
                            مش هيلمس أي عضو مستخدم حصصه بالفعل.
                          </div>
                        </>
                      )}
                    </div>

                    <div className="px-5 py-4 bg-gray-50 dark:bg-gray-900/40 flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => setApplyFeaturesConfirm(null)}
                        disabled={applyingFeatures}
                        className="px-4 py-2.5 rounded-lg font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 disabled:opacity-50"
                      >
                        إلغاء
                      </button>
                      <button
                        autoFocus
                        onClick={() => handleApplyPackageFeatures(applyFeaturesConfirm)}
                        disabled={applyingFeatures}
                        className={`px-4 py-2.5 rounded-lg font-bold text-white transition-colors duration-200 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed ${
                          applyFeaturesConfirm === 'force'
                            ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500'
                            : 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500'
                        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900`}
                      >
                        {applyingFeatures && (
                          <svg {...stroke} className="w-4 h-4 animate-spin" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        )}
                        <span>{applyFeaturesConfirm === 'force' ? 'تأكيد الاستبدال' : 'تأكيد التطبيق'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === 'whatsapp' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 flex items-center justify-center flex-shrink-0">
                    <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 20l1.5-4.5A8 8 0 1112 20H7l-4 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.whatsapp.title')}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('settingsPage.whatsapp.description')}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6">
                <div className="text-center space-y-5">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-green-50 dark:bg-green-900/20 rounded-full text-green-700 dark:text-green-300">
                    <svg {...stroke} className="w-10 h-10" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {t('settingsPage.whatsapp.autoSendTitle')}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                    {t('settingsPage.whatsapp.autoSendDescription')}
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
                    <Link
                      href="/settings/whatsapp"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                    >
                      <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{t('settingsPage.whatsapp.manageButton')}</span>
                    </Link>
                  </div>

                  <div className="mt-6 p-5 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-900/50 rounded-lg text-start">
                    <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                      <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                      </svg>
                      <span>{t('settingsPage.whatsapp.availableFeatures')}</span>
                    </h4>
                    <ul className="space-y-2 text-blue-700 dark:text-blue-300 text-sm">
                      <li className="flex items-start gap-2">
                        <svg {...stroke} className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        <span>{t('settingsPage.whatsapp.featureAutoReceipts')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <svg {...stroke} className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        <span>{t('settingsPage.whatsapp.featureSubReminders')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <svg {...stroke} className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        <span>{t('settingsPage.whatsapp.featureSessionNotifications')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <svg {...stroke} className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        <span>{t('settingsPage.whatsapp.featureWelcomeMessages')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <svg {...stroke} className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        <span>{t('settingsPage.whatsapp.featureAutoFollowUp')}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'port-forwarding' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                    <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.portForwarding.title')}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('settingsPage.portForwarding.description')}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6">
                <div className="space-y-7">
                  {/* Local Network Access */}
                  <div className="text-center space-y-5">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full text-blue-700 dark:text-blue-300">
                      <svg {...stroke} className="w-10 h-10" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {t('settingsPage.portForwarding.localAccess')}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                      {t('settingsPage.portForwarding.localAccessDesc')}
                    </p>

                    {/* QR Code & URL */}
                    {isLoadingIP ? (
                      <div className="flex items-center justify-center py-8">
                        <svg {...stroke} className="w-12 h-12 animate-spin text-primary-500" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </div>
                    ) : localURL ? (
                      <div className="flex flex-col items-center gap-5">
                        {/* QR Code */}
                        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-lg ring-1 ring-blue-200 dark:ring-blue-900/50">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(localURL)}&color=2563eb&bgcolor=ffffff`}
                            alt="QR Code"
                            className="w-64 h-64 sm:w-80 sm:h-80"
                          />
                        </div>

                        {/* URL Display */}
                        <div className="w-full max-w-2xl">
                          <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl p-5 ring-1 ring-gray-200 dark:ring-gray-700">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                                  {t('settingsPage.portForwarding.localURL')}
                                </p>
                                <p className="text-lg font-mono font-bold text-blue-700 dark:text-blue-400 break-all" dir="ltr">
                                  {localURL}
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(localURL)
                                  setSaveMessage({ type: 'success', text: t('settingsPage.portForwarding.urlCopied') })
                                  setTimeout(() => setSaveMessage(null), 3000)
                                }}
                                className="flex-shrink-0 inline-flex items-center justify-center w-11 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                                aria-label={t('settingsPage.portForwarding.copyURL')}
                                title={t('settingsPage.portForwarding.copyURL')}
                              >
                                <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {localIP && (
                            <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 ring-1 ring-blue-200 dark:ring-blue-900/50">
                              <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                                <svg {...stroke} className="w-4 h-4 flex-shrink-0" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
                                </svg>
                                <span>{t('settingsPage.portForwarding.localIP')}:</span>
                                <span className="font-mono font-bold" dir="ltr">{localIP}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Refresh Button */}
                        <button
                          onClick={fetchLocalIP}
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-bold transition-colors duration-200"
                        >
                          <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>{t('settingsPage.portForwarding.refresh')}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="py-8">
                        <p className="text-gray-600 dark:text-gray-400">
                          {t('settingsPage.portForwarding.noConnection')}
                        </p>
                        <button
                          onClick={fetchLocalIP}
                          className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                        >
                          {t('settingsPage.portForwarding.tryAgain')}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Instructions */}
                  <div className="mt-6 p-5 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-900/50 rounded-xl">
                    <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-4 flex items-center gap-2 text-base">
                      <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                      </svg>
                      <span>{t('settingsPage.portForwarding.instructions.title')}</span>
                    </h4>
                    <ul className="space-y-3 text-blue-700 dark:text-blue-300 text-sm">
                      <li className="flex items-start gap-3">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex-shrink-0">1</span>
                        <span>{t('settingsPage.portForwarding.instructions.step1')}</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex-shrink-0">2</span>
                        <span>{t('settingsPage.portForwarding.instructions.step2')}</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex-shrink-0">3</span>
                        <span>{t('settingsPage.portForwarding.instructions.step3')}</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex-shrink-0">4</span>
                        <span>{t('settingsPage.portForwarding.instructions.step4')}</span>
                      </li>
                    </ul>

                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 rounded-lg">
                      <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300 text-sm">
                        <svg {...stroke} className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                        <p>{t('settingsPage.portForwarding.instructions.warning')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'updates' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                    <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.updates.title')}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('settingsPage.updates.description')}</p>
                  </div>
                </div>
              </div>
              <SystemUpdateSection />
            </div>
          )}

          {activeSection === 'support' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 flex items-center justify-center flex-shrink-0">
                    <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.support.title')}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('settingsPage.support.description')}</p>
                  </div>
                </div>
              </div>

              {/* Fitboost Assistant — متوفر لدينا */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0 overflow-hidden ring-1 ring-primary-100 dark:ring-primary-800">
                      <img src="/fb.png" alt="Fitboost Assistant" className="w-8 h-8 object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-900 dark:text-gray-100">Fitboost Assistant</h3>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                          {locale === 'ar' ? 'متوفر لدينا' : 'Available'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {locale === 'ar'
                          ? 'تطبيق المساعد للأجهزة لتسريع تسجيل الدخول والعمل اليومي.'
                          : 'A companion desktop app to speed up check-in and daily operations.'}
                      </p>
                    </div>
                  </div>
                  <a
                    href="https://drive.google.com/file/d/1m_NTZZf9nB13ViySPdIj4aplsZ_8p9jh/view?usp=sharing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-sm hover:shadow-md active:scale-[0.98] transition duration-200 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                  >
                    <svg {...stroke} className="w-5 h-5 transition-transform duration-200 group-hover:translate-y-0.5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-6L12 15m0 0 4.5-4.5M12 15V3" />
                    </svg>
                    {locale === 'ar' ? 'تحميل' : 'Download'}
                  </a>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-green-50 dark:bg-green-900/20 rounded-full text-green-700 dark:text-green-300">
                    <svg {...stroke} className="w-10 h-10" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('settingsPage.support.needHelp')}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{t('settingsPage.support.contactText')}</p>
                  <div className="flex items-center justify-center gap-2 text-lg font-bold text-green-700 dark:text-green-300">
                    <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                    </svg>
                    <span dir="ltr">01028518754</span>
                  </div>
                  {/* تواصل وتابعنا — أيقونات دائرية */}
                  <div className="pt-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                      {locale === 'ar' ? 'تواصل معنا' : 'Get in touch'}
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <a
                        href="https://wa.me/201028518754"
                        target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"
                        className="inline-flex items-center justify-center w-11 h-11 rounded-full text-white bg-green-600 hover:bg-green-700 hover:scale-105 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                      >
                        <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 20l1.5-4.5A8 8 0 1112 20H7l-4 0z" />
                        </svg>
                      </a>
                      <a
                        href="https://www.instagram.com/fitbo.ost?igsh=MWtwYXRlMjBmNHFnbQ"
                        target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                        className="inline-flex items-center justify-center w-11 h-11 rounded-full text-white bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-600 hover:opacity-90 hover:scale-105 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                          <rect x="3" y="3" width="18" height="18" rx="5" />
                          <circle cx="12" cy="12" r="4" />
                          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                        </svg>
                      </a>
                      <a
                        href="https://www.facebook.com/share/1Bm6LvrPMb/"
                        target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                        className="inline-flex items-center justify-center w-11 h-11 rounded-full text-white bg-[#1877F2] hover:bg-[#0f6ae0] hover:scale-105 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.9 3.78-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.9h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
                        </svg>
                      </a>
                    </div>
                  </div>

                  {/* Powered by */}
                  <div className="pt-5 mt-1 border-t border-gray-100 dark:border-gray-700/70">
                    <div className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 dark:text-gray-500 tracking-wide">
                      <span>Powered by</span>
                      <a
                        href="https://www.fitboost.website/en"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Fitboost website"
                        title="fitboost.website"
                        className="inline-flex items-center rounded-md hover:opacity-80 hover:scale-105 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                      >
                        <img src="/fb.png" alt="Fitboost" className="h-7 w-auto object-contain" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <ConfirmDialog
        isOpen={confirmState.open}
        title={confirmState.title || ''}
        message={confirmState.message}
        type={confirmState.type || 'warning'}
        onConfirm={() => {
          confirmState.onConfirm()
          setConfirmState((s) => ({ ...s, open: false }))
        }}
        onCancel={() => setConfirmState((s) => ({ ...s, open: false }))}
      />
    </div>
  )
}

// Holidays management was moved to the staff schedule calendar (app/staff/schedule/page.tsx)
