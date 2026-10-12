import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { getDb, type DatabaseInstance } from '@repo/db';
import * as schema from '@repo/db';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly dbInstance: DatabaseInstance;

  constructor() {
    this.dbInstance = getDb();
  }

  get db() {
    return this.dbInstance.db;
  }

  get client() {
    return this.dbInstance.client;
  }

  get schema() {
    return schema;
  }

  async onModuleDestroy() {
    await this.dbInstance.close();
  }
}
