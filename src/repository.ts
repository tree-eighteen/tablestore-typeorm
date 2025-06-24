// src/typeorm-style/repository.ts

import Tablestore from "aliyun-tablestore-nodejs-sdk";
import { EntityManager } from "./entity-manager";
import {
  metadataStorage,
  EntityMetadata,
  ColumnMetadata,
} from "./decorators/metadata-storage";
import { QueryBuilder } from "./query-builder";
import {
  FindOptions,
  CursorPaginationOptions,
  CursorPaginationResult,
  PaginationUtils,
} from "./pagination";

/**
 * 保存选项
 */
export interface SaveOptions {
  /** 写入条件 */
  condition?: Tablestore.Condition;
}

/**
 * 删除选项
 */
export interface DeleteOptions {
  /** 删除条件 */
  condition?: Tablestore.Condition;
}

/**
 * Repository 基类
 * 提供标准的 CRUD 操作
 */
export class Repository<T extends object> {
  protected readonly entityClass: new () => T;
  protected readonly entityManager: EntityManager;
  protected readonly metadata: EntityMetadata;

  constructor(entityClass: new () => T, entityManager: EntityManager) {
    this.entityClass = entityClass;
    this.entityManager = entityManager;

    const metadata = metadataStorage.getEntityMetadata(entityClass);
    if (!metadata) {
      throw new Error(`实体 ${entityClass.name} 没有被 @Entity 装饰器标记`);
    }
    this.metadata = metadata;
  }

  /**
   * 创建一个新的实体实例（不保存到数据库）
   */
  create(entityLike?: Partial<T>): T {
    const entity = new this.entityClass();
    if (entityLike) {
      Object.assign(entity, entityLike);
    }
    return entity;
  }

  /**
   * 保存实体到数据库
   */
  async save(entity: T, options?: SaveOptions): Promise<T> {
    return this.entityManager.save(entity, options);
  }

  /**
   * 保存多个实体到数据库
   */
  async saveMany(entities: T[], options?: SaveOptions): Promise<T[]> {
    const results: T[] = [];
    for (const entity of entities) {
      const result = await this.save(entity, options);
      results.push(result);
    }
    return results;
  }

  /**
   * 根据主键查找实体
   */
  async findOne(primaryKeys: Partial<T>): Promise<T | null> {
    return this.entityManager.findOne(this.entityClass, primaryKeys);
  }

  /**
   * 根据条件查找实体
   */
  async findOneBy(where: Partial<T>): Promise<T | null> {
    const results = await this.find({ where, take: 1 });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * 查找多个实体
   *
   * 注意：options.where 只能用于主键字段查询
   * 如需查询非主键字段，请使用 createQueryBuilder().filter() 方法
   *
   * @param options 查询选项
   * @param options.where 主键字段查询条件（仅支持主键字段的等值匹配）
   * @param options.take 限制返回记录数
   * @param options.startAfter 分页起始位置（主键值）
   * @param options.endBefore 分页结束位置（主键值）
   * @param options.select 指定返回的字段
   *
   * @example
   * // 主键查询（有效）
   * await repository.find({ where: { id: "123" } });
   *
   * // 非主键查询（无效，where 条件会被忽略）
   * await repository.find({ where: { name: "John" } }); // 错误用法
   *
   * // 正确的非主键查询方式
   * await repository.createQueryBuilder()
   *   .filter(f => f.equals('name', 'John'))
   *   .getMany();
   */
  async find(options?: FindOptions<T>): Promise<T[]> {
    const queryBuilder = this.createQueryBuilder();

    if (options?.where) {
      queryBuilder.where(options.where);
    }

    if (options?.take) {
      queryBuilder.limit(options.take);
    }

    if (options?.startAfter) {
      queryBuilder.startWith(options.startAfter);
    }

    if (options?.endBefore) {
      queryBuilder.endWith(options.endBefore);
    }

    if (options?.select) {
      queryBuilder.select(options.select as string[]);
    }

    const result = await queryBuilder.getMany();
    return result;
  }

  /**
   * 查找所有实体
   */
  async findAll(): Promise<T[]> {
    return this.find();
  }

  /**
   * 根据条件查找多个实体
   */
  async findBy(where: Partial<T>): Promise<T[]> {
    return this.find({ where });
  }

  /**
   * 统计实体数量
   */
  async count(where?: Partial<T>): Promise<number> {
    const entities = await this.find({ where });
    return entities.length;
  }

  /**
   * 根据主键删除实体
   */
  async delete(
    primaryKeys: Partial<T>,
    options?: DeleteOptions
  ): Promise<void> {
    await this.entityManager.delete(this.entityClass, primaryKeys, options);
  }

  /**
   * 删除实体
   */
  async remove(entity: T, options?: DeleteOptions): Promise<void> {
    const primaryKeys = this.extractPrimaryKeys(entity);
    await this.delete(primaryKeys, options);
  }

  /**
   * 删除多个实体
   */
  async removeMany(entities: T[], options?: DeleteOptions): Promise<void> {
    for (const entity of entities) {
      await this.remove(entity, options);
    }
  }

  /**
   * 根据条件删除实体
   */
  async deleteBy(where: Partial<T>, options?: DeleteOptions): Promise<void> {
    const entities = await this.findBy(where);
    await this.removeMany(entities, options);
  }

  /**
   * 更新实体
   */
  async update(
    primaryKeys: Partial<T>,
    partialEntity: Partial<T>
  ): Promise<void> {
    await this.entityManager.update(
      this.entityClass,
      primaryKeys,
      partialEntity
    );
  }

  /**
   * 创建查询构建器
   */
  createQueryBuilder(alias?: string): QueryBuilder<T> {
    return new QueryBuilder<T>(this.entityClass, this.entityManager, alias);
  }

  /**
   * 提取实体的主键值
   */
  private extractPrimaryKeys(entity: T): Partial<T> {
    const primaryKeys: any = {};

    for (const column of this.metadata.primaryColumns) {
      const value = (entity as any)[column.propertyName];
      if (value !== undefined) {
        primaryKeys[column.propertyName] = value;
      }
    }

    return primaryKeys;
  }

  /**
   * 获取实体元数据
   */
  getMetadata(): EntityMetadata {
    return this.metadata;
  }

  /**
   * 获取表名
   */
  getTableName(): string {
    return this.metadata.tableName;
  }

  /**
   * 获取主键列
   */
  getPrimaryColumns(): ColumnMetadata[] {
    return this.metadata.primaryColumns;
  }

  /**
   * 获取所有列
   */
  getColumns(): ColumnMetadata[] {
    return this.metadata.columns;
  }

  /**
   * 软删除实体（根据主键）
   */
  async softDelete(primaryKeys: Partial<T>): Promise<void> {
    if (!this.metadata.deleteDateColumn) {
      throw new Error(
        `实体 ${this.entityClass.name} 没有定义 @DeleteDateColumn，无法执行软删除`
      );
    }
    await (this.entityManager as any).softDelete(this.entityClass, primaryKeys);
  }

  /**
   * 软删除实体
   */
  async softRemove(entity: T): Promise<void> {
    const primaryKeys = this.extractPrimaryKeys(entity);
    await this.softDelete(primaryKeys);
  }

  /**
   * 软删除多个实体
   */
  async softRemoveMany(entities: T[]): Promise<void> {
    for (const entity of entities) {
      await this.softRemove(entity);
    }
  }

  /**
   * 根据条件软删除实体
   */
  async softDeleteBy(where: Partial<T>): Promise<void> {
    const entities = await this.findBy(where);
    await this.softRemoveMany(entities);
  }

  /**
   * 恢复软删除的实体（根据主键）
   */
  async restore(primaryKeys: Partial<T>): Promise<void> {
    if (!this.metadata.deleteDateColumn) {
      throw new Error(
        `实体 ${this.entityClass.name} 没有定义 @DeleteDateColumn，无法执行恢复操作`
      );
    }
    await (this.entityManager as any).restore(this.entityClass, primaryKeys);
  }

  /**
   * 恢复软删除的实体
   */
  async restoreEntity(entity: T): Promise<void> {
    const primaryKeys = this.extractPrimaryKeys(entity);
    await this.restore(primaryKeys);
  }

  /**
   * 查找包括软删除的实体
   */
  async findWithDeleted(options?: FindOptions<T>): Promise<T[]> {
    // 这里需要修改查询逻辑以包含软删除的记录
    // 暂时使用普通查询，后续可以扩展
    return this.find(options);
  }

  /**
   * 只查找软删除的实体
   */
  async findDeleted(options?: FindOptions<T>): Promise<T[]> {
    if (!this.metadata.deleteDateColumn) {
      return [];
    }

    const deleteDateColumnName = this.metadata.deleteDateColumn.propertyName;
    const whereCondition = {
      ...options?.where,
      [deleteDateColumnName]: { $ne: null }, // 不等于 null
    } as Partial<T>;

    return this.find({
      ...options,
      where: whereCondition,
    });
  }

  /**
   * 检查实体是否被软删除
   */
  isSoftDeleted(entity: T): boolean {
    if (!this.metadata.deleteDateColumn) {
      return false;
    }

    const deleteDateValue = (entity as any)[
      this.metadata.deleteDateColumn.propertyName
    ];
    return deleteDateValue !== null && deleteDateValue !== undefined;
  }

  /**
   * 检查实体是否有软删除功能
   */
  hasSoftDelete(): boolean {
    return !!this.metadata.deleteDateColumn;
  }

  /**
   * 检查实体是否有版本控制功能
   */
  hasVersionControl(): boolean {
    return !!this.metadata.versionColumn;
  }

  /**
   * 检查实体是否有创建时间自动设置功能
   */
  hasCreateDate(): boolean {
    return !!this.metadata.createDateColumn;
  }

  /**
   * 检查实体是否有更新时间自动设置功能
   */
  hasUpdateDate(): boolean {
    return !!this.metadata.updateDateColumn;
  }

  /**
   * 分页查询
   *
   * 支持两种查询条件：
   * 1. where: 仅适用于主键字段的等值查询
   * 2. filter: 适用于任何字段的复杂查询条件
   *
   * @param options 分页查询选项
   * @param options.limit 每页记录数
   * @param options.cursor 分页游标（用于获取下一页）
   * @param options.order 排序方向：'ASC' 升序，'DESC' 降序
   * @param options.where 主键字段查询条件（仅支持主键字段的等值匹配）
   * @param options.filter 高级过滤条件（支持任何字段的复杂查询）
   *
   * @example
   * // 基础分页
   * const result = await repository.page({ limit: 10 });
   *
   * // 主键条件分页（仅适用于主键字段）
   * const result = await repository.page({
   *   limit: 10,
   *   where: { userId: "123" } // userId 必须是主键字段
   * });
   *
   * // 复杂条件分页（适用于任何字段）
   * const result = await repository.page({
   *   limit: 10,
   *   filter: f => f.and(
   *     f.greaterThan('age', 18),
   *     f.equals('city', '北京')
   *   )
   * });
   *
   * // 组合使用（主键范围 + 非主键过滤）
   * const result = await repository.page({
   *   limit: 10,
   *   where: { userId: "123" }, // 主键范围
   *   filter: f => f.equals('isActive', true) // 非主键过滤
   * });
   */
  async page(
    options: CursorPaginationOptions<T>
  ): Promise<CursorPaginationResult<T>> {
    let startAfter: Partial<T> | undefined;

    if (options.cursor) {
      try {
        startAfter = PaginationUtils.decodeCursor<T>(options.cursor);
      } catch (error) {
        throw new Error(
          `无效的游标: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    // 直接使用 QueryBuilder 进行查询
    const queryBuilder = this.createQueryBuilder();
    queryBuilder.limit(options.limit);

    // 添加 WHERE 条件（仅适用于主键字段）
    if (options.where) {
      queryBuilder.where(options.where);
    }

    // 添加 FILTER 条件（适用于任何字段）
    if (options.filter) {
      queryBuilder.filter(options.filter);
    }

    if (startAfter) {
      queryBuilder.startWith(startAfter);
    }

    // 根据分页方向设置主键排序
    if (options.order === "DESC") {
      queryBuilder.orderBy("DESC");
    } else {
      queryBuilder.orderBy("ASC");
    }

    // 执行查询并获取 nextStartPrimaryKey
    const result = await queryBuilder.getRawAndEntities();
    const hasNext = !!result.nextStartPrimaryKey;

    let nextCursor: string | undefined;
    if (hasNext && result.nextStartPrimaryKey) {
      const primaryKeys = PaginationUtils.createPrimaryKeysFromTablestore<T>(
        result.nextStartPrimaryKey
      );
      nextCursor = PaginationUtils.encodeCursor(primaryKeys);
    }

    return {
      items: result.entities,
      hasNext,
      nextCursor,
    };
  }
}
