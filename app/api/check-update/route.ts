import { NextResponse } from 'next/server'
import { getGitHubApiUrl } from '../../../lib/config'

// Get GitHub API URL from centralized config

export const dynamic = 'force-dynamic'

const GITHUB_API = getGitHubApiUrl()

export async function GET() {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
    }

    // 🔑 لو الـ repo خاص، مرّر التوكن كـ Bearer
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(GITHUB_API, {
      headers,
      next: { revalidate: 3600 } // Cache for 1 hour
    })

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`)
    }

    const data = await response.json()

    return NextResponse.json({
      latestVersion: data.tag_name?.replace(/^v/, '') || null,
      downloadUrl: data.assets?.[0]?.browser_download_url || data.html_url,
      releaseNotes: data.body || '',
      publishedAt: data.published_at,
      htmlUrl: data.html_url
    })
  } catch (error) {
    console.error('Error checking for updates:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json(
      { error: 'Failed to check for updates' },
      { status: 500 }
    )
  }
}
