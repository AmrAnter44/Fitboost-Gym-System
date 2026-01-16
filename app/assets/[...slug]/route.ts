import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Serve static assets from app/assets directory
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const slug = params.slug.join('/');

  // Get the asset file path
  const assetPath = path.join(process.cwd(), 'app', 'assets', slug);

  // Check if file exists
  if (!fs.existsSync(assetPath)) {
    return new NextResponse('File not found', { status: 404 });
  }

  // Read the file
  const file = fs.readFileSync(assetPath);

  // Determine content type based on file extension
  const ext = path.extname(assetPath).toLowerCase();
  const contentTypes: { [key: string]: string } = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
  };

  const contentType = contentTypes[ext] || 'application/octet-stream';

  return new NextResponse(file, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
