import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { prisma } from '../../shared/database/prisma.js';
import { config } from '../../config/index.js';
import { logger } from '../../shared/utils/logger.js';
import {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  UserResponse,
  JwtPayload,
  AuthError,
} from './auth.types.js';

const SALT_ROUNDS = 12;
const TOKEN_EXPIRY = '24h';

export class AuthService {
  private static instance: AuthService | null = null;

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async register(request: RegisterRequest): Promise<AuthResponse> {
    const existing = await prisma.user.findUnique({
      where: { email: request.email },
    });

    if (existing) {
      throw AuthError.emailExists(request.email);
    }

    const passwordHash = await bcrypt.hash(request.password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: request.email,
        passwordHash,
        firstName: request.firstName,
        lastName: request.lastName,
        role: request.role ?? 'VIEWER',
      },
    });

    logger.info('User registered', { userId: user.id, email: user.email });

    const token = this.generateToken(user);

    return {
      token,
      user: this.toUserResponse(user),
    };
  }

  async login(request: LoginRequest): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email: request.email },
    });

    if (!user) {
      throw AuthError.invalidCredentials();
    }

    if (!user.isActive) {
      throw AuthError.accountDisabled();
    }

    const isValid = await bcrypt.compare(request.password, user.passwordHash);
    if (!isValid) {
      throw AuthError.invalidCredentials();
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info('User logged in', { userId: user.id });

    const token = this.generateToken(user);

    return {
      token,
      user: this.toUserResponse(user),
    };
  }

  async getProfile(userId: string): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw AuthError.userNotFound(userId);
    }

    return this.toUserResponse(user);
  }

  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, config.env.JWT_SECRET) as JwtPayload;
    } catch {
      throw new Error('Invalid or expired token');
    }
  }

  private generateToken(user: {
    id: string;
    email: string;
    role: UserRole;
  }): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, config.env.JWT_SECRET, {
      expiresIn: TOKEN_EXPIRY,
    });
  }

  private toUserResponse(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
  }): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}

export const authService = AuthService.getInstance();
