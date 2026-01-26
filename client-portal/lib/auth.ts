import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';

export interface MemberTokenPayload {
  memberId: string;
  memberNumber: number;
  name: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate JWT token for authenticated member
 * Token expires in 7 days
 */
export function generateMemberToken(payload: Omit<MemberTokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d',
  });
}

/**
 * Verify JWT token from HTTP-only cookie
 * Returns member payload if valid, null otherwise
 */
export async function verifyMemberToken(
  request: NextRequest
): Promise<MemberTokenPayload | null> {
  try {
    const token = request.cookies.get('member-token')?.value;

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as MemberTokenPayload;
    return decoded;
  } catch (error) {
    // Token expired, invalid, or malformed
    return null;
  }
}

/**
 * Extract IP address from request
 * Useful for rate limiting
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown';
}
