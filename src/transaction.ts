// src/transaction.ts

import Tablestore from "aliyun-tablestore-nodejs-sdk";
import { EntityManager } from "./entity-manager";
import { SaveOptions, DeleteOptions } from "./repository";

/**
 * 事务选项
 */
export interface TransactionOptions {
  /** 事务超时时间（毫秒），默认 60000ms (60秒) */
  timeout?: number;
}

/**
 * 事务状态
 */
export enum TransactionStatus {
  ACTIVE = 'ACTIVE',
  COMMITTED = 'COMMITTED',
  ABORTED = 'ABORTED',
  TIMEOUT = 'TIMEOUT'
}

/**
 * 局部事务管理器
 * 
 * 基于 Tablestore 的局部事务功能，提供 ACID 事务支持
 * 
 * 限制：
 * - 事务范围限制在单个分区键值内
 * - 事务生命周期最长 60 秒
 * - 写入数据量最大 4MB
 * - 同一事务中所有写操作的分区键值必须相同
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
export class Transaction {
  private readonly client: Tablestore.Client;
  private readonly entityManager: EntityManager;
  private readonly tableName: string;
  private readonly partitionKey: Tablestore.PrimaryKeyInput;
  private readonly transactionId: string;
  private readonly startTime: number;
  private readonly timeout: number;
  private status: TransactionStatus = TransactionStatus.ACTIVE;

  constructor(
    client: Tablestore.Client,
    entityManager: EntityManager,
    tableName: string,
    partitionKey: Tablestore.PrimaryKeyInput,
    transactionId: string,
    options?: TransactionOptions
  ) {
    this.client = client;
    this.entityManager = entityManager;
    this.tableName = tableName;
    this.partitionKey = partitionKey;
    this.transactionId = transactionId;
    this.startTime = Date.now();
    this.timeout = options?.timeout || 60000; // 默认 60 秒
  }

  /**
   * 获取事务ID
   */
  getTransactionId(): string {
    return this.transactionId;
  }

  /**
   * 获取事务状态
   */
  getStatus(): TransactionStatus {
    return this.status;
  }

  /**
   * 检查事务是否仍然活跃
   */
  isActive(): boolean {
    if (this.status !== TransactionStatus.ACTIVE) {
      return false;
    }

    // 检查是否超时
    if (Date.now() - this.startTime > this.timeout) {
      this.status = TransactionStatus.TIMEOUT;
      return false;
    }

    return true;
  }

  /**
   * 在事务中保存实体
   */
  async save<T extends object>(entity: T, options?: SaveOptions): Promise<T> {
    this.ensureActive();

    const entityClass = entity!.constructor as new () => T;
    const metadata = (this.entityManager as any).getEntityMetadata(entityClass);

    // 验证实体的分区键是否与事务的分区键匹配
    this.validatePartitionKey(entity, metadata);

    // 处理特殊列
    (this.entityManager as any).processSpecialColumnsOnInsert(entity, metadata);

    // 转换实体数据
    const { primaryKey, attributeColumns } = (this.entityManager as any).convertEntityToTablestore(entity, metadata);

    // 合并事务条件
    const condition = options?.condition || new Tablestore.Condition(
      Tablestore.RowExistenceExpectation.IGNORE,
      null
    );

    // 执行事务内的保存操作
    await this.client.putRow({
      tableName: metadata.tableName,
      condition,
      primaryKey,
      attributeColumns,
      transactionId: this.transactionId,
      returnContent: { returnType: Tablestore.ReturnType.Primarykey }
    });

    return entity;
  }

  /**
   * 在事务中更新实体
   */
  async update<T>(
    entityClass: new () => T,
    primaryKeys: Partial<T>,
    partialEntity: Partial<T>
  ): Promise<void> {
    this.ensureActive();

    const metadata = (this.entityManager as any).getEntityMetadata(entityClass);

    // 验证主键的分区键是否与事务的分区键匹配
    this.validatePartitionKey(primaryKeys, metadata);

    // 处理特殊列
    await (this.entityManager as any).processSpecialColumnsOnUpdate(partialEntity, metadata, primaryKeys);

    // 转换数据
    const tablestorePrimaryKey = (this.entityManager as any).convertPrimaryKeysToTablestore(primaryKeys, metadata);
    const updateOfAttributeColumns = (this.entityManager as any).convertPartialEntityToTablestoreUpdate(partialEntity, metadata);

    const condition = new Tablestore.Condition(
      Tablestore.RowExistenceExpectation.EXPECT_EXIST,
      null
    );

    // 执行事务内的更新操作
    await this.client.updateRow({
      tableName: metadata.tableName,
      condition,
      primaryKey: tablestorePrimaryKey,
      updateOfAttributeColumns,
      transactionId: this.transactionId,
      returnContent: { returnType: Tablestore.ReturnType.Primarykey }
    });
  }

  /**
   * 在事务中删除实体
   */
  async delete<T>(
    entityClass: new () => T,
    primaryKeys: Partial<T>,
    options?: DeleteOptions
  ): Promise<void> {
    this.ensureActive();

    const metadata = (this.entityManager as any).getEntityMetadata(entityClass);

    // 验证主键的分区键是否与事务的分区键匹配
    this.validatePartitionKey(primaryKeys, metadata);

    // 转换主键
    const tablestorePrimaryKey = (this.entityManager as any).convertPrimaryKeysToTablestore(primaryKeys, metadata);

    const condition = options?.condition || new Tablestore.Condition(
      Tablestore.RowExistenceExpectation.EXPECT_EXIST,
      null
    );

    // 执行事务内的删除操作
    await this.client.deleteRow({
      tableName: metadata.tableName,
      condition,
      primaryKey: tablestorePrimaryKey,
      transactionId: this.transactionId
    });
  }

  /**
   * 在事务中查找实体
   */
  async findOne<T>(entityClass: new () => T, primaryKeys: Partial<T>): Promise<T | null> {
    this.ensureActive();

    const metadata = (this.entityManager as any).getEntityMetadata(entityClass);

    // 转换主键
    const tablestorePrimaryKey = (this.entityManager as any).convertPrimaryKeysToTablestore(primaryKeys, metadata);

    try {
      const response = await this.client.getRow({
        tableName: metadata.tableName,
        primaryKey: tablestorePrimaryKey,
        transactionId: this.transactionId
      });

      if (!response?.row || !response.row.primaryKey) {
        return null;
      }

      // 转换数据
      return (this.entityManager as any).convertTablestoreToEntity(response.row, entityClass, metadata);
    } catch (error) {
      if ((this.entityManager as any).isRowNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * 批量写入操作
   */
  async batchWrite(operations: BatchWriteOperation[]): Promise<void> {
    this.ensureActive();

    if (operations.length === 0) {
      return;
    }

    // 验证所有操作都在同一个表和分区键范围内
    const firstOp = operations[0];
    const tableName = firstOp.tableName;

    for (const op of operations) {
      if (op.tableName !== tableName) {
        throw new Error('事务中的批量操作必须在同一个表内');
      }
    }

    // 构建批量写入请求
    const tables: any = {};
    tables[tableName] = operations.map(op => op.request);

    await this.client.batchWriteRow({
      tables,
      transactionId: this.transactionId
    });
  }

  /**
   * 提交事务
   */
  async commit(): Promise<void> {
    this.ensureActive();

    try {
      await this.client.commitTransaction({
        transactionId: this.transactionId
      });
      this.status = TransactionStatus.COMMITTED;
    } catch (error) {
      this.status = TransactionStatus.ABORTED;
      throw error;
    }
  }

  /**
   * 回滚事务
   */
  async rollback(): Promise<void> {
    if (this.status !== TransactionStatus.ACTIVE) {
      return; // 已经不是活跃状态，无需回滚
    }

    try {
      await this.client.abortTransaction({
        transactionId: this.transactionId
      });
    } finally {
      this.status = TransactionStatus.ABORTED;
    }
  }

  /**
   * 确保事务仍然活跃
   */
  private ensureActive(): void {
    if (!this.isActive()) {
      throw new Error(`事务已${this.status === TransactionStatus.TIMEOUT ? '超时' : '结束'}，无法执行操作`);
    }
  }

  /**
   * 验证分区键是否匹配
   */
  private validatePartitionKey<T>(entity: Partial<T>, metadata: any): void {
    // 获取实体的分区键值（第一个主键）
    const firstPrimaryColumn = metadata.primaryColumns[0];
    if (!firstPrimaryColumn) {
      throw new Error('实体必须有至少一个主键');
    }

    const entityPartitionValue = (entity as any)[firstPrimaryColumn.propertyName];
    const transactionPartitionValue = this.partitionKey[0]?.[firstPrimaryColumn.propertyName];

    if (entityPartitionValue !== transactionPartitionValue) {
      throw new Error(`实体的分区键值 ${String(entityPartitionValue)} 与事务的分区键值 ${String(transactionPartitionValue)} 不匹配`);
    }
  }
}

/**
 * 批量写入操作接口
 */
export interface BatchWriteOperation {
  tableName: string;
  request: any; // Tablestore 的具体请求对象
}

/**
 * 事务管理器
 */
export class TransactionManager {
  private readonly client: Tablestore.Client;
  private readonly entityManager: EntityManager;

  constructor(client: Tablestore.Client, entityManager: EntityManager) {
    this.client = client;
    this.entityManager = entityManager;
  }

  /**
   * 开始一个新的局部事务
   * 
   * @param tableName 表名
   * @param partitionKey 分区键值（只需要指定第一个主键）
   * @param options 事务选项
   */
  async startTransaction(
    tableName: string,
    partitionKey: Record<string, any>,
    options?: TransactionOptions
  ): Promise<Transaction> {
    // 转换分区键为 Tablestore 格式
    const tablestorePartitionKey: Tablestore.PrimaryKeyInput = [];
    for (const [key, value] of Object.entries(partitionKey)) {
      tablestorePartitionKey.push({ [key]: value });
    }

    // 创建局部事务
    const response = await this.client.startLocalTransaction({
      tableName,
      primaryKey: tablestorePartitionKey
    });

    return new Transaction(
      this.client,
      this.entityManager,
      tableName,
      tablestorePartitionKey,
      response.transactionId,
      options
    );
  }

  /**
   * 执行事务操作（自动提交/回滚）
   * 
   * @param tableName 表名
   * @param partitionKey 分区键值
   * @param callback 事务操作回调
   * @param options 事务选项
   */
  async runInTransaction<T>(
    tableName: string,
    partitionKey: Record<string, any>,
    callback: (transaction: Transaction) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const transaction = await this.startTransaction(tableName, partitionKey, options);

    try {
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
