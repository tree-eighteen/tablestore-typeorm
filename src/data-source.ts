// src/typeorm-style/data-source.ts

import Tablestore from "aliyun-tablestore-nodejs-sdk";
import { EntityManager } from "./entity-manager";
import { Repository } from "./repository";
import { metadataStorage, EntityMetadata } from "./decorators/metadata-storage";
import { TransactionManager, Transaction, TransactionOptions } from "./transaction";

/**
 * DataSource 配置选项
 */
export interface DataSourceOptions {
  /** Tablestore 连接配置 */
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  instancename: string;
  stsToken?: string;
  
  /** 连接选项 */
  maxRetries?: number;
  logger?: Console;
  
  /** 实体类列表 */
  entities: Function[];
  
  /** 是否自动同步表结构 */
  synchronize?: boolean;
  
  /** 是否启用日志 */
  logging?: boolean;
  
  /** 其他 Tablestore 客户端选项 */
  [key: string]: unknown;
}

/**
 * DataSource 类
 * 类似 TypeORM 的 DataSource，管理数据库连接和实体
 */
export class DataSource {
  private readonly options: DataSourceOptions;
  private client: Tablestore.Client | null = null;
  private entityManager: EntityManager | null = null;
  private transactionManager: TransactionManager | null = null;
  private repositories: Map<Function, Repository<any>> = new Map();
  private isInitialized = false;

  constructor(options: DataSourceOptions) {
    this.options = options;
    this.validateOptions();
  }

  /**
   * 验证配置选项
   */
  private validateOptions(): void {
    const { accessKeyId, secretAccessKey, endpoint, instancename } = this.options;
    
    if (!accessKeyId || !secretAccessKey || !endpoint || !instancename) {
      throw new Error(
        "缺少必要的 Tablestore 配置信息 (accessKeyId, secretAccessKey, endpoint, instancename)"
      );
    }

    if (!this.options.entities || this.options.entities.length === 0) {
      throw new Error("必须指定至少一个实体类");
    }
  }

  /**
   * 初始化 DataSource
   */
  async initialize(): Promise<DataSource> {
    if (this.isInitialized) {
      return this;
    }

    try {
      // 创建 Tablestore 客户端
      this.client = new Tablestore.Client({
        accessKeyId: this.options.accessKeyId,
        secretAccessKey: this.options.secretAccessKey,
        endpoint: this.options.endpoint,
        instancename: this.options.instancename,
        stsToken: this.options.stsToken,
        maxRetries: this.options.maxRetries,
        logger: this.options.logger,
      });

      // 创建 EntityManager
      this.entityManager = new EntityManager(this);

      // 创建 TransactionManager
      this.transactionManager = new TransactionManager(this.client, this.entityManager);

      // 注册实体
      this.registerEntities();

      // 如果启用了同步，则同步表结构
      if (this.options.synchronize) {
        await this.synchronizeSchema();
      }

      this.isInitialized = true;
      
      if (this.options.logging) {
        console.log("DataSource 初始化成功");
      }

      return this;
    } catch (error) {
      throw new Error(`DataSource 初始化失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 注册实体
   */
  private registerEntities(): void {
    for (const entity of this.options.entities) {
      const metadata = metadataStorage.getEntityMetadata(entity);
      if (!metadata) {
        throw new Error(`实体 ${entity.name} 没有被 @Entity 装饰器标记`);
      }

      if (metadata.primaryColumns.length === 0) {
        throw new Error(`实体 ${entity.name} 必须至少有一个主键列`);
      }
    }
  }

  /**
   * 同步表结构
   */
  private async synchronizeSchema(): Promise<void> {
    if (!this.client) {
      throw new Error("客户端未初始化");
    }

    for (const entity of this.options.entities) {
      const metadata = metadataStorage.getEntityMetadata(entity);
      if (!metadata) continue;

      try {
        // 检查表是否存在
        await this.client.describeTable({ tableName: metadata.tableName });
        
        if (this.options.logging) {
          console.log(`表 ${metadata.tableName} 已存在`);
        }
      } catch (error) {
        // 表不存在，创建表
        if (metadata.autoCreateTable !== false) {
          await this.createTable(metadata);
        }
      }
    }
  }

  /**
   * 创建表
   */
  private async createTable(metadata: EntityMetadata): Promise<void> {
    if (!this.client) {
      throw new Error("客户端未初始化");
    }

    const primaryKeyColumns = metadata.primaryColumns.map((column: any) => ({
      name: column.propertyName,
      type: this.getTablestorePrimaryKeyType(column.tablestoreType || 'STRING')
    }));

    const createParams = {
      tableMeta: {
        tableName: metadata.tableName,
        primaryKey: primaryKeyColumns
      },
      reservedThroughput: {
        capacityUnit: {
          read: metadata.reservedThroughput?.read || 0,
          write: metadata.reservedThroughput?.write || 0
        }
      },
      tableOptions: {
        timeToLive: metadata.tableOptions?.timeToLive || -1,
        maxVersions: metadata.tableOptions?.maxVersions || 1
      }
    };

    await this.client.createTable(createParams);

    if (this.options.logging) {
      console.log(`表 ${metadata.tableName} 创建成功`);
    }

    // 等待表变为活跃状态
    await this.waitForTableActive(metadata.tableName);
  }

  /**
   * 等待表变为活跃状态
   */
  private async waitForTableActive(tableName: string): Promise<void> {
    if (!this.client) return;

    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      try {
        await this.client.describeTable({ tableName });
        return;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
    }

    throw new Error(`等待表 ${tableName} 激活超时`);
  }

  /**
   * 获取 Tablestore 主键类型
   */
  private getTablestorePrimaryKeyType(type: string): any {
    switch (type) {
      case 'STRING':
        return Tablestore.PrimaryKeyType.STRING;
      case 'INTEGER':
        return Tablestore.PrimaryKeyType.INTEGER;
      case 'BINARY':
        return Tablestore.PrimaryKeyType.BINARY;
      default:
        return Tablestore.PrimaryKeyType.STRING;
    }
  }

  /**
   * 获取 Tablestore 客户端
   */
  getClient(): Tablestore.Client {
    if (!this.client) {
      throw new Error("DataSource 未初始化，请先调用 initialize()");
    }
    return this.client;
  }

  /**
   * 获取 EntityManager
   */
  getEntityManager(): EntityManager {
    if (!this.entityManager) {
      throw new Error("DataSource 未初始化，请先调用 initialize()");
    }
    return this.entityManager;
  }

  /**
   * 获取指定实体的 Repository
   */
  getRepository<T extends object>(entity: new () => T): Repository<T> {
    const existingRepo = this.repositories.get(entity);
    if (existingRepo) {
      return existingRepo;
    }

    const repository = new Repository<T>(entity, this.getEntityManager());
    this.repositories.set(entity, repository);
    return repository;
  }

  /**
   * 获取事务管理器
   */
  getTransactionManager(): TransactionManager {
    if (!this.transactionManager) {
      throw new Error("DataSource 未初始化，请先调用 initialize()");
    }
    return this.transactionManager;
  }

  /**
   * 开始一个新的局部事务
   *
   * @param tableName 表名
   * @param partitionKey 分区键值（只需要指定第一个主键）
   * @param options 事务选项
   *
   * @example
   * ```typescript
   * const transaction = await dataSource.startTransaction('users', { userId: '123' });
   * try {
   *   await transaction.save(user1);
   *   await transaction.save(user2);
   *   await transaction.commit();
   * } catch (error) {
   *   await transaction.rollback();
   * }
   * ```
   */
  async startTransaction(
    tableName: string,
    partitionKey: Record<string, any>,
    options?: TransactionOptions
  ): Promise<Transaction> {
    return this.getTransactionManager().startTransaction(tableName, partitionKey, options);
  }

  /**
   * 执行事务操作（自动提交/回滚）
   *
   * @param tableName 表名
   * @param partitionKey 分区键值
   * @param callback 事务操作回调
   * @param options 事务选项
   *
   * @example
   * ```typescript
   * const result = await dataSource.runInTransaction('users', { userId: '123' }, async (transaction) => {
   *   await transaction.save(user1);
   *   await transaction.save(user2);
   *   return 'success';
   * });
   * ```
   */
  async runInTransaction<T>(
    tableName: string,
    partitionKey: Record<string, any>,
    callback: (transaction: Transaction) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    return this.getTransactionManager().runInTransaction(tableName, partitionKey, callback, options);
  }

  /**
   * 销毁 DataSource
   */
  async destroy(): Promise<void> {
    this.client = null;
    this.entityManager = null;
    this.transactionManager = null;
    this.repositories.clear();
    this.isInitialized = false;

    if (this.options.logging) {
      console.log("DataSource 已销毁");
    }
  }

  /**
   * 检查是否已初始化
   */
  get initialized(): boolean {
    return this.isInitialized;
  }
}
