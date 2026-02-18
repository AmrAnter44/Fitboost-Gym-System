'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { safeStorage } from '../../lib/safeStorage'

export interface MessageTemplate {
  id: string
  title: string
  icon: string
  message: string
  isCustom: boolean
}

interface MessageTemplateManagerProps {
  onClose: () => void
  onSelect: (template: MessageTemplate) => void
  visitorName: string
  salesName?: string
  visitorPhone: string
}

const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: 'first-contact',
    title: 'تواصل أول',
    icon: '👋',
    message: `مرحباً {name}! 🏋️\n\nشكراً لزيارتك لـ Gym System\nنتمنى نشوفك قريب معانا!\n\nلو عندك أي استفسار، أنا هنا 😊`,
    isCustom: false
  },
  {
    id: 'followup',
    title: 'متابعة عادية',
    icon: '📞',
    message: `السلام عليكم يا {name}! ☀️\n\nأنا {salesName} من Gym System\nحابب أطمن عليك وأعرف رأيك في الجيم؟\n\nمستني ردك 😊`,
    isCustom: false
  },
  {
    id: 'offer',
    title: 'عرض خاص',
    icon: '🎁',
    message: `يا {name}! 🔥\n\nعندنا عرض خاص ليك النهاردة!\nاشترك دلوقتي واستمتع بأفضل الأسعار 💪\n\nتعال كلمنا!`,
    isCustom: false
  },
  {
    id: 'interested',
    title: 'رد على مهتم',
    icon: '✅',
    message: `عظيم يا {name}! 🎯\n\nسعيد باهتمامك 💚\nتعال النهاردة وابدأ رحلتك معانا!\n\nمستنيك 🏋️‍♂️`,
    isCustom: false
  }
]

export default function MessageTemplateManager({
  onClose,
  onSelect,
  visitorName,
  salesName,
  visitorPhone
}: MessageTemplateManagerProps) {
  const { direction, t } = useLanguage()
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    icon: '💬',
    message: ''
  })

  // تحميل القوالب من localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return

    const saved = safeStorage.getItem('whatsapp-templates')
    if (saved) {
      try {
        const savedTemplates = JSON.parse(saved)
        // إذا كانت القوالب المحفوظة عبارة عن array ويحتوي على عناصر
        if (Array.isArray(savedTemplates) && savedTemplates.length > 0) {
          setTemplates(savedTemplates)
        } else {
          setTemplates(DEFAULT_TEMPLATES)
        }
      } catch (e) {
        setTemplates(DEFAULT_TEMPLATES)
      }
    } else {
      setTemplates(DEFAULT_TEMPLATES)
    }
  }, [])

  // حفظ جميع القوالب في localStorage
  const saveCustomTemplates = (allTemplates: MessageTemplate[]) => {
    // حفظ جميع القوالب (المعدلة والمخصصة)
    safeStorage.setItem('whatsapp-templates', JSON.stringify(allTemplates))
  }

  // استبدال المتغيرات في النص
  const replaceVariables = (text: string): string => {
    return text
      .replace(/\{name\}/g, visitorName)
      .replace(/\{salesName\}/g, salesName || t('followups.templates.variables.salesName'))
      .replace(/\{phone\}/g, visitorPhone)
      .replace(/\{date\}/g, new Date().toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US'))
      .replace(/\{time\}/g, new Date().toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }))
  }

  const handleAddNew = () => {
    setEditingTemplate(null)
    setFormData({ title: '', icon: '💬', message: '' })
    setShowForm(true)
  }

  const handleEdit = (template: MessageTemplate) => {
    setEditingTemplate(template)
    setFormData({
      title: template.title,
      icon: template.icon,
      message: template.message
    })
    setShowForm(true)
  }

  const handleDelete = (template: MessageTemplate) => {
    if (confirm(t('followups.templates.deleteConfirm'))) {
      const newTemplates = templates.filter(t => t.id !== template.id)
      setTemplates(newTemplates)
      saveCustomTemplates(newTemplates)
    }
  }

  const handleSave = () => {
    if (!formData.title.trim() || !formData.message.trim()) {
      // يمكن استخدام toast هنا عند الحاجة
      console.error(t('followups.templates.form.fillAllFields'))
      return
    }

    if (editingTemplate) {
      // تعديل قالب موجود
      const newTemplates = templates.map(t =>
        t.id === editingTemplate.id
          ? { ...t, title: formData.title, icon: formData.icon, message: formData.message }
          : t
      )
      setTemplates(newTemplates)
      saveCustomTemplates(newTemplates)
    } else {
      // إضافة قالب جديد
      const newTemplate: MessageTemplate = {
        id: `custom-${Date.now()}`,
        title: formData.title,
        icon: formData.icon,
        message: formData.message,
        isCustom: true
      }
      const newTemplates = [...templates, newTemplate]
      setTemplates(newTemplates)
      saveCustomTemplates(newTemplates)
    }

    setShowForm(false)
    setFormData({ title: '', icon: '💬', message: '' })
  }

  const handleResetToDefault = () => {
    if (confirm(t('followups.templates.resetConfirm'))) {
      setTemplates(DEFAULT_TEMPLATES)
      safeStorage.removeItem('whatsapp-templates')
    }
  }

  const emojiList = ['💬', '👋', '📞', '🎁', '✅', '🔥', '💪', '🏋️', '⭐', '🎯', '💚', '📱', '✨', '👍', '😊']

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir={direction}
      >
        {/* Header */}
        <div className="sticky top-0 bg-green-600 text-white p-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span>💬</span>
              <span>{t('followups.templates.title')}</span>
            </h2>
            <p className="text-xs opacity-90 mt-0.5">
              {visitorName} - {visitorPhone}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleResetToDefault}
              className="bg-yellow-500/30 hover:bg-yellow-500/40 px-3 py-1 rounded text-sm font-bold"
              title={t('followups.templates.resetToDefault')}
            >
              🔄
            </button>
            <button
              onClick={handleAddNew}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm font-bold"
            >
              + {t('followups.templates.addNew')}
            </button>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!showForm ? (
            <>
              {/* متغيرات متاحة */}
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 mb-4">
                <p className="text-sm font-bold text-primary-900 mb-2">📝 {t('followups.templates.variables.title')}:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  <code className="bg-white px-2 py-1 rounded border border-primary-200" dir="ltr">{'{name}'} → {visitorName}</code>
                  <code className="bg-white px-2 py-1 rounded border border-primary-200" dir="ltr">{'{salesName}'} → {salesName || t('followups.templates.variables.salesName')}</code>
                  <code className="bg-white px-2 py-1 rounded border border-primary-200" dir="ltr">{'{phone}'} → {visitorPhone}</code>
                  <code className="bg-white px-2 py-1 rounded border border-primary-200" dir="ltr">{'{date}'} → {new Date().toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}</code>
                  <code className="bg-white px-2 py-1 rounded border border-primary-200" dir="ltr">{'{time}'} → {new Date().toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</code>
                </div>
              </div>

              {/* قائمة القوالب */}
              <div className="space-y-3">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-4 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-3xl">{template.icon}</span>
                        <div className="flex-1">
                          <h3 className="font-bold text-green-900 text-lg">{template.title}</h3>
                          {template.isCustom && (
                            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                              {t('followups.templates.custom')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(template)}
                          className="text-primary-600 hover:bg-primary-100 px-3 py-2 rounded-lg text-sm font-bold transition-colors"
                          title={t('followups.templates.editTemplate')}
                        >
                          ✏️ {t('common.edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(template)}
                          className="text-red-600 hover:bg-red-100 px-3 py-2 rounded-lg text-sm font-bold transition-colors"
                          title={t('followups.templates.deleteTemplate')}
                        >
                          🗑️ {t('common.delete')}
                        </button>
                        <button
                          onClick={() => onSelect(template)}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                        >
                          {t('followups.templates.send')}
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-line bg-white/50 p-3 rounded" dir="rtl">
                      {replaceVariables(template.message)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* فورم إضافة/تعديل قالب */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">{t('followups.templates.form.title')}</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder={t('followups.templates.form.titlePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">{t('followups.templates.form.icon')}</label>
                <div className="flex flex-wrap gap-2">
                  {emojiList.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setFormData({ ...formData, icon: emoji })}
                      className={`text-2xl p-2 rounded border-2 ${
                        formData.icon === emoji
                          ? 'border-green-600 bg-green-50'
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">{t('followups.templates.form.message')}</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[200px] font-arabic"
                  placeholder={t('followups.templates.form.messagePlaceholder')}
                  dir="rtl"
                />
                <p className="text-xs text-gray-500 mt-1" dir="ltr">
                  {t('followups.templates.form.variableHint')}
                </p>
              </div>

              {/* معاينة */}
              {formData.message && (
                <div>
                  <label className="block text-sm font-bold mb-2">{t('followups.templates.form.preview')}</label>
                  <div className="bg-green-50 border border-green-300 rounded-lg p-4 dark:bg-green-900/20 dark:border-green-700">
                    <p className="text-sm whitespace-pre-line" dir="rtl">
                      {replaceVariables(formData.message)}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleSave}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold"
                >
                  {editingTemplate ? t('followups.templates.form.save') : t('followups.templates.form.add')}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setFormData({ title: '', icon: '💬', message: '' })
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded-lg font-bold"
                >
                  {t('followups.templates.form.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showForm && (
          <div className="bg-gray-50 p-3 border-t border-gray-200">
            <p className="text-xs text-gray-600 text-center">
              {t('followups.templates.footer')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
