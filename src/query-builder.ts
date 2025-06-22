// src/typeorm-style/query-builder.ts

import Tablestore from "aliyun-tablestore-nodejs-sdk";
import { EntityManager } from "./entity-manager";
import { metadataStorage, EntityMetadata } from "./decorators/metadata-storage";
import { FilterFactory } from "./filter-factory";


/**
 * 查询结果
 */
export interface QueryResult<T> {
  entities: T[];
  total?: number;
  nextStartPrimaryKey?: Tablestore.PrimaryKeyOutput;
}

/**
 * 排序方向
 */
export type OrderDirection = 'ASC' | 'DESC';

/**
 * QueryBuilder 类
 * 提供类似 TypeORM 的链式查询接口
 */
export class QueryBuilder<T> {
  private readonly entityClass: new () => T;
  private readonly entityManager: EntityManager;
  private readonly metadata: EntityMetadata;
  private readonly alias: string;

  // 查询状态
  private _select: string[] = [];
  private _where: any = {};
  private _orderBy: { [key: string]: OrderDirection } = {};
  private _limit?: number;
  private _startPrimaryKey?: Tablestore.PrimaryKeyInput;
  private _endPrimaryKey?: Tablestore.PrimaryKeyInput;
  private _columnCondition?: Tablestore.ColumnCondition;

  constructor(entityClass: new () => T, entityManager: EntityManager, alias?: string) {
    this.entityClass = entityClass;
    this.entityManager = entityManager;
    this.alias = alias || entityClass.name.toLowerCase();
    
    const metadata = metadataStorage.getEntityMetadata(entityClass);
    if (!metadata) {
      throw new Error(`实体 ${entityClass.name} 没有被 @Entity 装饰器标记`);
    }
    this.metadata = metadata;
  }

  /**
   * 选择要返回的列
   */
  select(columns: string[]): this;
  select(...columns: string[]): this;
  select(columnsOrFirstColumn: string[] | string, ...restColumns: string[]): this {
    if (Array.isArray(columnsOrFirstColumn)) {
      this._select = columnsOrFirstColumn;
    } else {
      this._select = [columnsOrFirstColumn, ...restColumns];
    }
    return this;
  }

  /**
   * 添加 WHERE 条件 - 仅适用于主键字段查询
   *
   * 使用场景：
   * 1. 精确主键查询：当包含所有主键字段时，使用高效的 getRow 查询
   * 2. 部分主键查询：当只包含部分主键字段时，自动转换为 getRange 范围查询
   *
   * 限制：
   * - 只能用于主键字段，非主键字段的条件会被忽略
   * - 只支持等值匹配，不支持范围查询（如 >、<、>=、<= 等）
   * - 不支持复杂逻辑操作（如 AND、OR、NOT）
   *
   * @param condition 查询条件对象，键为实体字段名，值为要匹配的值
   *
   * @example
   * // 精确主键查询（假设 id 和 userId 都是主键）
   * .where({ id: "123", userId: "456" })
   *
   * // 部分主键查询（只指定第一个主键）
   * .where({ id: "123" })
   *
   * // 错误用法：非主键字段会被忽略
   * .where({ name: "John" }) // name 不是主键，此条件无效
   */
  where(condition: string, parameters?: any): this;
  where(condition: Partial<T>): this;
  where(conditionOrObject: string | Partial<T>, parameters?: any): this {
    if (typeof conditionOrObject === 'string') {
      // 字符串条件（暂时简化处理）
      this._where = { condition: conditionOrObject, parameters };
    } else {
      // 对象条件
      this._where = conditionOrObject;
    }
    return this;
  }

  /**
   * 添加 AND WHERE 条件
   */
  andWhere(condition: string, parameters?: any): this;
  andWhere(condition: Partial<T>): this;
  andWhere(conditionOrObject: string | Partial<T>, parameters?: any): this {
    // 简化实现，实际应该支持多个条件的组合
    return this.where(conditionOrObject as any, parameters);
  }

  /**
   * 添加 OR WHERE 条件
   */
  orWhere(condition: string, parameters?: any): this;
  orWhere(condition: Partial<T>): this;
  orWhere(conditionOrObject: string | Partial<T>, parameters?: any): this {
    // 简化实现，实际应该支持多个条件的组合
    return this.where(conditionOrObject as any, parameters);
  }

  /**
   * 添加高级过滤条件 - 适用于任何字段的复杂查询
   *
   * 使用场景：
   * 1. 非主键字段查询：可以对任何列进行过滤
   * 2. 范围查询：支持 >、<、>=、<= 等比较操作
   * 3. 复杂逻辑：支持 AND、OR、NOT 等逻辑组合
   * 4. 精确匹配：支持 = 和 != 操作
   *
   * 优势：
   * - 不受主键限制，可以查询任何字段
   * - 支持丰富的比较操作符
   * - 支持复杂的逻辑组合
   * - 在服务端进行过滤，减少网络传输
   *
   * @param callback 过滤条件构建函数，接收 FilterFactory 实例作为参数
   *
   * @example
   * // 单个条件：查询年龄等于 25 的记录
   * .filter(f => f.equals('age', 25))
   *
   * // 范围查询：查询工资在 5000-10000 之间的记录
   * .filter(f => f.and(
   *   f.greaterThanOrEqual('salary', 5000),
   *   f.lessThanOrEqual('salary', 10000)
   * ))
   *
   * // 复杂逻辑：查询年龄大于 18 且城市为北京或上海的记录
   * .filter(f => f.and(
   *   f.greaterThan('age', 18),
   *   f.or(
   *     f.equals('city', '北京'),
   *     f.equals('city', '上海')
   *   )
   * ))
   *
   * // 非主键字段查询：查询姓名包含特定值的记录
   * .filter(f => f.equals('name', 'John'))
   *
   * // 布尔字段查询：查询激活状态的用户
   * .filter(f => f.equals('isActive', true))
   */
  filter(callback: (filter: FilterFactory<T>) => Tablestore.ColumnCondition): this {
    const filterFactory = new FilterFactory<T>(this.metadata);
    this._columnCondition = callback(filterFactory);
    return this;
  }

  /**
   * 添加排序
   */
  orderBy(column: keyof T, direction?: OrderDirection): this;
  orderBy(direction: OrderDirection): this;
  orderBy(columnOrDirection: keyof T | OrderDirection, direction?: OrderDirection): this {
    if (typeof columnOrDirection === 'string' && (columnOrDirection === 'ASC' || columnOrDirection === 'DESC')) {
      // 如果第一个参数是排序方向，自动使用第一个主键字段
      const firstPrimaryColumn = this.metadata.primaryColumns[0];
      if (firstPrimaryColumn) {
        this._orderBy = { [firstPrimaryColumn.propertyName]: columnOrDirection };
      }
    } else {
      // 传统的字段+方向模式
      this._orderBy = { [columnOrDirection as string]: direction || 'ASC' };
    }
    return this;
  }

  /**
   * 添加额外排序
   */
  addOrderBy(column: keyof T, direction: OrderDirection = 'ASC'): this {
    this._orderBy[column as string] = direction;
    return this;
  }

  /**
   * 设置限制数量
   */
  limit(limit: number): this {
    this._limit = limit;
    return this;
  }

  /**
   * 设置分页
   */
  take(limit: number): this {
    return this.limit(limit);
  }

  /**
   * 设置范围查询的起始主键
   */
  startWith(primaryKeys: Partial<T>): this {
    const orderDirection = this.getOrderDirection();
    this._startPrimaryKey = this.autoCompletePartialPrimaryKey(primaryKeys, true, orderDirection);
    return this;
  }

  /**
   * 设置范围查询的结束主键
   */
  endWith(primaryKeys: Partial<T>): this {
    const orderDirection = this.getOrderDirection();
    this._endPrimaryKey = this.autoCompletePartialPrimaryKey(primaryKeys, false, orderDirection);
    return this;
  }

  /**
   * 执行查询并返回多个结果
   */
  async getMany(): Promise<T[]> {
    const result = await this.executeQuery();
    return result.entities;
  }

  /**
   * 执行查询并返回单个结果
   */
  async getOne(): Promise<T | null> {
    this.limit(1);
    const result = await this.executeQuery();
    return result.entities.length > 0 ? result.entities[0] : null;
  }

  /**
   * 执行查询并返回结果数量
   */
  async getCount(): Promise<number> {
    const result = await this.executeQuery();
    return result.entities.length;
  }

  /**
   * 执行查询并返回完整结果
   */
  async getRawAndEntities(): Promise<QueryResult<T>> {
    return this.executeQuery();
  }



  /**
   * 执行实际的查询
   */
  private async executeQuery(): Promise<QueryResult<T>> {
    const client = (this.entityManager as any).dataSource.getClient();

    // 如果有具体的主键条件，使用 getRow
    if (this.isExactPrimaryKeyQuery()) {
      return this.executeGetRowQuery(client);
    }

    // 如果是部分主键查询，转换为范围查询
    if (this.isPartialPrimaryKeyQuery()) {
      this.convertPartialPrimaryKeyToRange();
    }

    // 使用 getRange
    return this.executeGetRangeQuery(client);
  }

  /**
   * 将部分主键查询转换为范围查询
   */
  private convertPartialPrimaryKeyToRange(): void {
    if (typeof this._where !== 'object' || !this._where) return;

    const orderDirection = this.getOrderDirection();

    // 如果还没有设置起始和结束主键，则根据 where 条件设置
    if (!this._startPrimaryKey) {
      this._startPrimaryKey = this.autoCompletePartialPrimaryKey(this._where, true, orderDirection);
    }

    if (!this._endPrimaryKey) {
      this._endPrimaryKey = this.autoCompletePartialPrimaryKey(this._where, false, orderDirection);
    }

    // 清空 where 条件，因为已经转换为范围查询
    this._where = {};
  }

  /**
   * 检查是否是精确主键查询
   */
  private isExactPrimaryKeyQuery(): boolean {
    if (typeof this._where !== 'object' || !this._where) return false;

    const whereKeys = Object.keys(this._where);
    const primaryKeyNames = this.metadata.primaryColumns.map(col => col.propertyName);

    return primaryKeyNames.every(pkName => whereKeys.includes(pkName));
  }

  /**
   * 检查是否是部分主键查询
   */
  private isPartialPrimaryKeyQuery(): boolean {
    if (typeof this._where !== 'object' || !this._where) return false;

    const whereKeys = Object.keys(this._where);
    const primaryKeyNames = this.metadata.primaryColumns.map(col => col.propertyName);

    // 至少有一个主键字段，但不是全部主键字段
    return whereKeys.some(key => primaryKeyNames.includes(key)) &&
           !primaryKeyNames.every(pkName => whereKeys.includes(pkName));
  }

  /**
   * 执行 getRow 查询
   */
  private async executeGetRowQuery(client: Tablestore.Client): Promise<QueryResult<T>> {
    const primaryKey = this.convertPrimaryKeysToTablestore(this._where);
    
    try {
      const response = await client.getRow({
        tableName: this.metadata.tableName,
        primaryKey,
        columnsToGet: this._select.length > 0 ? this._select : undefined
      });

      if (!response?.row || !response.row.primaryKey) {
        return { entities: [] };
      }

      const entity = (this.entityManager as any).convertTablestoreToEntity(
        response.row, 
        this.entityClass, 
        this.metadata
      );

      return { entities: [entity] };
    } catch (error) {
      if ((this.entityManager as any).isRowNotFoundError(error)) {
        return { entities: [] };
      }
      throw error;
    }
  }

  /**
   * 执行 getRange 查询
   */
  private async executeGetRangeQuery(client: Tablestore.Client): Promise<QueryResult<T>> {
    const direction = this.getDirection();
    let inclusiveStartPrimaryKey: Tablestore.PrimaryKeyInput;
    let exclusiveEndPrimaryKey: Tablestore.PrimaryKeyInput;

    if (direction === Tablestore.Direction.BACKWARD) {
      // BACKWARD 方向：从大到小
      inclusiveStartPrimaryKey = this._startPrimaryKey || this.buildMaxPrimaryKey();
      exclusiveEndPrimaryKey = this._endPrimaryKey || this.buildMinPrimaryKey();
    } else {
      // FORWARD 方向：从小到大
      inclusiveStartPrimaryKey = this._startPrimaryKey || this.buildMinPrimaryKey();
      exclusiveEndPrimaryKey = this._endPrimaryKey || this.buildMaxPrimaryKey();
    }

    const params: Tablestore.GetRangeParams = {
      tableName: this.metadata.tableName,
      inclusiveStartPrimaryKey,
      exclusiveEndPrimaryKey,
      limit: this._limit || 100,
      direction,
      columnsToGet: this._select.length > 0 ? this._select : undefined,
      columnFilter: this._columnCondition
    };

    const response = await client.getRange(params);

    const entities = response.rows.map(row =>
      (this.entityManager as any).convertTablestoreToEntity(row, this.entityClass, this.metadata)
    );

    return {
      entities,
      nextStartPrimaryKey: response.nextStartPrimaryKey
    };
  }

  /**
   * 转换主键为 Tablestore 格式
   */
  private convertPrimaryKeysToTablestore(primaryKeys: Partial<T>): Tablestore.PrimaryKeyInput {
    const tablestorePrimaryKey: Tablestore.PrimaryKeyInput = [];

    for (const column of this.metadata.primaryColumns) {
      const value = (primaryKeys as any)[column.propertyName];
      if (value !== undefined && value !== null) {
        tablestorePrimaryKey.push({
          [column.propertyName]: this.convertValueToTablestore(value, column)
        });
      }
    }

    return tablestorePrimaryKey;
  }

  /**
   * 自动补充部分主键为完整的范围主键
   */
  private autoCompletePartialPrimaryKey(
    partialKeys: Partial<T>,
    isStart: boolean,
    direction: 'ASC' | 'DESC' = 'ASC'
  ): Tablestore.PrimaryKeyInput {
    const tablestorePrimaryKey: Tablestore.PrimaryKeyInput = [];
    let foundPartialKey = false;

    for (const column of this.metadata.primaryColumns) {
      const value = (partialKeys as any)[column.propertyName];

      if (value !== undefined && value !== null) {
        // 有值的主键直接使用
        tablestorePrimaryKey.push({
          [column.propertyName]: this.convertValueToTablestore(value, column)
        });
      } else {
        // 没有值的主键需要自动补充
        foundPartialKey = true;

        if (isStart) {
          // 起始主键：根据排序方向决定使用 MIN 还是 MAX
          if (direction === 'ASC') {
            tablestorePrimaryKey.push({
              [column.propertyName]: Tablestore.INF_MIN
            });
          } else {
            tablestorePrimaryKey.push({
              [column.propertyName]: Tablestore.INF_MAX
            });
          }
        } else {
          // 结束主键：根据排序方向决定使用 MAX 还是 MIN
          if (direction === 'ASC') {
            tablestorePrimaryKey.push({
              [column.propertyName]: Tablestore.INF_MAX
            });
          } else {
            tablestorePrimaryKey.push({
              [column.propertyName]: Tablestore.INF_MIN
            });
          }
        }
      }
    }

    return tablestorePrimaryKey;
  }

  /**
   * 构建最小主键
   */
  private buildMinPrimaryKey(): Tablestore.PrimaryKeyInput {
    return this.metadata.primaryColumns.map(column => ({
      [column.propertyName]: Tablestore.INF_MIN
    }));
  }

  /**
   * 构建最大主键
   */
  private buildMaxPrimaryKey(): Tablestore.PrimaryKeyInput {
    return this.metadata.primaryColumns.map(column => ({
      [column.propertyName]: Tablestore.INF_MAX
    }));
  }

  /**
   * 获取查询方向（基于主键排序）
   */
  private getDirection(): any {
    const firstOrderKey = Object.keys(this._orderBy)[0];
    if (firstOrderKey && this._orderBy[firstOrderKey] === 'DESC') {
      return Tablestore.Direction.BACKWARD;
    }
    return Tablestore.Direction.FORWARD;
  }

  /**
   * 获取排序方向
   */
  private getOrderDirection(): 'ASC' | 'DESC' {
    const firstOrderKey = Object.keys(this._orderBy)[0];
    if (firstOrderKey && this._orderBy[firstOrderKey] === 'DESC') {
      return 'DESC';
    }
    return 'ASC';
  }

  /**
   * 转换值到 Tablestore 格式
   */
  private convertValueToTablestore(value: any, column: any): any {
    // 简化实现，实际应该根据列类型进行转换
    if (typeof value === 'number' && Number.isInteger(value)) {
      return Tablestore.Long.fromNumber(value);
    }
    return value;
  }
}
