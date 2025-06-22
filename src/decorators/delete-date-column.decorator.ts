// src/typeorm-style/decorators/delete-date-column.decorator.ts

import "reflect-metadata";
import { metadataStorage, ColumnMetadata } from './metadata-storage';

/**
 * DeleteDateColumn 装饰器选项
 */
export interface DeleteDateColumnOptions {
  /** 列名，如果不指定则使用属性名 */
  name?: string;
  /** 是否可为空（默认 true，因为未删除的记录此字段为空） */
  nullable?: boolean;
  /** 自定义转换器 */
  transformer?: {
    to?: (value: any) => any;
    from?: (value: any) => any;
  };
  /** Tablestore 类型（默认 INTEGER，存储时间戳） */
  tablestoreType?: 'STRING' | 'INTEGER' | 'DOUBLE' | 'BOOLEAN' | 'BINARY';
}

/**
 * DeleteDateColumn 装饰器
 * 用于标记一个属性为软删除时间列，支持逻辑删除功能
 * 当记录被"删除"时，会设置删除时间而不是真正删除记录
 * 
 * @param options 删除时间列选项
 * @returns 属性装饰器
 * 
 * @example
 * ```typescript
 * @Entity()
 * export class User {
 *   @PrimaryColumn()
 *   id: string;
 * 
 *   @DeleteDateColumn()
 *   deletedAt: Date | null;
 * 
 *   @DeleteDateColumn({ tablestoreType: 'STRING' })
 *   deletedAtString: string | null;
 * 
 *   @DeleteDateColumn({ name: 'delete_time' })
 *   deleteTime: Date | null;
 * }
 * ```
 */
export function DeleteDateColumn(options?: DeleteDateColumnOptions): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol) {
    const propertyName = options?.name || propertyKey.toString();
    
    // 获取属性的反射类型
    const reflectedType = Reflect.getMetadata("design:type", target, propertyKey);
    const defaultType = reflectedType || Date;
    const defaultTablestoreType = options?.tablestoreType || 'INTEGER';
    
    // 创建默认转换器
    const defaultTransformer = {
      to: (value: any) => {
        if (!value || value === null || value === undefined) {
          return null;
        }
        if (value instanceof Date) {
          return defaultTablestoreType === 'INTEGER' 
            ? value.getTime() 
            : value.toISOString();
        }
        if (typeof value === 'number') {
          return defaultTablestoreType === 'INTEGER' 
            ? value 
            : new Date(value).toISOString();
        }
        if (typeof value === 'string') {
          return defaultTablestoreType === 'INTEGER' 
            ? new Date(value).getTime() 
            : value;
        }
        return value;
      },
      from: (value: any) => {
        if (!value || value === null || value === undefined) {
          return null;
        }
        if (defaultType === Date) {
          if (typeof value === 'number') {
            return new Date(value);
          }
          if (typeof value === 'string') {
            return new Date(value);
          }
        }
        if (defaultType === String) {
          if (typeof value === 'number') {
            return new Date(value).toISOString();
          }
          if (value instanceof Date) {
            return value.toISOString();
          }
        }
        if (defaultType === Number) {
          if (value instanceof Date) {
            return value.getTime();
          }
          if (typeof value === 'string') {
            return new Date(value).getTime();
          }
        }
        return value;
      }
    };
    
    // 创建列元数据
    const columnMetadata: ColumnMetadata = {
      target: target.constructor,
      propertyName,
      type: defaultType,
      nullable: options?.nullable ?? true,  // 默认可为空
      default: null,  // 默认值为 null
      transformer: options?.transformer || defaultTransformer,
      tablestoreType: defaultTablestoreType,
      specialType: 'delete-date',
      setOnInsert: false,  // 在插入时不设置
      setOnUpdate: false,  // 在更新时不自动设置（只在软删除时设置）
      isPrimary: false
    };

    // 存储列元数据
    metadataStorage.addColumnMetadata(target.constructor, columnMetadata);

    // 在属性上设置元数据标记
    Reflect.defineMetadata('tablestore:deleteDateColumn', true, target, propertyKey);
    Reflect.defineMetadata('tablestore:column', true, target, propertyKey);
  };
}

/**
 * 检查一个属性是否被 @DeleteDateColumn 装饰器标记
 */
export function isDeleteDateColumn(target: any, propertyKey: string | symbol): boolean {
  return Reflect.getMetadata('tablestore:deleteDateColumn', target, propertyKey) === true;
}

/**
 * 检查实体是否被软删除
 */
export function isSoftDeleted(entity: any, deleteDateColumnName: string): boolean {
  const deleteDate = entity[deleteDateColumnName];
  return deleteDate !== null && deleteDate !== undefined;
}

/**
 * 获取当前时间作为删除时间
 */
export function getDeleteTimestamp(): number {
  return Date.now();
}

/**
 * 获取当前时间的 Date 对象作为删除时间
 */
export function getDeleteDate(): Date {
  return new Date();
}

/**
 * 获取当前时间的 ISO 字符串作为删除时间
 */
export function getDeleteISOString(): string {
  return new Date().toISOString();
}
