'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { FlexibilityAssessment, ExerciseTestData, MedicalQuestions } from '../../../types/fitness-test'
import { useToast } from '../../../contexts/ToastContext'

function NewFitnessTestContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const memberId = searchParams.get('memberId')
  const coachId = searchParams.get('coachId')
  const requestId = searchParams.get('requestId')
  const toast = useToast()

  const [loading, setLoading] = useState(false)
  const [member, setMember] = useState<any>(null)
  const [coach, setCoach] = useState<any>(null)

  const formatDateYMD = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [fitnessTestForm, setFitnessTestForm] = useState({
    testDate: formatDateYMD(new Date()),
    medicalQuestions: {
      firstTimeGym: false,
      inDietPlan: false,
      hernia: false,
      familyHeartHistory: false,
      heartProblem: false,
      backPain: false,
      surgery: false,
      breathingProblems: false,
      bloodPressure: false,
      kneeProblem: false,
      diabetes: false,
      smoker: false,
      highCholesterol: false,
    } as MedicalQuestions,
    flexibility: {
      shoulder: 'FAIR',
      hip: 'FAIR',
      elbow: 'FAIR',
      wrist: 'FAIR',
      spine: 'FAIR',
      scapula: 'FAIR',
      knee: 'FAIR',
      ankle: 'FAIR',
    } as FlexibilityAssessment,
    exercises: {
      pushup: { sets: 0, reps: 0 },
      situp: { sets: 0, reps: 0 },
      pullup: { sets: 0, reps: 0 },
      squat: { sets: 0, reps: 0 },
      plank: { sets: 0, reps: 0 },
      legpress: { sets: 0, reps: 0 },
      chestpress: { sets: 0, reps: 0 },
    } as ExerciseTestData,
  })

  useEffect(() => {
    if (!memberId || !coachId) {
      toast.error('معلومات غير مكتملة')
      return
    }

    const fetchData = async () => {
      try {
        // Fetch member data - استخدام route الجديد الخاص بعضو واحد
        const memberRes = await fetch(`/api/members/${memberId}`)
        if (memberRes.ok) {
          const foundMember = await memberRes.json()
          setMember(foundMember)
        } else {
          console.error('فشل جلب بيانات العضو')
          toast.error('لم يتم العثور على العضو')
        }

        // Fetch coach data
        const coachRes = await fetch(`/api/coaches/${coachId}`)
        if (coachRes.ok) {
          const foundCoach = await coachRes.json()
          setCoach(foundCoach)
        } else {
          console.error('فشل جلب بيانات المدرب')
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('حدث خطأ في جلب البيانات')
      }
    }

    fetchData()
  }, [memberId, coachId])

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/members/${memberId}/fitness-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId: coachId,
          testDate: fitnessTestForm.testDate,
          medicalQuestions: fitnessTestForm.medicalQuestions,
          flexibility: fitnessTestForm.flexibility,
          exercises: fitnessTestForm.exercises,
        }),
      })

      if (response.ok) {
        toast.success('تم حفظ اختبار اللياقة بنجاح!')

        // إذا كان هناك requestId، قم بتحديث حالته إلى completed
        if (requestId) {
          await fetch(`/api/fitness-test-requests/${requestId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' }),
          })
        }

        setTimeout(() => {
          router.push('/coach')
        }, 1500)
      } else {
        const result = await response.json()
        toast.error(result.error || 'فشل حفظ الاختبار')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في الحفظ')
    } finally {
      setLoading(false)
    }
  }

  const medicalQuestions = [
    { key: 'firstTimeGym', label: 'هل هذه أول مرة في النادي؟' },
    { key: 'inDietPlan', label: 'هل أنت على نظام غذائي؟' },
    { key: 'hernia', label: 'هل تعاني من فتق؟' },
    { key: 'familyHeartHistory', label: 'هل يوجد تاريخ عائلي لأمراض القلب؟' },
    { key: 'heartProblem', label: 'هل تعاني من مشاكل في القلب؟' },
    { key: 'backPain', label: 'هل تعاني من آلام في الظهر؟' },
    { key: 'surgery', label: 'هل أجريت عملية جراحية مؤخراً؟' },
    { key: 'breathingProblems', label: 'هل تعاني من مشاكل في التنفس؟' },
    { key: 'bloodPressure', label: 'هل تعاني من ضغط الدم؟' },
    { key: 'kneeProblem', label: 'هل تعاني من مشاكل في الركبة؟' },
    { key: 'diabetes', label: 'هل تعاني من السكري؟' },
    { key: 'smoker', label: 'هل أنت مدخن؟' },
    { key: 'highCholesterol', label: 'هل تعاني من الكوليسترول العالي؟' },
  ]

  const flexibilityParts = [
    { key: 'shoulder', label: 'الكتف (Shoulder)' },
    { key: 'hip', label: 'الورك (Hip)' },
    { key: 'elbow', label: 'الكوع (Elbow)' },
    { key: 'wrist', label: 'الرسغ (Wrist)' },
    { key: 'spine', label: 'العمود الفقري (Spine)' },
    { key: 'scapula', label: 'لوح الكتف (Scapula)' },
    { key: 'knee', label: 'الركبة (Knee)' },
    { key: 'ankle', label: 'الكاحل (Ankle)' },
  ]

  const exercises = [
    { key: 'pushup', label: 'الضغط (Push up)' },
    { key: 'situp', label: 'البطن (Sit-up)' },
    { key: 'pullup', label: 'العقلة (Pull up)' },
    { key: 'squat', label: 'القرفصاء (Squat)' },
    { key: 'plank', label: 'البلانك (Plank)' },
    { key: 'legpress', label: 'الرجل (Leg press)' },
    { key: 'chestpress', label: 'الصدر (Chest press)' },
  ]

  if (!memberId || !coachId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 text-center">
          <p className="text-2xl text-red-600">❌ معلومات غير مكتملة</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">📋 نموذج تقييم اللياقة</h1>
              <p className="text-gray-600 mt-2">إنشاء اختبار لياقة جديد</p>
            </div>
            <button
              onClick={() => router.back()}
              className="px-6 py-3 bg-gray-200 rounded-lg hover:bg-gray-300 font-bold"
            >
              ← رجوع
            </button>
          </div>
        </div>


        {/* Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          {/* Section 1: Auto-filled Member Info */}
          <div className="bg-blue-50 p-6 rounded-lg mb-6">
            <h2 className="font-bold mb-4 text-xl">معلومات العضو</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-gray-600 text-sm">رقم العضوية</p>
                <p className="font-bold text-lg">#{member?.memberNumber || '...'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">الاسم</p>
                <p className="font-bold text-lg">{member?.name || '...'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">الهاتف</p>
                <p className="font-bold text-lg">{member?.phone || '...'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">المدرب</p>
                <p className="font-bold text-lg text-teal-600">{coach?.name || '...'}</p>
              </div>
            </div>
          </div>

          {/* Section 2: Test Date */}
          <div className="mb-6">
            <label className="block font-bold mb-2 text-lg">تاريخ الاختبار</label>
            <input
              type="date"
              value={fitnessTestForm.testDate}
              onChange={(e) =>
                setFitnessTestForm({ ...fitnessTestForm, testDate: e.target.value })
              }
              className="w-full px-4 py-3 border-2 rounded-lg text-lg"
            />
          </div>

          {/* Section 3: Medical Questions */}
          <div className="bg-yellow-50 p-6 rounded-lg mb-6">
            <h2 className="font-bold mb-4 text-xl">الأسئلة الطبية</h2>
            <div className="space-y-3">
              {medicalQuestions.map((q) => (
                <label
                  key={q.key}
                  className="flex items-center gap-3 cursor-pointer hover:bg-yellow-100 p-3 rounded"
                >
                  <input
                    type="checkbox"
                    checked={fitnessTestForm.medicalQuestions[q.key as keyof MedicalQuestions]}
                    onChange={(e) =>
                      setFitnessTestForm({
                        ...fitnessTestForm,
                        medicalQuestions: {
                          ...fitnessTestForm.medicalQuestions,
                          [q.key]: e.target.checked,
                        },
                      })
                    }
                    className="w-6 h-6"
                  />
                  <span className="text-base font-medium">{q.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Section 4: Free PT Sessions (Read-only Display) */}
          <div className="bg-orange-50 p-6 rounded-lg mb-6">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xl">حصص PT المجانية للعضو</span>
              <span className="text-5xl font-bold text-orange-600">
                {member?.freePTSessions || 0}
              </span>
            </div>
          </div>

          {/* Section 5: Flexibility Test */}
          <div className="bg-purple-50 p-6 rounded-lg mb-6">
            <h2 className="font-bold mb-4 text-xl">اختبار المرونة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {flexibilityParts.map((part) => (
                <div key={part.key}>
                  <label className="block font-medium mb-2">{part.label}</label>
                  <select
                    value={fitnessTestForm.flexibility[part.key as keyof FlexibilityAssessment]}
                    onChange={(e) =>
                      setFitnessTestForm({
                        ...fitnessTestForm,
                        flexibility: {
                          ...fitnessTestForm.flexibility,
                          [part.key]: e.target.value,
                        },
                      })
                    }
                    className="w-full px-4 py-3 border-2 rounded-lg"
                  >
                    <option value="FAIR">Fair</option>
                    <option value="GOOD">Good</option>
                    <option value="EXCELLENT">Excellent</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Section 6: Exercise Test */}
          <div className="bg-green-50 p-6 rounded-lg mb-6">
            <h2 className="font-bold mb-4 text-xl">اختبار التمارين</h2>
            <div className="space-y-4">
              {exercises.map((ex) => (
                <div key={ex.key} className="flex items-center gap-4">
                  <div className="w-56 font-medium text-lg">{ex.label}</div>
                  <input
                    type="number"
                    placeholder="Sets"
                    value={fitnessTestForm.exercises[ex.key as keyof ExerciseTestData].sets}
                    onChange={(e) =>
                      setFitnessTestForm({
                        ...fitnessTestForm,
                        exercises: {
                          ...fitnessTestForm.exercises,
                          [ex.key]: {
                            ...fitnessTestForm.exercises[ex.key as keyof ExerciseTestData],
                            sets: parseInt(e.target.value) || 0,
                          },
                        },
                      })
                    }
                    className="w-28 px-4 py-3 border-2 rounded-lg text-center"
                    min="0"
                  />
                  <span className="text-2xl font-bold">×</span>
                  <input
                    type="number"
                    placeholder="Reps"
                    value={fitnessTestForm.exercises[ex.key as keyof ExerciseTestData].reps}
                    onChange={(e) =>
                      setFitnessTestForm({
                        ...fitnessTestForm,
                        exercises: {
                          ...fitnessTestForm.exercises,
                          [ex.key]: {
                            ...fitnessTestForm.exercises[ex.key as keyof ExerciseTestData],
                            reps: parseInt(e.target.value) || 0,
                          },
                        },
                      })
                    }
                    className="w-28 px-4 py-3 border-2 rounded-lg text-center"
                    min="0"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-teal-600 text-white py-4 rounded-lg font-bold text-xl hover:bg-teal-700 disabled:bg-gray-400"
            >
              {loading ? 'جاري الحفظ...' : '💾 حفظ الاختبار'}
            </button>
            <button
              onClick={() => router.back()}
              className="px-8 bg-gray-200 py-4 rounded-lg font-bold hover:bg-gray-300"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NewFitnessTestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4"><div className="text-white text-xl">جاري التحميل...</div></div>}>
      <NewFitnessTestContent />
    </Suspense>
  )
}
