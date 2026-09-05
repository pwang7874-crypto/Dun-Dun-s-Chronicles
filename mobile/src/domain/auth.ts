export interface AuthSession {
  phoneMasked: string;
  expiresAt: number;
}

export interface StoredAuthSession extends AuthSession {
  accessToken: string;
}

export interface TokenStore {
  read(): Promise<StoredAuthSession | null>;
  write(session: StoredAuthSession): Promise<void>;
  clear(): Promise<void>;
}

export interface SmsChallenge {
  challengeId: string;
  expiresIn: number;
}

export interface AuthService {
  requestSmsCode(phone: string): Promise<SmsChallenge>;
  verifySmsCode(challengeId: string, code: string): Promise<AuthSession>;
  loginWithInvite(code: string): Promise<AuthSession>;
  getSession(): Promise<AuthSession | null>;
  getAccessToken(): Promise<string | null>;
  signOut(): Promise<void>;
}

export class AuthError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
