// lib/uploadsPath.ts
// Single source of truth for where member upload files live on disk.
// Electron sets UPLOADS_PATH to a writable userData folder; Next.js dev/prod
// without that env var falls back to public/uploads under the project root.

import path from 'path'

export function getMembersUploadsDir(): string {
  const isElectron = process.env.UPLOADS_PATH !== undefined
  if (isElectron && process.env.UPLOADS_PATH) {
    return path.join(process.env.UPLOADS_PATH, 'members')
  }
  return path.join(process.cwd(), 'public', 'uploads', 'members')
}

/**
 * The URL prefix that the served-image endpoints expect for member images.
 * This is what gets stored in Member.profileImage / idCardFront / idCardBack
 * regardless of where the file actually lives on disk.
 */
export const MEMBERS_UPLOADS_URL_PREFIX = '/uploads/members/'

export function isPathInsideMembersUploads(filepath: string): boolean {
  const resolved = path.resolve(filepath)
  const uploadsRoot = path.resolve(getMembersUploadsDir())
  return resolved.startsWith(uploadsRoot + path.sep) || resolved === uploadsRoot
}

//  Staff check-in selfie uploads (anti buddy-punching)
export function getStaffCheckinUploadsDir(): string {
  const isElectron = process.env.UPLOADS_PATH !== undefined
  if (isElectron && process.env.UPLOADS_PATH) {
    return path.join(process.env.UPLOADS_PATH, 'staff-checkin')
  }
  return path.join(process.cwd(), 'public', 'uploads', 'staff-checkin')
}

export const STAFF_CHECKIN_UPLOADS_URL_PREFIX = '/uploads/staff-checkin/'
