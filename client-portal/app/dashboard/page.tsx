'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageToggle from '@/components/LanguageToggle';

interface MemberData {
  id: string;
  memberNumber: number;
  name: string;
  phone: string;
  profileImage: string | null;
  subscriptionPrice: number;
  startDate: string | null;
  expiryDate: string | null;
  isActive: boolean;
  isFrozen: boolean;
  remainingDays: number;
  status: 'active' | 'expired' | 'expiring_soon';
  inBodyScans: number;
  invitations: number;
  freePTSessions: number;
  remainingFreezeDays: number;
  _count: {
    receipts: number;
    checkIns: number;
    spaBookings: number;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const { t, dir } = useLanguage();
  const [member, setMember] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/member/profile');

      if (!res.ok) {
        router.push('/login');
        return;
      }

      const data = await res.json();
      setMember(data.member);
    } catch (err) {
      console.error(err);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (!member) return null;

  const statusConfig = {
    active: {
      label: t('active'),
      color: 'bg-green-100 text-green-800',
      icon: '✅',
    },
    expiring_soon: {
      label: t('expiringSoon'),
      color: 'bg-yellow-100 text-yellow-800',
      icon: '⚠️',
    },
    expired: {
      label: t('expired'),
      color: 'bg-red-100 text-red-800',
      icon: '❌',
    },
  };

  const status = statusConfig[member.status];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-[#1e3a8a] text-white p-6 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="relative w-12 h-12 bg-white rounded-lg p-1">
                <Image
                  src="/logo.png"
                  alt="X Gym"
                  width={48}
                  height={48}
                  className="object-contain"
                  priority
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{member.name}</h1>
                <p className="text-blue-200">{t('memberNumber')}: {member.memberNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm"
              >
                {t('logout')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Membership Status Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">{t('membershipStatus')}</h2>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${status.color} flex items-center gap-2`}>
              <span>{status.icon}</span>
              {status.label}
            </span>
          </div>

          {member.isFrozen && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
              ❄️ {t('frozen')}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-600 mb-1">{t('startDate')}</p>
              <p className="text-lg font-semibold text-gray-800">
                {member.startDate
                  ? new Date(member.startDate).toLocaleDateString(dir === 'rtl' ? 'ar-EG' : 'en-US')
                  : '--'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-600 mb-1">{t('endDate')}</p>
              <p className="text-lg font-semibold text-gray-800">
                {member.expiryDate
                  ? new Date(member.expiryDate).toLocaleDateString(dir === 'rtl' ? 'ar-EG' : 'en-US')
                  : '--'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
              <p className="text-4xl font-bold text-blue-600 mb-1">
                {member.remainingDays}
              </p>
              <p className="text-sm text-gray-600">{t('daysRemaining')}</p>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
              <p className="text-4xl font-bold text-green-600 mb-1">
                {member.subscriptionPrice}
              </p>
              <p className="text-sm text-gray-600">{t('egp')} {t('perMonth')}</p>
            </div>
          </div>
        </div>

        {/* Services Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">{t('availableServices')}</h2>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-3 bg-purple-50 rounded-xl">
              <p className="text-2xl font-bold text-purple-600">{member.freePTSessions}</p>
              <p className="text-xs text-gray-600 mt-1">{t('ptSessions')}</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-xl">
              <p className="text-2xl font-bold text-green-600">{member.invitations}</p>
              <p className="text-xs text-gray-600 mt-1">{t('invitations')}</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-xl">
              <p className="text-2xl font-bold text-blue-600">{member.inBodyScans}</p>
              <p className="text-xs text-gray-600 mt-1">{t('inBody')}</p>
            </div>
            <Link
              href="/dashboard/freeze"
              className="relative text-center p-3 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl hover:from-orange-100 hover:to-orange-200 transition-all cursor-pointer border-2 border-orange-200 hover:border-orange-300 shadow-sm hover:shadow-md group"
            >
              <p className="text-2xl font-bold text-orange-600 group-hover:scale-110 transition-transform">{member.remainingFreezeDays}</p>
              <p className="text-xs text-gray-600 mt-1 font-medium">{t('freezeDays')}</p>
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-orange-600">❄️</span>
              </div>
              <p className="text-[10px] text-orange-600 mt-1 opacity-70 group-hover:opacity-100">{t('clickToFreeze')}</p>
            </Link>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-3 gap-4">
          <Link
            href="/dashboard/attendance"
            className="bg-white rounded-xl shadow p-4 hover:shadow-lg transition-shadow text-center group"
          >
            <div className="text-3xl mb-2">📊</div>
            <p className="text-2xl font-bold text-gray-800 mb-1">{member._count.checkIns}</p>
            <p className="text-sm text-gray-600 group-hover:text-blue-600">{t('attendance')}</p>
          </Link>

          <Link
            href="/dashboard/receipts"
            className="bg-white rounded-xl shadow p-4 hover:shadow-lg transition-shadow text-center group"
          >
            <div className="text-3xl mb-2">🧾</div>
            <p className="text-2xl font-bold text-gray-800 mb-1">{member._count.receipts}</p>
            <p className="text-sm text-gray-600 group-hover:text-blue-600">{t('receipts')}</p>
          </Link>

          <Link
            href="/dashboard/spa"
            className="bg-white rounded-xl shadow p-4 hover:shadow-lg transition-shadow text-center group"
          >
            <div className="text-3xl mb-2">💆</div>
            <p className="text-2xl font-bold text-gray-800 mb-1">{member._count.spaBookings}</p>
            <p className="text-sm text-gray-600 group-hover:text-blue-600">{t('spa')}</p>
          </Link>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-medium mb-1">💡 {t('tip')}</p>
          <p>{t('contactManagement')}</p>
        </div>
      </div>
    </div>
  );
}
