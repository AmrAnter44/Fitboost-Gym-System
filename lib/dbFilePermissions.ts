// lib/dbFilePermissions.ts
// Helpers for ensuring DB files are writable across platforms.
// Windows app installs (especially under Electron) can leave gym.db with the
// readonly attribute set, which makes VACUUM and migrations fail with cryptic
// "attempt to write a readonly database" errors.

import { execSync } from 'child_process'

/**
 * Clear the Windows readonly attribute on a file (no-op on other platforms).
 * Call this immediately before any operation that needs exclusive write access
 * to a SQLite database file (VACUUM, migrations, restore-from-backup).
 *
 * Failure is non-fatal — if attrib isn't available or returns an error, we let
 * the caller proceed and surface the real "permission denied" if the file
 * really is locked. Logging the error helps diagnose customer issues without
 * breaking the operation when the readonly flag wasn't actually set.
 */
export function clearReadonlyOnWindows(filePath: string): void {
  if (process.platform !== 'win32') return
  try {
    execSync(`attrib -R "${filePath}"`, { stdio: 'ignore' })
  } catch (error) {
    console.warn('[dbFilePermissions] attrib -R failed:', (error as Error).message)
  }
}
