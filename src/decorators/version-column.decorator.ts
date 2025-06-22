// src/typeorm-style/decorators/version-column.decorator.ts

import "reflect-metadata";
import { metadataStorage, ColumnMetadata } from './metadata-storage';

/**
 * VersionColumn 装饰器选项
 */
export interface VersionColumnOptions {
  /** 列名，如果不指定则使用属性名 */
  name?: string;
  /** 是否可为空 */
  nullable?: boolean;
  /** 自定义转换器 */
  transformer?: {
    to?: (value: any) => any;
    from?: (value: any) => any;
  };
  /** Tablestore 类型（默认 INTEGER） */
  tablestoreType?: 'STRING' | 'INTEGER' | 'DOUBLE' | 'BOOLEAN' | 'BINARY';
  /** 初始版本号（默认 1） */
  initialValue?: number;
}

/**
 * VersionColumn 装饰器
 * 用于标记一个属性为版本列，会在实体创建时设置初始版本号，在每次更新时自动递增
 * 
 * @param options 版本列选项
 * @returns 属性装饰器
 * 
 * @example
 * ```typescript
 * @Entity()
 * export class User {
 *   @PrimaryColumn()
 *   id: string;
 * 
 *   @VersionColumn()
 *   version: number;
 * 
 *   @VersionColumn({ initialValue: 0 })
 *   versionFromZero: number;
 * 
 *   @VersionColumn({ name: 'row_version' })
 *   rowVersion: number;
 * }
 * ```
 */
export function VersionColumn(options?: VersionColumnOptions): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol) {
    const propertyName = options?.name || propertyKey.toString();
    
    // 获取属性的反射类型
    const reflectedType = Reflect.getMetadata("design:type", target, propertyKey);
    const defaultType = reflectedType || Number;
    const defaultTablestoreType = options?.tablestoreType || 'INTEGER';
    const initialValue = options?.initialValue ?? 1;
    
    // 创建默认转换器
    const defaultTransformer = {
      to: (value: any) => {
        if (value === null || value === undefined) {
          return initialValue;
        }
        if (typeof value === 'number') {
          return defaultTablestoreType === 'INTEGER' 
            ? Math.floor(value)
            : value;
        }
        if (typeof value === 'string') {
          const numValue = parseInt(value, 10);
          return isNaN(numValue) ? initialValue : numValue;
        }
        return initialValue;
      },
      from: (value: any) => {
        if (value === null || value === undefined) {
          return initialValue;
        }
        if (typeof value === 'number') {
          return Math.floor(value);
        }
        if (typeof value === 'string') {
          const numValue = parseInt(value, 10);
          return isNaN(numValue) ? initialValue : numValue;
        }
        return initialValue;
      }
    };
    
    // 创建列元数据
    const columnMetadata: ColumnMetadata = {
      target: target.constructor,
      propertyName,
      type: defaultType,
      nullable: options?.nullable ?? false,
      default: initialValue,
      transformer: options?.transformer || defaultTransformer,
      tablestoreType: defaultTablestoreType,
      specialType: 'version',
      setOnInsert: true,  // 在插入时设置初始值
      setOnUpdate: true,  // 在更新时递增
      isPrimary: false
    };

    // 存储列元数据
    metadataStorage.addColumnMetadata(target.constructor, columnMetadata);

    // 在属性上设置元数据标记
    Reflect.defineMetadata('tablestore:versionColumn', true, target, propertyKey);
    Reflect.defineMetadata('tablestore:column', true, target, propertyKey);
  };
}

/**
 * 检查一个属性是否被 @VersionColumn 装饰器标记
 */
export function isVersionColumn(target: any, propertyKey: string | symbol): boolean {
  return Reflect.getMetadata('tablestore:versionColumn', target, propertyKey) === true;
}

/**
 * 获取下一个版本号
 */
export function getNextVersion(currentVersion?: number): number {
  if (currentVersion === null || currentVersion === undefined || isNaN(currentVersion)) {
    return 1;
  }
  return Math.floor(currentVersion) + 1;
}

/**
 * 获取初始版本号
 */
export function getInitialVersion(initialValue: number = 1): number {
  return Math.floor(initialValue);
}
