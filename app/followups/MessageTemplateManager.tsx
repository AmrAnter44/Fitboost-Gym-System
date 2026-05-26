'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { LoadingScreen } from '../../components/Spinner'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const IconClose = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
)
const IconRefresh = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
)
const IconPlus = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
)
const IconChat = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
  </svg>
)
const IconNote = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
  </svg>
)
const IconPencil = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
  </svg>
)
const IconTrash = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
  </svg>
)
const IconSend = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
  </svg>
)

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
    icon: '',
    message: `مرحباً {name}! \n\nشكراً لزيارتك لـ Gym System\nنتمنى نشوفك قريب معانا!\n\nلو عندك أي استفسار، أنا هنا `,
    isCustom: false
  },
  {
    id: 'followup',
    title: 'متابعة عادية',
    icon: '',
    message: `السلام عليكم يا {name}! \n\nأنا {salesName} من Gym System\nحابب أطمن عليك وأعرف رأيك في الجيم؟\n\nمستني ردك `,
    isCustom: false
  },
  {
    id: 'offer',
    title: 'عرض خاص',
    icon: '',
    message: `يا {name}! \n\nعندنا عرض خاص ليك النهاردة!\nاشترك دلوقتي واستمتع بأفضل الأسعار \n\nتعال كلمنا!`,
    isCustom: false
  },
  {
    id: 'interested',
    title: 'رد على مهتم',
    icon: '',
    message: `عظيم يا {name}! \n\nسعيد باهتمامك \nتعال النهاردة وابدأ رحلتك معانا!\n\nمستنيك ‍`,
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
    icon: '',
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
    setFormData({ title: '', icon: '', message: '' })
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
      setFormData({ title: '', icon: '', message: '' })
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

  const emojiList = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '']

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-manager-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in"
        onClick={(e) => e.stopPropagation()}
        dir={direction}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <h2 id="template-manager-title" className="text-base sm:text-lg font-bold flex items-center gap-2">
                <IconChat className="w-5 h-5 text-green-700 dark:text-green-400" />
                <span className="truncate">{t('followups.templates.title')}</span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                {visitorName} - {visitorPhone}
              </p>
            </div>
            <div className="flex gap-1 sm:gap-2 flex-shrink-0">
              <button
                onClick={handleResetToDefault}
                type="button"
                aria-label={t('followups.templates.resetToDefault')}
                className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 p-2 rounded-lg transition-colors duration-200"
                title={t('followups.templates.resetToDefault')}
              >
                <IconRefresh className="w-4 h-4" />
              </button>
              <button
                onClick={handleAddNew}
                type="button"
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors duration-200 hidden sm:inline-flex items-center gap-1"
              >
                <IconPlus className="w-4 h-4" />
                <span>{t('followups.templates.addNew')}</span>
              </button>
              <button
                onClick={handleAddNew}
                type="button"
                aria-label={t('followups.templates.addNew')}
                className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg text-sm font-bold sm:hidden transition-colors duration-200"
                title={t('followups.templates.addNew')}
              >
                <IconPlus className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                type="button"
                aria-label={t('common.close') || 'Close'}
                className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg w-8 h-8 flex items-center justify-center flex-shrink-0 transition-colors duration-200"
              >
                <IconClose className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <LoadingScreen />
          ) : !showForm ? (
            <>
              {/* Available variables */}
              <div className="bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-900/50 rounded-lg p-3 mb-4">
                <p className="text-sm font-bold text-primary-900 dark:text-primary-100 mb-2 flex items-center gap-1">
                  <IconNote className="w-4 h-4" />
                  <span>{t('followups.templates.variables.title')}:</span>
                </p>
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
                    className="bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 rounded-xl p-3 sm:p-4 shadow-sm hover:ring-green-300 dark:hover:ring-green-700 transition-colors duration-200"
                  >
                    <div className="flex items-start gap-2 sm:gap-3 mb-3">
                      <span className="text-2xl sm:text-3xl flex-shrink-0" aria-hidden="true">{template.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base sm:text-lg">{template.title}</h3>
                        {template.isCustom && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 mt-1">
                            {t('followups.templates.custom')}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line bg-gray-50 dark:bg-gray-900/40 p-3 rounded-lg mb-3 ring-1 ring-gray-200 dark:ring-gray-700" dir="rtl">
                      {replaceVariables(template.message)}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => handleEdit(template)}
                        type="button"
                        className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-2 rounded-lg text-sm font-bold transition-colors duration-200 flex items-center justify-center gap-1.5"
                        title={t('followups.templates.editTemplate')}
                      >
                        <IconPencil className="w-4 h-4" />
                        <span>{t('common.edit')}</span>
                      </button>
                      <button
                        onClick={() => handleDelete(template)}
                        type="button"
                        className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 px-3 py-2 rounded-lg text-sm font-bold transition-colors duration-200 flex items-center justify-center gap-1.5"
                        title={t('followups.templates.deleteTemplate')}
                      >
                        <IconTrash className="w-4 h-4" />
                        <span>{t('common.delete')}</span>
                      </button>
                      <button
                        onClick={() => onSelect(template)}
                        type="button"
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors duration-200 flex items-center justify-center gap-1.5"
                      >
                        <IconSend className="w-4 h-4" />
                        <span>{t('followups.templates.send')}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddNew}
                type="button"
                className="sm:hidden w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold mt-4 flex items-center justify-center gap-2 transition-colors duration-200"
              >
                <IconPlus className="w-5 h-5" />
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
                      className={`text-2xl p-2 rounded ring-1 transition-colors ${
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
                  type="button"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 sm:py-2.5 rounded-lg font-bold transition-colors duration-200"
                >
                  {editingTemplate ? t('followups.templates.form.save') : t('followups.templates.form.add')}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setFormData({ title: '', icon: '', message: '' })
                  }}
                  type="button"
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 py-3 sm:py-2.5 rounded-lg font-bold transition-colors duration-200"
                >
                  {t('followups.templates.form.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showForm && (
          <div className="bg-gray-50 dark:bg-gray-900/40 p-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
              {t('followups.templates.footer')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
