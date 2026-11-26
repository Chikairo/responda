import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AuthSessionInfo, StaffAccount, UserRole } from '../src/types/responda.ts';

// Keep signing secret strictly in process.env or generate an ephemeral per-process secret (never hardcode a fallback literal)
const RUNTIME_EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  const configured = process.env.RESPONDA_SESSION_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : RUNTIME_EPHEMERAL_SECRET;
}

export interface SessionTokenPayload {
  accountId: string;
  role: UserRole;
  issuedAt: number;
  exp: number;
}

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64').toString('utf-8');
}

export function signSessionToken(payload: SessionTokenPayload): string {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest();
  return `${encodedPayload}.${toBase64Url(sig)}`;
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, encodedSig] = parts;
  if (!encodedPayload || !encodedSig) return null;

  try {
    const expectedSig = crypto
      .createHmac('sha256', getSessionSecret())
      .update(encodedPayload)
      .digest();
    const expectedB64 = toBase64Url(expectedSig);

    const a = Buffer.from(encodedSig, 'utf-8');
    const b = Buffer.from(expectedB64, 'utf-8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const decoded = JSON.parse(fromBase64Url(encodedPayload)) as SessionTokenPayload;
    if (
      !decoded ||
      typeof decoded.accountId !== 'string' ||
      typeof decoded.exp !== 'number' ||
      decoded.exp <= Date.now()
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function issueDemoSession(account: StaffAccount): AuthSessionInfo {
  if (account.accountStatus !== 'ACTIVE') {
    throw new Error(
      `Account ${account.name} has status '${account.accountStatus}' and cannot sign in.`
    );
  }
  const now = Date.now();
  const token = signSessionToken({
    accountId: account.id,
    role: account.role,
    issuedAt: now,
    exp: now + TOKEN_TTL_MS,
  });
  return {
    token,
    account,
    isDemoSession: true,
  };
}

export interface AuthenticatedRequest extends Request {
  authAccount?: StaffAccount;
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function createAuthMiddleware(getStaffAccounts: () => Promise<StaffAccount[]>) {
  async function resolveAccount(req: Request): Promise<
    | { ok: true; account: StaffAccount }
    | { ok: false; code: 401 | 403; error: string }
  > {
    const token = extractBearerToken(req);
    if (!token) {
      return {
        ok: false,
        code: 401,
        error: 'Authentication required. Obtain a validated session token via /api/auth/demo-session.',
      };
    }

    const payload = verifySessionToken(token);
    if (!payload) {
      return {
        ok: false,
        code: 401,
        error: 'Session token is invalid or expired.',
      };
    }

    const accounts = await getStaffAccounts();
    const account = accounts.find((a) => a.id === payload.accountId);
    if (!account) {
      return {
        ok: false,
        code: 401,
        error: 'Authenticated staff account no longer exists.',
      };
    }

    if (account.accountStatus !== 'ACTIVE') {
      return {
        ok: false,
        code: 403,
        error: `Account '${account.name}' is ${account.accountStatus} and cannot perform authorised actions.`,
      };
    }

    return { ok: true, account };
  }

  function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    resolveAccount(req)
      .then((result) => {
        if (!result.ok) {
          res.status(result.code).json({ error: result.error });
          return;
        }
        req.authAccount = result.account;
        next();
      })
      .catch((err) => {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Authentication check failed.',
        });
      });
  }

  function requireRole(...allowedRoles: UserRole[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      resolveAccount(req)
        .then((result) => {
          if (!result.ok) {
            res.status(result.code).json({ error: result.error });
            return;
          }
          if (!allowedRoles.includes(result.account.role)) {
            res.status(403).json({
              error: `Role '${result.account.role}' is not authorised for this action. Required: ${allowedRoles.join(' or ')}.`,
            });
            return;
          }
          req.authAccount = result.account;
          next();
        })
        .catch((err) => {
          res.status(500).json({
            error: err instanceof Error ? err.message : 'Authorisation check failed.',
          });
        });
    };
  }

  return { requireAuth, requireRole };
}
