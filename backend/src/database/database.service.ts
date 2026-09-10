import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const connectionString =
      this.configService.get<string>('DATABASE_URL');

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not configured');
    }

    this.pool = new Pool({
      connectionString,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query('SELECT 1');
    this.logger.log('PostgreSQL connection established');
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }
 
 async withTransaction<T>(
   callback: (client: PoolClient) => Promise<T>,
 ): Promise<T> {
   const client = await this.pool.connect();

   try {
     await client.query('BEGIN');

     const result = await callback(client);

     await client.query('COMMIT');
 
     return result;
   } catch (error) {
     await client.query('ROLLBACK');
     throw error;
   } finally {
     client.release();
   }
 }		

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
