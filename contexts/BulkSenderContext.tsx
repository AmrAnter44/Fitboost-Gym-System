'use client'

//  BulkSenderContext — نظام تشغيل المُرسِل الجماعي (الإرسال الذكي) على مستوى التطبيق
//  الهدف: الإرسال يفضل شغّال + الكرة/المودالات تفضل ظاهرة حتى لو المستخدم طلع من صفحة المتابعات.
//  منطق الحلقة والتحقّق منقول كما هو من app/followups/page.tsx (handleBulkScriptStart) — بس مكان التشغيل اتغيّر.

import { createContext, useContext, useRef, useState, useCallback, ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLanguage } from './LanguageContext'
import { useToast } from './ToastContext'
import {
  getDailyCount,
  incrementDailyCount,
  saveLastSession,
  addTextVariation,
} from '../lib/bulkSender/storage'

export interface BulkConfig {
  delayMin: number
  delayMax: number
  batchSize: number
  batchBreakMin: number
  batchBreakMax: number
  dailyLimit: number
  sessionIndex: number | 'auto'
}

export interface BulkMeta {
  userName?: string
  sourceFilter: string
}

export interface BulkTarget {
  visitor: any
  contacted?: boolean
  lastContactedAt?: string
}

export interface BulkProgress {
  current: number
  total: number
  currentName: string
  currentMsgIndex: number
  successCount: number
  failCount: number
  countdown: number
}

export interface BulkReport {
  success: { name: string, phone: string }[]
  failed: { name: string, phone: string, error: string }[]
}

interface StartParams {
  targets: BulkTarget[]
  messages: string[]
  config: BulkConfig
  meta: BulkMeta
}

interface BulkSenderContextValue {
  running: boolean
  paused: boolean
  minimized: boolean
  progress: BulkProgress
  report: BulkReport | null
  config: BulkConfig | null
  messageCount: number
  start: (params: StartParams) => Promise<boolean>
  pause: () => void
  resume: () => void
  stop: () => void
  setMinimized: (v: boolean) => void
  dismissReport: () => void
  retryFailed: () => Promise<boolean>
}

const EMPTY_PROGRESS: BulkProgress = { current: 0, total: 0, currentName: '', currentMsgIndex: 0, successCount: 0, failCount: 0, countdown: 0 }

const BulkSenderContext = createContext<BulkSenderContextValue | null>(null)

export function BulkSenderProvider({ children }: { children: ReactNode }) {
  const { t, locale } = useLanguage()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [minimized, setMinimizedState] = useState(false)
  const [progress, setProgress] = useState<BulkProgress>(EMPTY_PROGRESS)
  const [report, setReport] = useState<BulkReport | null>(null)
  const [config, setConfig] = useState<BulkConfig | null>(null)
  const [messageCount, setMessageCount] = useState(0)

  const pausedRef = useRef(false)
  const abortedRef = useRef(false)
  const runningRef = useRef(false)

  //  آخر تشغيل — عشان زر "إعادة المحاولة"
  const lastMessagesRef = useRef<string[]>([])
  const lastConfigRef = useRef<BulkConfig | null>(null)
  const lastMetaRef = useRef<BulkMeta | null>(null)

  const setMinimized = useCallback((v: boolean) => setMinimizedState(v), [])

  const pause = useCallback(() => {
    pausedRef.current = true
    setPaused(true)
  }, [])

  const resume = useCallback(() => {
    pausedRef.current = false
    setPaused(false)
  }, [])

  const stop = useCallback(() => {
    abortedRef.current = true
    pausedRef.current = false
    setPaused(false)
  }, [])

  const dismissReport = useCallback(() => setReport(null), [])

  //  حلقة الإرسال — منقولة كما هي من handleBulkScriptStart
  const runLoop = useCallback(async (
    shuffled: BulkTarget[],
    validMessages: string[],
    cfg: BulkConfig,
    meta: BulkMeta,
    connectedSessionIndices: number[]
  ) => {
    const successList: { name: string, phone: string }[] = []
    const failedList: { name: string, phone: string, error: string }[] = []

    for (let i = 0; i < shuffled.length; i++) {
      // Check abort
      if (abortedRef.current) break

      // Check pause
      while (pausedRef.current && !abortedRef.current) {
        await new Promise(r => setTimeout(r, 500))
      }
      if (abortedRef.current) break

      //  Batch break - every N messages, take a longer break
      if (i > 0 && i % cfg.batchSize === 0 && !abortedRef.current) {
        const batchBreak = Math.floor(Math.random() * (cfg.batchBreakMax - cfg.batchBreakMin + 1)) + cfg.batchBreakMin
        setProgress(prev => ({ ...prev, currentName: t('followups.bulkScript.batchBreakMsg').replace('{minutes}', String(Math.ceil(batchBreak / 60))), countdown: batchBreak }))
        for (let s = batchBreak; s > 0; s--) {
          if (abortedRef.current) break
          while (pausedRef.current && !abortedRef.current) {
            await new Promise(r => setTimeout(r, 500))
          }
          if (abortedRef.current) break
          setProgress(prev => ({ ...prev, countdown: s }))
          await new Promise(r => setTimeout(r, 1000))
        }
      }

      if (abortedRef.current) break

      const visitor = shuffled[i].visitor
      const msgIndex = Math.floor(Math.random() * validMessages.length)

      setProgress(prev => ({ ...prev, current: i + 1, currentName: visitor.name, currentMsgIndex: msgIndex + 1, successCount: successList.length, failCount: failedList.length, countdown: 0 }))

      try {
        //  Apply text variation for anti-ban
        let message = validMessages[msgIndex]
          .replace(/\{name\}/g, visitor.name)
          .replace(/\{salesName\}/g, meta.userName || t('followups.bulkScript.defaultSalesName'))
          .replace(/\{phone\}/g, visitor.phone)
          .replace(/\{date\}/g, new Date().toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US'))
          .replace(/\{time\}/g, new Date().toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }))
        message = addTextVariation(message)

        const sendBody: any = { phone: visitor.phone, message }
        if (cfg.sessionIndex !== 'auto') {
          sendBody.sessionIndex = cfg.sessionIndex
        } else if (connectedSessionIndices.length > 0) {
          // Round-robin: distribute messages across connected sessions
          sendBody.sessionIndex = connectedSessionIndices[i % connectedSessionIndices.length]
        }
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sendBody)
        })
        const result = await res.json()

        if (result.success) {
          successList.push({ name: visitor.name, phone: visitor.phone })
          incrementDailyCount(1)
          // Update followup —  ما نخفيش الأخطاء، السيلز محتاج يعرف لو متابعة ضاعت
          try {
            const fuRes = await fetch('/api/visitors/followups', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                visitorId: visitor.id,
                notes: t('followups.bulkScript.scriptFollowupNote'),
                contacted: true,
                salesName: meta.userName,
                visitorData: { name: visitor.name, phone: visitor.phone, source: visitor.source }
              }),
            })
            if (!fuRes.ok) {
              const errData = await fuRes.json().catch(() => ({}))
              console.error('Followup save failed for', visitor.name, errData)
              failedList.push({
                name: visitor.name,
                phone: visitor.phone,
                error: locale === 'ar' ? 'تم الإرسال بس المتابعة ما اتسجلتش' : 'Sent but follow-up not saved'
              })
            }
          } catch (fuErr: any) {
            console.error('Followup save error for', visitor.name, fuErr)
            failedList.push({
              name: visitor.name,
              phone: visitor.phone,
              error: locale === 'ar' ? 'تم الإرسال بس المتابعة ما اتسجلتش' : 'Sent but follow-up not saved'
            })
          }
        } else {
          failedList.push({ name: visitor.name, phone: visitor.phone, error: result.error || t('followups.bulkScript.unknownError') })
        }
      } catch (error: any) {
        failedList.push({ name: visitor.name, phone: visitor.phone, error: error.message || t('followups.bulkScript.connectionError') })
      }

      // Random delay (except last)
      if (i < shuffled.length - 1 && !abortedRef.current) {
        const delay = Math.floor(Math.random() * (cfg.delayMax - cfg.delayMin + 1)) + cfg.delayMin
        for (let s = delay; s > 0; s--) {
          if (abortedRef.current) break
          while (pausedRef.current && !abortedRef.current) {
            await new Promise(r => setTimeout(r, 500))
          }
          if (abortedRef.current) break
          setProgress(prev => ({ ...prev, countdown: s, successCount: successList.length, failCount: failedList.length }))
          await new Promise(r => setTimeout(r, 1000))
        }
      }
    }

    // Done - Save session info
    saveLastSession(successList.length, meta.sourceFilter)
    runningRef.current = false
    setRunning(false)
    //  لما الإرسال يخلص، نلغي الـ minimize عشان report يظهر كامل
    setMinimizedState(false)
    setProgress(prev => ({ ...prev, countdown: 0, successCount: successList.length, failCount: failedList.length }))
    setReport({ success: successList, failed: failedList })
    await queryClient.invalidateQueries({ queryKey: ['followups'] })
    await queryClient.invalidateQueries({ queryKey: ['visitors-followups'] })
  }, [t, locale, queryClient])

  //  بدء الإرسال — التحقّق + التجهيز ثم إطلاق runLoop بدون await (fire-and-forget)
  const start = useCallback(async (params: StartParams): Promise<boolean> => {
    const { messages, config: cfg, meta } = params

    if (runningRef.current) {
      toast.error(locale === 'ar' ? 'فيه إرسال شغّال بالفعل' : 'A send is already running')
      return false
    }

    const validMessages = messages.filter(m => m.trim())
    if (validMessages.length === 0) {
      toast.error(t('followups.bulkScript.toast.writeMessage'))
      return false
    }

    // Daily limit check
    const dailySent = getDailyCount()
    const remaining = cfg.dailyLimit - dailySent
    if (remaining <= 0) {
      toast.error(t('followups.bulkScript.toast.dailyLimitReached').replace('{limit}', String(cfg.dailyLimit)))
      return false
    }

    let targets = params.targets
    if (targets.length === 0) {
      toast.error(t('followups.bulkScript.toast.noTargets'))
      return false
    }

    // Limit targets to daily remaining
    if (targets.length > remaining) {
      targets = targets.slice(0, remaining)
      toast.warning(t('followups.bulkScript.toast.limitedSend').replace('{count}', String(remaining)))
    }

    // Check WhatsApp & get connected sessions for round-robin
    let connectedSessionIndices: number[] = []
    try {
      const sessionsRes = await fetch('/api/whatsapp/sessions')
      if (sessionsRes.ok) {
        const sessions = await sessionsRes.json() as { sessionIndex: number; isReady: boolean }[]
        connectedSessionIndices = sessions.filter((s: any) => s.isReady).map((s: any) => s.sessionIndex)
      }
      if (connectedSessionIndices.length === 0) {
        toast.error(t('followups.bulkScript.toast.whatsappNotConnected'))
        return false
      }
    } catch {
      toast.error(t('followups.bulkScript.toast.whatsappNotConnected'))
      return false
    }

    // Fisher-Yates shuffle
    const shuffled = [...targets]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    //  خزّن آخر تشغيل عشان الـ retry
    lastMessagesRef.current = validMessages
    lastConfigRef.current = cfg
    lastMetaRef.current = meta

    // Set running state
    runningRef.current = true
    setConfig(cfg)
    setMessageCount(validMessages.length)
    setRunning(true)
    setPaused(false)
    pausedRef.current = false
    abortedRef.current = false
    setReport(null)
    setMinimizedState(false)
    setProgress({ ...EMPTY_PROGRESS, total: shuffled.length })

    //  إطلاق الحلقة بدون await — تكمل في الخلفية
    void runLoop(shuffled, validMessages, cfg, meta, connectedSessionIndices)
    return true
  }, [t, locale, toast, runLoop])

  //  إعادة المحاولة للأرقام اللي فشلت — بنفس رسائل/إعدادات آخر تشغيل
  const retryFailed = useCallback(async (): Promise<boolean> => {
    if (!report || report.failed.length === 0) return false
    const cfg = lastConfigRef.current
    const meta = lastMetaRef.current
    if (!cfg || !meta) return false
    const targets: BulkTarget[] = report.failed.map(f => ({
      visitor: { id: `retry-${f.phone}`, name: f.name, phone: f.phone, source: 'retry', status: 'pending' }
    }))
    return start({ targets, messages: lastMessagesRef.current, config: cfg, meta })
  }, [report, start])

  const value: BulkSenderContextValue = {
    running,
    paused,
    minimized,
    progress,
    report,
    config,
    messageCount,
    start,
    pause,
    resume,
    stop,
    setMinimized,
    dismissReport,
    retryFailed,
  }

  return <BulkSenderContext.Provider value={value}>{children}</BulkSenderContext.Provider>
}

export function useBulkSender() {
  const ctx = useContext(BulkSenderContext)
  if (!ctx) throw new Error('useBulkSender must be used within BulkSenderProvider')
  return ctx
}
