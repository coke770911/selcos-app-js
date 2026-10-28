import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { buildMssqlConfig } from './mssqlConfig.js';

let client: PrismaClient | undefined;

/** 延遲建立 Prisma client，第一次使用時才連線 */
export function getPrisma(): PrismaClient {
  client ??= new PrismaClient({ adapter: new PrismaMssql(buildMssqlConfig(env)) });
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}
