// src/typeorm-style/entity-manager.ts

import Tablestore from "aliyun-tablestore-nodejs-sdk";
import { metadataStorage, EntityMetadata, ColumnMetadata } from "./decorators/metadata-storage";
import { SaveOptions, DeleteOptions } from "./repository";

/**
 * EntityManager 类
 * 管理实体的生命周期和数据库操作
 */
export class EntityManager {
  private dataSource: any; // 避免循环依赖，使用 any

  constructor(dataSource: any) {
    this.dataSource = dataSource;
  }

  /**
   * 保存实体到数据库
   */
  async save<T>(entity: T, options?: SaveOptions): Promise<T> {
    const entityClass = entity!.constructor as new () => T;
    const metadata = this.getEntityMetadata(entityClass);

    // 处理特殊列（创建时间、更新时间、版本等）
    this.processSpecialColumnsOnInsert(entity, metadata);

    // 转换实体数据为 Tablestore 格式
    const { primaryKey, attributeColumns } = this.convertEntityToTablestore(entity, metadata);

    // 执行保存操作
    const client = this.dataSource.getClient();

    const condition = options?.condition || new Tablestore.Condition(
      Tablestore.RowExistenceExpectation.IGNORE,
      null
    );

    await client.putRow({
      tableName: metadata.tableName,
      condition,
      primaryKey,
      attributeColumns,
      returnContent: { returnType: Tablestore.ReturnType.Primarykey }
    });

    // 重新查询实体以获取正确的格式化值
    const primaryKeyValues: Partial<T> = {};
    for (const column of metadata.primaryColumns) {
      const value = (entity as any)[column.propertyName];
      if (value !== undefined && value !== null) {
        (primaryKeyValues as any)[column.propertyName] = value;
      }
    }

    const savedEntity = await this.findOne(entityClass, primaryKeyValues);
    if (savedEntity) {
      return savedEntity;
    }

    // 如果查询失败，返回原始实体
    return entity;
  }

  /**
   * 根据主键查找实体
   * 如果提供完整主键，使用精确查询（getRow）
   * 如果提供部分主键，使用范围查询（getRange）返回第一个匹配的实体
   */
  async findOne<T>(entityClass: new () => T, primaryKeys: Partial<T>): Promise<T | null> {
    const metadata = this.getEntityMetadata(entityClass);
    const client = this.dataSource.getClient();

    // 检查是否提供了完整的主键
    const isCompletePrimaryKey = this.isCompletePrimaryKey(primaryKeys, metadata);

    if (isCompletePrimaryKey) {
      // 完整主键，使用精确查询
      const tablestorePrimaryKey = this.convertPrimaryKeysToTablestore(primaryKeys, metadata);

      try {
        const response = await client.getRow({
          tableName: metadata.tableName,
          primaryKey: tablestorePrimaryKey
        });

        if (!response?.row || !response.row.primaryKey) {
          return null;
        }

        return this.convertTablestoreToEntity(response.row, entityClass, metadata);
      } catch (error) {
        if (this.isRowNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    } else {
      // 部分主键，使用范围查询
      const startPrimaryKey = this.autoCompletePartialPrimaryKey(primaryKeys, metadata, true);
      const endPrimaryKey = this.autoCompletePartialPrimaryKey(primaryKeys, metadata, false);

      try {
        const response = await client.getRange({
          tableName: metadata.tableName,
          direction: Tablestore.Direction.FORWARD,
          inclusiveStartPrimaryKey: startPrimaryKey,
          exclusiveEndPrimaryKey: endPrimaryKey,
          limit: 1
        });

        if (!response?.rows || response.rows.length === 0) {
          return null;
        }

        return this.convertTablestoreToEntity(response.rows[0], entityClass, metadata);
      } catch (error) {
        if (this.isRowNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    }
  }

  /**
   * 根据主键删除实体
   */
  async delete<T>(
    entityClass: new () => T, 
    primaryKeys: Partial<T>, 
    options?: DeleteOptions
  ): Promise<void> {
    const metadata = this.getEntityMetadata(entityClass);
    const client = this.dataSource.getClient();
    
    // 转换主键为 Tablestore 格式
    const tablestorePrimaryKey = this.convertPrimaryKeysToTablestore(primaryKeys, metadata);
    
    const condition = options?.condition || new Tablestore.Condition(
      Tablestore.RowExistenceExpectation.EXPECT_EXIST,
      null
    );

    await client.deleteRow({
      tableName: metadata.tableName,
      condition,
      primaryKey: tablestorePrimaryKey
    });
  }

  /**
   * 更新实体
   */
  async update<T>(
    entityClass: new () => T,
    primaryKeys: Partial<T>,
    partialEntity: Partial<T>
  ): Promise<T> {
    const metadata = this.getEntityMetadata(entityClass);
    const client = this.dataSource.getClient();

    // 处理特殊列（更新时间、版本等）
    await this.processSpecialColumnsOnUpdate(partialEntity, metadata, primaryKeys);

    // 转换主键为 Tablestore 格式
    const tablestorePrimaryKey = this.convertPrimaryKeysToTablestore(primaryKeys, metadata);

    // 转换更新数据为 Tablestore 格式
    const updateOfAttributeColumns = this.convertPartialEntityToTablestoreUpdate(partialEntity, metadata);

    const condition = new Tablestore.Condition(
      Tablestore.RowExistenceExpectation.EXPECT_EXIST,
      null
    );

    await client.updateRow({
      tableName: metadata.tableName,
      condition,
      primaryKey: tablestorePrimaryKey,
      updateOfAttributeColumns,
      returnContent: { returnType: Tablestore.ReturnType.Primarykey }
    });

    // 重新查询更新后的实体以获取正确的格式化值
    const updatedEntity = await this.findOne(entityClass, primaryKeys);
    if (updatedEntity) {
      return updatedEntity;
    }

    // 如果查询失败，抛出错误
    throw new Error('更新后无法查询到实体');
  }

  /**
   * 获取实体元数据
   */
  private getEntityMetadata<T>(entityClass: new () => T): EntityMetadata {
    const metadata = metadataStorage.getEntityMetadata(entityClass);
    if (!metadata) {
      throw new Error(`实体 ${entityClass.name} 没有被 @Entity 装饰器标记`);
    }
    return metadata;
  }

  /**
   * 转换实体为 Tablestore 格式
   */
  private convertEntityToTablestore<T>(entity: T, metadata: EntityMetadata) {
    const primaryKey: Tablestore.PrimaryKeyInput = [];
    const attributeColumns: Tablestore.AttributesInput = [];

    // 处理主键
    for (const column of metadata.primaryColumns) {
      const value = (entity as any)[column.propertyName];
      if (value !== undefined && value !== null) {
        primaryKey.push({
          [column.propertyName]: this.convertValueToTablestore(value, column)
        });
      }
    }

    // 处理属性列
    for (const column of metadata.columns) {
      if (column.isPrimary) continue; // 跳过主键列
      
      const value = (entity as any)[column.propertyName];
      if (value !== undefined && value !== null) {
        attributeColumns.push({
          [column.propertyName]: this.convertValueToTablestore(value, column)
        });
      }
    }

    return { primaryKey, attributeColumns };
  }

  /**
   * 转换主键为 Tablestore 格式
   */
  private convertPrimaryKeysToTablestore<T>(
    primaryKeys: Partial<T>,
    metadata: EntityMetadata,
    allowPartial: boolean = false
  ): Tablestore.PrimaryKeyInput {
    const tablestorePrimaryKey: Tablestore.PrimaryKeyInput = [];

    for (const column of metadata.primaryColumns) {
      const value = (primaryKeys as any)[column.propertyName];
      if (value !== undefined && value !== null) {
        tablestorePrimaryKey.push({
          [column.propertyName]: this.convertValueToTablestore(value, column)
        });
      } else if (!allowPartial) {
        throw new Error(`主键 ${column.propertyName} 不能为空`);
      } else {
        // 如果允许部分主键且当前主键为空，则停止添加后续主键
        break;
      }
    }

    return tablestorePrimaryKey;
  }

  /**
   * 转换部分主键为 Tablestore 格式（用于范围查询）
   */
  convertPartialPrimaryKeysToTablestore<T>(primaryKeys: Partial<T>, metadata: EntityMetadata): Tablestore.PrimaryKeyInput {
    return this.convertPrimaryKeysToTablestore(primaryKeys, metadata, true);
  }

  /**
   * 检查是否提供了完整的主键
   */
  isCompletePrimaryKey<T>(primaryKeys: Partial<T>, metadata: EntityMetadata): boolean {
    for (const column of metadata.primaryColumns) {
      const value = (primaryKeys as any)[column.propertyName];
      if (value === undefined || value === null) {
        return false;
      }
    }
    return true;
  }

  /**
   * 自动补充部分主键为完整的范围主键
   *
   * 例如：主键为 [userId, id]，提供 { userId: "user1" }
   * - 起始主键：[userId="user1", id=INF_MIN]
   * - 结束主键：[userId="user1", id=INF_MAX]
   */
  autoCompletePartialPrimaryKey<T>(
    partialKeys: Partial<T>,
    metadata: EntityMetadata,
    isStart: boolean
  ): Tablestore.PrimaryKeyInput {
    const tablestorePrimaryKey: Tablestore.PrimaryKeyInput = [];

    for (const column of metadata.primaryColumns) {
      const value = (partialKeys as any)[column.propertyName];

      if (value !== undefined && value !== null) {
        // 有值的主键：起始和结束都使用精确值
        tablestorePrimaryKey.push({
          [column.propertyName]: this.convertValueToTablestore(value, column)
        });
      } else {
        // 缺失的主键：起始用 INF_MIN，结束用 INF_MAX
        if (isStart) {
          tablestorePrimaryKey.push({
            [column.propertyName]: Tablestore.INF_MIN
          });
        } else {
          tablestorePrimaryKey.push({
            [column.propertyName]: Tablestore.INF_MAX
          });
        }
      }
    }

    return tablestorePrimaryKey;
  }

  /**
   * 转换部分实体为 Tablestore 更新格式
   */
  private convertPartialEntityToTablestoreUpdate<T>(
    partialEntity: Partial<T>, 
    metadata: EntityMetadata
  ): Tablestore.UpdateRowParams["updateOfAttributeColumns"] {
    const updateOfAttributeColumns: Tablestore.UpdateRowParams["updateOfAttributeColumns"] = [];

    for (const column of metadata.columns) {
      if (column.isPrimary) continue; // 跳过主键列
      
      const value = (partialEntity as any)[column.propertyName];
      
      if (value === undefined) continue; // 跳过未定义的属性
      
      if (value === null) {
        // 删除属性
        updateOfAttributeColumns.push({
          DELETE_ALL: [column.propertyName]
        });
      } else {
        // 更新属性
        updateOfAttributeColumns.push({
          PUT: [{
            [column.propertyName]: this.convertValueToTablestore(value, column)
          }]
        });
      }
    }

    return updateOfAttributeColumns;
  }

  /**
   * 转换 Tablestore 数据为实体
   */
  private convertTablestoreToEntity<T>(
    row: Tablestore.Row, 
    entityClass: new () => T, 
    metadata: EntityMetadata
  ): T {
    const entity = new entityClass();

    // 处理主键
    if (row.primaryKey) {
      for (const pk of row.primaryKey) {
        const column = metadata.primaryColumns.find(col => col.propertyName === pk.name);
        if (column) {
          (entity as any)[column.propertyName] = this.convertValueFromTablestore(pk.value, column);
        }
      }
    }

    // 处理属性列
    if (row.attributes) {
      for (const attr of row.attributes) {
        const column = metadata.columns.find(col => col.propertyName === attr.columnName);
        if (column) {
          (entity as any)[column.propertyName] = this.convertValueFromTablestore(attr.columnValue, column);
        }
      }
    }

    return entity;
  }

  /**
   * 转换值到 Tablestore 格式
   */
  private convertValueToTablestore(value: any, column: ColumnMetadata): any {
    // 如果有自定义转换器，使用转换器
    if (column.transformer?.to) {
      const transformedValue = column.transformer.to(value);

      // 如果转换器返回的是时间戳数字，确保作为整数存储
      if (column.tablestoreType === 'INTEGER' && typeof transformedValue === 'number') {
        return Tablestore.Long.fromNumber(Math.floor(transformedValue));
      }

      return transformedValue;
    }

    // 根据类型进行转换
    if (column.type === Number) {
      return typeof value === 'number' && Number.isInteger(value)
        ? Tablestore.Long.fromNumber(value)
        : Number(value);
    }

    if (column.type === Date) {
      // 确保时间戳作为整数存储
      const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
      return Tablestore.Long.fromNumber(Math.floor(timestamp));
    }

    if (column.type === Boolean) {
      return Boolean(value);
    }

    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * 从 Tablestore 格式转换值
   */
  private convertValueFromTablestore(value: any, column: ColumnMetadata): any {
    // 如果有自定义转换器，使用转换器
    if (column.transformer?.from) {
      return column.transformer.from(this.extractTablestoreValue(value));
    }

    // 提取 Tablestore 的实际值
    const actualValue = this.extractTablestoreValue(value);

    // 根据类型进行转换
    if (column.type === Number) {
      return Number(actualValue);
    }

    if (column.type === Date) {
      // 格式化日期为 "YYYY-M-D HH:mm:ss" 格式
      const date = new Date(Number(actualValue));
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const seconds = date.getSeconds();

      return `${year}-${month}-${day} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    if (column.type === Boolean) {
      const stringValue = actualValue?.toString() || '';
      return Boolean(stringValue === 'true' || stringValue === '1');
    }

    if (column.type === Object || column.type === Array) {
      try {
        const stringValue = actualValue?.toString() || '';
        return JSON.parse(stringValue);
      } catch {
        return actualValue;
      }
    }

    return actualValue?.toString() || '';
  }

  /**
   * 提取 Tablestore 值的实际内容
   * 处理 Int64、Long 等特殊类型
   */
  private extractTablestoreValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // 处理 Tablestore 的 Int64/Long 类型
    if (value && typeof value === 'object' && 'buffer' in value && 'offset' in value) {
      // 这是 Tablestore 的 Int64 对象
      return Number(value.toString());
    }

    // 处理其他可能的 Long 类型
    if (value && typeof value === 'object' && typeof value.toNumber === 'function') {
      return value.toNumber();
    }

    // 处理普通值
    return value;
  }

  /**
   * 软删除实体
   */
  async softDelete<T>(
    entityClass: new () => T,
    primaryKeys: Partial<T>,
    options?: DeleteOptions
  ): Promise<void> {
    const metadata = this.getEntityMetadata(entityClass);

    // 检查是否有软删除列
    if (!metadata.deleteDateColumn) {
      throw new Error(`实体 ${entityClass.name} 没有定义 @DeleteDateColumn，无法执行软删除`);
    }

    // 创建软删除更新数据
    const softDeleteData: any = {};
    const currentTime = new Date();

    // 设置删除时间
    softDeleteData[metadata.deleteDateColumn.propertyName] = currentTime;

    // 执行更新操作
    await this.update(entityClass, primaryKeys, softDeleteData);
  }

  /**
   * 恢复软删除的实体
   */
  async restore<T>(
    entityClass: new () => T,
    primaryKeys: Partial<T>
  ): Promise<void> {
    const metadata = this.getEntityMetadata(entityClass);

    // 检查是否有软删除列
    if (!metadata.deleteDateColumn) {
      throw new Error(`实体 ${entityClass.name} 没有定义 @DeleteDateColumn，无法执行恢复操作`);
    }

    // 创建恢复数据
    const restoreData: any = {};
    restoreData[metadata.deleteDateColumn.propertyName] = null;

    // 执行更新操作
    await this.update(entityClass, primaryKeys, restoreData);
  }

  /**
   * 处理插入时的特殊列
   */
  private processSpecialColumnsOnInsert<T>(entity: T, metadata: EntityMetadata): void {
    const currentTime = new Date();

    // 处理创建时间列
    if (metadata.createDateColumn && metadata.createDateColumn.setOnInsert) {
      const column = metadata.createDateColumn;
      if ((entity as any)[column.propertyName] === undefined || (entity as any)[column.propertyName] === null) {
        (entity as any)[column.propertyName] = this.getDefaultValueForSpecialColumn(column, currentTime);
      }
    }

    // 处理更新时间列
    if (metadata.updateDateColumn && metadata.updateDateColumn.setOnInsert) {
      const column = metadata.updateDateColumn;
      if ((entity as any)[column.propertyName] === undefined || (entity as any)[column.propertyName] === null) {
        (entity as any)[column.propertyName] = this.getDefaultValueForSpecialColumn(column, currentTime);
      }
    }

    // 处理版本列
    if (metadata.versionColumn && metadata.versionColumn.setOnInsert) {
      const column = metadata.versionColumn;
      if ((entity as any)[column.propertyName] === undefined || (entity as any)[column.propertyName] === null) {
        (entity as any)[column.propertyName] = column.default || 1;
      }
    }
  }

  /**
   * 处理更新时的特殊列
   */
  private async processSpecialColumnsOnUpdate<T>(
    partialEntity: Partial<T>,
    metadata: EntityMetadata,
    primaryKeys: Partial<T>
  ): Promise<void> {
    const currentTime = new Date();

    // 处理更新时间列
    if (metadata.updateDateColumn && metadata.updateDateColumn.setOnUpdate) {
      const column = metadata.updateDateColumn;
      (partialEntity as any)[column.propertyName] = this.getDefaultValueForSpecialColumn(column, currentTime);
    }

    // 处理版本列
    if (metadata.versionColumn && metadata.versionColumn.setOnUpdate) {
      const column = metadata.versionColumn;
      // 需要先获取当前版本号，然后递增
      await this.incrementVersionColumn(partialEntity, column, primaryKeys, metadata);
    }
  }

  /**
   * 递增版本列
   */
  private async incrementVersionColumn<T>(
    partialEntity: Partial<T>,
    versionColumn: ColumnMetadata,
    primaryKeys: Partial<T>,
    metadata: EntityMetadata
  ): Promise<void> {
    try {
      // 获取当前实体以获取当前版本号
      const currentEntity = await this.findOne(metadata.target as new () => T, primaryKeys);
      const currentVersion = currentEntity ? (currentEntity as any)[versionColumn.propertyName] : null;

      // 计算新版本号
      const newVersion = this.getNextVersion(currentVersion, versionColumn);
      (partialEntity as any)[versionColumn.propertyName] = newVersion;
    } catch (error) {
      // 如果获取当前版本失败，使用默认值
      (partialEntity as any)[versionColumn.propertyName] = versionColumn.default || 1;
    }
  }

  /**
   * 获取特殊列的默认值
   */
  private getDefaultValueForSpecialColumn(column: ColumnMetadata, currentTime: Date): any {
    switch (column.specialType) {
      case 'create-date':
      case 'update-date':
        if (column.type === Number) {
          return currentTime.getTime();
        }
        if (column.type === String) {
          return currentTime.toISOString();
        }
        return currentTime;

      case 'version':
        return column.default || 1;

      case 'delete-date':
        return null;

      default:
        return null;
    }
  }

  /**
   * 获取下一个版本号
   */
  private getNextVersion(currentVersion: any, versionColumn: ColumnMetadata): number {
    if (currentVersion === null || currentVersion === undefined || isNaN(currentVersion)) {
      return versionColumn.default || 1;
    }
    return Math.floor(currentVersion) + 1;
  }

  /**
   * 检查是否是行不存在错误
   */
  private isRowNotFoundError(error: any): boolean {
    return error?.code === 'OTSRowNotExist' || error?.message?.includes('not exist');
  }
}
