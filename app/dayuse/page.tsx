'use client'

import { useEffect, useState } from 'react'
import { ReceiptToPrint } from '../../components/ReceiptToPrint'
import PaymentMethodSelector from '../../components/Paymentmethodselector'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../contexts/LanguageContext'

interface DayUseEntry {
  id: string
  name: string
  phone: string
  serviceType: string
  price: number
  staffName: string
  createdAt: string
}

export default function DayUsePage() {
  const { t } = useLanguage()
  const { user } = usePermissions()
  const [entries, setEntries] = useState<DayUseEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    serviceType: 'DayUse',
    price: 0,
    staffName: user?.name || '',
    paymentMethod: 'cash',
  })
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState<any>(null)
  const [showDeletePopup, setShowDeletePopup] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState<DayUseEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [isRenewing, setIsRenewing] = useState(false)
  const [renewingEntryId, setRenewingEntryId] = useState<string | null>(null)

  const fetchEntries = async () => {
    try {
      const response = await fetch('/api/dayuse')
      const data = await response.json()
      setEntries(data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEntries()
  }, [])

  useEffect(() => {
    if (user && !formData.staffName) {
      setFormData(prev => ({ ...prev, staffName: user.name }))
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      // If renewing, use renew endpoint, otherwise use create endpoint
      const endpoint = isRenewing && renewingEntryId ? '/api/dayuse/renew' : '/api/dayuse'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          staffName: user?.name || '',
          ...(isRenewing && renewingEntryId ? { entryId: renewingEntryId } : {})
        }),
      })

      if (response.ok) {
        const data = await response.json()

        try {
          // If renewing, receipt is returned directly
          if (isRenewing && data.receipt) {
            setReceiptData({
              receiptNumber: data.receipt.receiptNumber,
              type: data.receipt.type,
              amount: data.receipt.amount,
              details: JSON.parse(data.receipt.itemDetails),
              date: new Date(data.receipt.createdAt),
              paymentMethod: formData.paymentMethod
            })
            setShowReceipt(true)
          } else {
            // For new entries, fetch receipt from API
            const receiptsResponse = await fetch(`/api/receipts?dayUseId=${data.id}`)
            const receipts = await receiptsResponse.json()

            if (receipts.length > 0) {
              const receipt = receipts[0]
              setReceiptData({
                receiptNumber: receipt.receiptNumber,
                type: receipt.type,
                amount: receipt.amount,
                details: JSON.parse(receipt.itemDetails),
                date: new Date(receipt.createdAt),
                paymentMethod: formData.paymentMethod
              })
              setShowReceipt(true)
            }
          }
        } catch (err) {
          console.error('Error fetching receipt:', err)
        }

        setFormData({
          name: '',
          phone: '',
          serviceType: 'DayUse',
          price: 0,
          staffName: user?.name || '',
          paymentMethod: 'cash',
        })

        setMessage(t('dayUse.messages.success'))
        setTimeout(() => setMessage(''), 3000)
        fetchEntries()
        setShowForm(false)
        setIsRenewing(false)
        setRenewingEntryId(null)
      } else {
        setMessage(t('dayUse.messages.failed'))
      }
    } catch (error) {
      console.error(error)
      setMessage(t('dayUse.messages.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleRenewClick = (entry: DayUseEntry) => {
    setFormData({
      name: entry.name,
      phone: entry.phone,
      serviceType: entry.serviceType,
      price: entry.price,
      staffName: user?.name || '',
      paymentMethod: 'cash',
    })
    setIsRenewing(true)
    setRenewingEntryId(entry.id)
    setShowForm(true)
    // Scroll to top to show the form
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteClick = (entry: DayUseEntry) => {
    setEntryToDelete(entry)
    setShowDeletePopup(true)
  }

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/dayuse?id=${entryToDelete.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setMessage(t('dayUse.messages.deleteSuccess'))
        setTimeout(() => setMessage(''), 3000)
        fetchEntries()
        setShowDeletePopup(false)
        setEntryToDelete(null)
      } else {
        setMessage(t('dayUse.messages.deleteFailed'))
      }
    } catch (error) {
      console.error(error)
      setMessage(t('dayUse.messages.deleteError'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 md:px-6" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{t('dayUse.title')}</h1>
        <button
          onClick={() => {
            setShowForm(!showForm)
            if (!showForm) {
              // Reset form when opening
              setFormData({
                name: '',
                phone: '',
                serviceType: 'DayUse',
                price: 0,
                staffName: user?.name || '',
                paymentMethod: 'cash',
              })
              setIsRenewing(false)
              setRenewingEntryId(null)
            }
          }}
          className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
        >
          {showForm ? t('dayUse.hideForm') : t('dayUse.addNewOperation')}
        </button>
      </div>

      {message && !showForm && (
        <div className={`mb-4 p-3 rounded-lg ${message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {isRenewing ? '🔄 تجديد خدمة' : t('dayUse.addOperationTitle')}
          </h2>
          
          {message && (
            <div className={`mb-4 p-3 rounded-lg ${message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {message}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('dayUse.name')}</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder={t('dayUse.namePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('dayUse.phone')}</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder={t('dayUse.phonePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('dayUse.serviceType')}</label>
                <select
                  value={formData.serviceType}
                  onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="DayUse">{t('dayUse.dayUse')}</option>
                  <option value="InBody">{t('dayUse.inBody')}</option>
                  <option value="LockerRental">{t('dayUse.lockerRental')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('dayUse.price')}</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder={t('dayUse.pricePlaceholder')}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">{t('dayUse.staffName')}</label>
                <input
                  type="text"
                  required
                  value={formData.staffName}
                  readOnly
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100 cursor-not-allowed"
                  placeholder={t('dayUse.staffNamePlaceholder')}
                />
              </div>
            </div>

            {/* قسم طريقة الدفع */}
            <div className="bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-5">
              <PaymentMethodSelector
                value={formData.paymentMethod}
                onChange={(method) => setFormData({ ...formData, paymentMethod: method })}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? t('dayUse.saving') : t('dayUse.add')}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">{t('dayUse.loading')}</div>
      ) : (
        <>
          {/* Mobile Cards View */}
          <div className="md:hidden space-y-4">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white border-r-4 border-purple-500 rounded-lg shadow-md p-4"
              >
                {/* Action Buttons at Top */}
                <div className="flex justify-end gap-2 mb-3">
                  <button
                    onClick={() => handleRenewClick(entry)}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition text-sm font-medium shadow-sm"
                  >
                    🔄 تجديد
                  </button>
                  <button
                    onClick={() => handleDeleteClick(entry)}
                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition text-sm font-medium shadow-sm"
                  >
                    🗑️ {t('dayUse.delete')}
                  </button>
                </div>

                {/* Entry Info */}
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 text-sm min-w-[80px]">👤 {t('dayUse.nameLabel')}</span>
                    <span className="font-bold text-gray-900">{entry.name}</span>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 text-sm min-w-[80px]">📱 {t('dayUse.phoneLabel')}</span>
                    <a
                      href={`https://wa.me/2${entry.phone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 font-medium hover:text-green-700"
                    >
                      {entry.phone}
                    </a>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 text-sm min-w-[80px]">🎯 {t('dayUse.serviceLabel')}</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      entry.serviceType === 'DayUse'
                        ? 'bg-blue-100 text-blue-800'
                        : entry.serviceType === 'InBody'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {entry.serviceType === 'DayUse' ? t('dayUse.dayUse') :
                       entry.serviceType === 'InBody' ? t('dayUse.inBody') : t('dayUse.lockerRental')}
                    </span>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 text-sm min-w-[80px]">💰 {t('dayUse.priceLabel')}</span>
                    <span className="font-bold text-green-600">{entry.price} {t('dayUse.egp')}</span>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 text-sm min-w-[80px]">👨‍💼 {t('dayUse.staffLabel')}</span>
                    <span className="text-gray-700">{entry.staffName}</span>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 text-sm min-w-[80px]">📅 {t('dayUse.dateLabel')}</span>
                    <span className="text-gray-700">
                      {new Date(entry.createdAt).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {entries.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-5xl mb-3">📦</div>
                <p>{t('dayUse.noOperationsYet')}</p>
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-right">{t('dayUse.name')}</th>
                  <th className="px-4 py-3 text-right">{t('dayUse.phone')}</th>
                  <th className="px-4 py-3 text-right">{t('dayUse.serviceType')}</th>
                  <th className="px-4 py-3 text-right">{t('dayUse.price')}</th>
                  <th className="px-4 py-3 text-right">{t('dayUse.staffName')}</th>
                  <th className="px-4 py-3 text-right">{t('dayUse.dateLabel')}</th>
                  <th className="px-4 py-3 text-center">{t('dayUse.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">{entry.name}</td>
                    <td className="px-4 py-3">{entry.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-sm ${
                        entry.serviceType === 'DayUse'
                          ? 'bg-blue-100 text-blue-800'
                          : entry.serviceType === 'InBody'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {entry.serviceType === 'DayUse' ? t('dayUse.dayUse') :
                         entry.serviceType === 'InBody' ? t('dayUse.inBody') : t('dayUse.lockerRental')}
                      </span>
                    </td>
                    <td className="px-4 py-3">{entry.price} {t('dayUse.egp')}</td>
                    <td className="px-4 py-3">{entry.staffName}</td>
                    <td className="px-4 py-3">
                      {new Date(entry.createdAt).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleRenewClick(entry)}
                          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition text-sm"
                        >
                          🔄 تجديد
                        </button>
                        <button
                          onClick={() => handleDeleteClick(entry)}
                          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition text-sm"
                        >
                          🗑️ {t('dayUse.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {entries.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                {t('dayUse.noOperationsYet')}
              </div>
            )}
          </div>
        </>
      )}

      {receiptData && (
        <div className="mt-6">
          <button
            onClick={() => setShowReceipt(true)}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
          >
            🖨️ {t('dayUse.printLastReceipt')}
          </button>
        </div>
      )}

      {showReceipt && receiptData && (
        <ReceiptToPrint
          receiptNumber={receiptData.receiptNumber}
          type={receiptData.type}
          amount={receiptData.amount}
          details={receiptData.details}
          date={receiptData.date}
          paymentMethod={receiptData.paymentMethod}
          onClose={() => setShowReceipt(false)}
        />
      )}

      {/* Delete Confirmation Popup */}
      {showDeletePopup && entryToDelete && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => !deleting && setShowDeletePopup(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              {/* Warning Icon */}
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-3">
                  <span className="text-4xl">⚠️</span>
                </div>
                <h3 className="text-2xl font-bold text-red-700 mb-2">
                  {t('dayUse.deleteModal.title')}
                </h3>
                <p className="text-gray-600 text-sm">
                  {t('dayUse.deleteModal.message')}
                </p>
              </div>

              {/* Entry Details */}
              <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 mb-6 text-right">
                <div className="space-y-2">
                  <p><span className="font-semibold">{t('dayUse.deleteModal.nameLabel')}</span> {entryToDelete.name}</p>
                  <p><span className="font-semibold">{t('dayUse.deleteModal.phoneLabel')}</span> {entryToDelete.phone}</p>
                  <p>
                    <span className="font-semibold">{t('dayUse.deleteModal.serviceTypeLabel')}</span>{' '}
                    {entryToDelete.serviceType === 'DayUse' ? t('dayUse.dayUse') :
                     entryToDelete.serviceType === 'InBody' ? t('dayUse.inBody') : t('dayUse.lockerRental')}
                  </p>
                  <p><span className="font-semibold">{t('dayUse.deleteModal.priceLabel')}</span> {entryToDelete.price} {t('dayUse.egp')}</p>
                  <p><span className="font-semibold">{t('dayUse.deleteModal.dateLabel')}</span> {new Date(entryToDelete.createdAt).toLocaleDateString('ar-EG')}</p>
                </div>
              </div>

              {/* Warning Message */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-yellow-800">
                  {t('dayUse.deleteModal.warning')}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition"
                >
                  {deleting ? `⏳ ${t('dayUse.deleteModal.deleting')}` : `🗑️ ${t('dayUse.deleteModal.confirmDelete')}`}
                </button>
                <button
                  onClick={() => setShowDeletePopup(false)}
                  disabled={deleting}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed font-medium transition"
                >
                  ✖️ {t('dayUse.deleteModal.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}