'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

export interface MessageTemplate {
  id: string
  title: string
  icon: string
  message: string
  isCustom: boolean
  isDefault?: boolean
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
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    title: '',
    icon: '💬',
    message: ''
  })

  // تحميل القوالب من قاعدة البيانات
  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/whatsapp/templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      } else {
        console.error('Failed to fetch templates')
        setTemplates(DEFAULT_TEMPLATES)
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
      setTemplates(DEFAULT_TEMPLATES)
    } finally {
      setLoading(false)
    }
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

  const handleDelete = async (template: MessageTemplate) => {
    if (confirm(t('followups.templates.deleteConfirm'))) {
      try {
        const response = await fetch(`/api/whatsapp/templates?id=${template.id}`, {
          method: 'DELETE'
        })

        if (response.ok) {
          // تحديث القائمة محلياً
          setTemplates(templates.filter(t => t.id !== template.id))
        } else {
          console.error('Failed to delete template')
          alert('فشل حذف القالب')
        }
      } catch (error) {
        console.error('Error deleting template:', error)
        alert('حدث خطأ أثناء حذف القالب')
      }
    }
  }

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.message.trim()) {
      alert(t('followups.templates.form.fillAllFields') || 'املأ جميع الحقول')
      return
    }

    try {
      if (editingTemplate) {
        // تعديل قالب موجود
        const response = await fetch('/api/whatsapp/templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingTemplate.id,
            title: formData.title,
            icon: formData.icon,
            message: formData.message
          })
        })

        if (response.ok) {
          const data = await response.json()
          // تحديث القائمة محلياً
          setTemplates(templates.map(t =>
            t.id === editingTemplate.id ? data.template : t
          ))
        } else {
          alert('فشل تحديث القالب')
          return
        }
      } else {
        // إضافة قالب جديد
        const response = await fetch('/api/whatsapp/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.title,
            icon: formData.icon,
            message: formData.message
          })
        })

        if (response.ok) {
          const data = await response.json()
          // إضافة القالب للقائمة محلياً
          setTemplates([...templates, data.template])
        } else {
          alert('فشل إضافة القالب')
          return
        }
      }

      setShowForm(false)
      setFormData({ title: '', icon: '💬', message: '' })
      setEditingTemplate(null)
    } catch (error) {
      console.error('Error saving template:', error)
      alert('حدث خطأ أثناء حفظ القالب')
    }
  }

  const handleResetToDefault = async () => {
    if (confirm(t('followups.templates.resetConfirm'))) {
      try {
        // حذف جميع القوالب الحالية
        const deletePromises = templates.map(template =>
          fetch(`/api/whatsapp/templates?id=${template.id}`, {
            method: 'DELETE'
          })
        )
        await Promise.all(deletePromises)

        // إعادة تحميل القوالب (سيتم إنشاء القوالب الافتراضية تلقائياً)
        await fetchTemplates()
      } catch (error) {
        console.error('Error resetting templates:', error)
        alert('حدث خطأ أثناء إعادة التعيين')
      }
    }
  }

  const emojiList = ['💬', '👋', '📞', '🎁', '✅', '🔥', '💪', '🏋️', '⭐', '🎯', '💚', '📱', '✨', '👍', '😊']

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir={direction}
      >
        {/* Header */}
        <div className="sticky top-0 bg-green-600 text-white p-3 sm:p-4">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <span>💬</span>
                <span className="truncate">{t('followups.templates.title')}</span>
              </h2>
              <p className="text-xs opacity-90 mt-0.5 truncate">
                {visitorName} - {visitorPhone}
              </p>
            </div>
            <div className="flex gap-1 sm:gap-2 flex-shrink-0">
              <button
                onClick={handleResetToDefault}
                className="bg-yellow-500/30 hover:bg-yellow-500/40 p-2 sm:px-3 sm:py-1 rounded text-sm font-bold"
                title={t('followups.templates.resetToDefault')}
              >
                🔄
              </button>
              <button
                onClick={handleAddNew}
                className="bg-white/20 hover:bg-white/30 p-2 sm:px-3 sm:py-1 rounded text-sm font-bold hidden sm:inline-block"
              >
                + {t('followups.templates.addNew')}
              </button>
              <button
                onClick={handleAddNew}
                className="bg-white/20 hover:bg-white/30 p-2 rounded text-sm font-bold sm:hidden"
                title={t('followups.templates.addNew')}
              >
                +
              </button>
              <button
                onClick={onClose}
                className="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 dark:border-green-400 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-300">{t('common.loading') || 'جاري التحميل...'}</p>
              </div>
            </div>
          ) : !showForm ? (
            <>
              {/* متغيرات متاحة */}
              <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 rounded-lg p-3 mb-4">
                <p className="text-sm font-bold text-primary-900 dark:text-primary-100 mb-2">📝 {t('followups.templates.variables.title')}:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded border border-primary-200 dark:border-primary-700 truncate" dir="ltr">{'{name}'} → {visitorName}</code>
                  <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded border border-primary-200 dark:border-primary-700 truncate" dir="ltr">{'{salesName}'} → {salesName || t('followups.templates.variables.salesName')}</code>
                  <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded border border-primary-200 dark:border-primary-700 truncate" dir="ltr">{'{phone}'} → {visitorPhone}</code>
                  <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded border border-primary-200 dark:border-primary-700 truncate" dir="ltr">{'{date}'} → {new Date().toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}</code>
                  <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded border border-primary-200 dark:border-primary-700 truncate" dir="ltr">{'{time}'} → {new Date().toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</code>
                </div>
              </div>

              {/* قائمة القوالب */}
              <div className="space-y-3">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg p-3 sm:p-4 hover:shadow-md transition-all"
                  >
                    {/* Header */}
                    <div className="flex items-start gap-2 sm:gap-3 mb-3">
                      <span className="text-2xl sm:text-3xl flex-shrink-0">{template.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-green-900 dark:text-green-100 text-base sm:text-lg">{template.title}</h3>
                        {template.isCustom && (
                          <span className="text-xs bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-200 px-2 py-0.5 rounded inline-block mt-1">
                            {t('followups.templates.custom')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Message Preview */}
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line bg-white/50 dark:bg-gray-700/50 p-3 rounded mb-3" dir="rtl">
                      {replaceVariables(template.message)}
                    </p>

                    {/* Buttons - Responsive */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => handleEdit(template)}
                        className="text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900 px-3 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1"
                        title={t('followups.templates.editTemplate')}
                      >
                        <span>✏️</span>
                        <span>{t('common.edit')}</span>
                      </button>
                      <button
                        onClick={() => handleDelete(template)}
                        className="text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 px-3 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1"
                        title={t('followups.templates.deleteTemplate')}
                      >
                        <span>🗑️</span>
                        <span>{t('common.delete')}</span>
                      </button>
                      <button
                        onClick={() => onSelect(template)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1"
                      >
                        <span>📤</span>
                        <span>{t('followups.templates.send')}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* زر إضافة جديد للموبايل */}
              <button
                onClick={handleAddNew}
                className="sm:hidden w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold mt-4 flex items-center justify-center gap-2"
              >
                <span>➕</span>
                <span>{t('followups.templates.addNew')}</span>
              </button>
            </>
          ) : (
            /* فورم إضافة/تعديل قالب */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2 dark:text-gray-200">{t('followups.templates.form.title')}</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-transparent"
                  placeholder={t('followups.templates.form.titlePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 dark:text-gray-200">{t('followups.templates.form.icon')}</label>
                <div className="flex flex-wrap gap-2">
                  {emojiList.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon: emoji })}
                      className={`text-2xl p-2 rounded border-2 transition-colors ${
                        formData.icon === emoji
                          ? 'border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/30'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-green-400 dark:hover:border-green-500'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 dark:text-gray-200">{t('followups.templates.form.message')}</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 min-h-[200px] font-arabic bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-transparent"
                  placeholder={t('followups.templates.form.messagePlaceholder')}
                  dir="rtl"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1" dir="ltr">
                  {t('followups.templates.form.variableHint')}
                </p>
              </div>

              {/* معاينة */}
              {formData.message && (
                <div>
                  <label className="block text-sm font-bold mb-2 dark:text-gray-200">{t('followups.templates.form.preview')}</label>
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-4">
                    <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-line" dir="rtl">
                      {replaceVariables(formData.message)}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <button
                  onClick={handleSave}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 sm:py-2 rounded-lg font-bold"
                >
                  {editingTemplate ? t('followups.templates.form.save') : t('followups.templates.form.add')}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setFormData({ title: '', icon: '💬', message: '' })
                  }}
                  className="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 py-3 sm:py-2 rounded-lg font-bold"
                >
                  {t('followups.templates.form.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showForm && (
          <div className="bg-gray-50 dark:bg-gray-700 p-3 border-t border-gray-200 dark:border-gray-600">
            <p className="text-xs text-gray-600 dark:text-gray-300 text-center">
              {t('followups.templates.footer')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
