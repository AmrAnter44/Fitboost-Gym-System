import { NextResponse } from 'next/server'

const GITHUB_API = 'https://api.github.com/repos/AmrAnter44/sys-Xgym/releases/latest'

export async function GET() {
  try {
    const response = await fetch(GITHUB_API, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    })

    if (!response.ok) {
      throw new Error('Failed to fetch release info')
    }

    const data = await response.json()

    return NextResponse.json({
      latestVersion: data.tag_name.replace('v', ''), // Remove 'v' prefix
      downloadUrl: data.assets[0]?.browser_download_url || data.html_url,
      releaseNotes: data.body || '',
      publishedAt: data.published_at,
      htmlUrl: data.html_url
    })
  } catch (error) {
    console.error('Error checking for updates:', error)
    return NextResponse.json(
      { error: 'Failed to check for updates' },
      { status: 500 }
    )
  }
}
