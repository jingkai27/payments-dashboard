import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { RegisterBody, LoginBody } from './auth.schemas.js';
import { UserRole } from '@prisma/client';

export class AuthController {
  async register(
    req: Request<unknown, unknown, RegisterBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.register({
        email: req.body.email,
        password: req.body.password,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        role: req.body.role as UserRole,
      });

      res.status(201).json({
        success: true,
        data: {
          token: result.token,
          user: this.formatUser(result.user),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async login(
    req: Request<unknown, unknown, LoginBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.login({
        email: req.body.email,
        password: req.body.password,
      });

      res.json({
        success: true,
        data: {
          token: result.token,
          user: this.formatUser(result.user),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
        return;
      }

      const user = await authService.getProfile(userId);

      res.json({
        success: true,
        data: this.formatUser(user),
      });
    } catch (error) {
      next(error);
    }
  }

  private formatUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

export const authController = new AuthController();
