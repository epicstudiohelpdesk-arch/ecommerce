import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  /**
   * Hashes a plaintext password using Argon2id with memory-hard parameters.
   */
  async hash(password: string): Promise<string> {
    const isTest = process.env['NODE_ENV'] === 'test';
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: isTest ? 4096 : 65536, // 64 MB in production, 4 MB in fast tests
      timeCost: isTest ? 1 : 3, // 3 iterations in production
      parallelism: 4,
    });
  }

  /**
   * Verifies a candidate password against an Argon2id hash in constant time.
   */
  async verify(hash: string, candidate: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, candidate);
    } catch {
      return false;
    }
  }
}
