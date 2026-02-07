import { UserRole } from '@prisma/client';

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: UserResponse;
}

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export class AuthError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }

  static invalidCredentials(): AuthError {
    return new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  static emailExists(email: string): AuthError {
    return new AuthError(`Email ${email} is already registered`, 'EMAIL_EXISTS');
  }

  static userNotFound(id: string): AuthError {
    return new AuthError(`User ${id} not found`, 'USER_NOT_FOUND');
  }

  static accountDisabled(): AuthError {
    return new AuthError('Account is disabled', 'ACCOUNT_DISABLED');
  }
}
