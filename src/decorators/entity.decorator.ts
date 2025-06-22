// src/typeorm-style/decorators/entity.decorator.ts

import "reflect-metadata";
import { metadataStorage, EntityMetadata } from './metadata-storage';

/**
 * Entity 装饰器选项
 */
export interface EntityOptions {
  /** 表名，如果不指定则使用类名的小写形式 */
  name?: string;
  /** 是否自动创建表 */
  autoCreateTable?: boolean;
  /** 表选项 */
  tableOptions?: {
    /** 数据生存时间（秒），-1 表示永不过期 */
    timeToLive?: number;
    /** 最大版本数 */
    maxVersions?: number;
  };
  /** 预留读写吞吐量 */
  reservedThroughput?: {
    read: number;
    write: number;
  };
}

/**
 * Entity 装饰器
 * 用于标记一个类为 Tablestore 实体
 * 
 * @param options 实体选项
 * @returns 类装饰器
 * 
 * @example
 * ```typescript
 * @Entity("users", { autoCreateTable: true })
 * export class User {
 *   @PrimaryColumn()
 *   id: string;
 * 
 *   @Column()
 *   name: string;
 * }
 * ```
 */
export function Entity(options?: EntityOptions): ClassDecorator;
export function Entity(name?: string, options?: EntityOptions): ClassDecorator;
export function Entity(
  nameOrOptions?: string | EntityOptions,
  options?: EntityOptions
): ClassDecorator {
  return function (target: Function) {
    let entityOptions: EntityOptions = {};
    let tableName: string;

    // 处理参数重载
    if (typeof nameOrOptions === 'string') {
      tableName = nameOrOptions;
      entityOptions = options || {};
    } else {
      tableName = nameOrOptions?.name || target.name.toLowerCase();
      entityOptions = nameOrOptions || {};
    }

    // 创建实体元数据
    const entityMetadata: EntityMetadata = {
      target,
      tableName,
      columns: [],
      primaryColumns: [],
      autoCreateTable: entityOptions.autoCreateTable,
      tableOptions: entityOptions.tableOptions,
      reservedThroughput: entityOptions.reservedThroughput
    };

    // 存储元数据
    metadataStorage.addEntityMetadata(entityMetadata);

    // 在类上设置元数据标记
    Reflect.defineMetadata('tablestore:entity', true, target);
    Reflect.defineMetadata('tablestore:tableName', tableName, target);
  };
}

/**
 * 检查一个类是否被 @Entity 装饰器标记
 */
export function isEntity(target: Function): boolean {
  return Reflect.getMetadata('tablestore:entity', target) === true;
}

/**
 * 获取实体的表名
 */
export function getTableName(target: Function): string | undefined {
  return Reflect.getMetadata('tablestore:tableName', target);
}
