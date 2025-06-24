// src/typeorm-style/decorators/create-date-column.decorator.ts

import "reflect-metadata";
import { metadataStorage, ColumnMetadata } from './metadata-storage';

/**
 * CreateDateColumn 装饰器选项
 */
export interface CreateDateColumnOptions {
  /** 列名，如果不指定则使用属性名 */
  name?: string;
  /** 是否可为空 */
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
 * CreateDateColumn 装饰器
 * 用于标记一个属性为创建时间列，会在实体创建时自动设置当前时间
 * 
 * @param options 创建时间列选项
 * @returns 属性装饰器
 * 
 * @example
 * ```typescript
 * @Entity()
 * export class User {
 *   @PrimaryColumn()
 *   id: string;
 * 
 *   @CreateDateColumn()
 *   createdAt: Date;
 * 
 *   @CreateDateColumn({ name: 'create_time' })
 *   createTime: Date;
 * }
 * ```
 */
export function CreateDateColumn(options?: CreateDateColumnOptions): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol) {
    const propertyName = options?.name || propertyKey.toString();

    // 获取属性的反射类型
    const reflectedType = Reflect.getMetadata("design:type", target, propertyKey);
    const defaultType = reflectedType || Date;
    const defaultTablestoreType = options?.tablestoreType || 'INTEGER';

    // 创建默认转换器
    const defaultTransformer = {
      to: (value: any) => {
        if (!value) return null;
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
        if (!value) return null;

        // 格式化日期为 "YYYY-M-D HH:mm:ss" 格式
        const formatDate = (date: Date): string => {
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const day = date.getDate();
          const hours = date.getHours();
          const minutes = date.getMinutes();
          const seconds = date.getSeconds();

          return `${year}-${month}-${day} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        };

        if (defaultType === Date) {
          // 即使类型是 Date，也返回格式化的字符串
          if (typeof value === 'number') {
            return formatDate(new Date(value));
          }
          if (typeof value === 'string') {
            return formatDate(new Date(value));
          }
        }
        if (defaultType === String) {
          if (typeof value === 'number') {
            return formatDate(new Date(value));
          }
          if (value instanceof Date) {
            return formatDate(value);
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
      nullable: options?.nullable ?? false,
      transformer: options?.transformer || defaultTransformer,
      tablestoreType: defaultTablestoreType,
      specialType: 'create-date',
      setOnInsert: true,
      setOnUpdate: false,
      isPrimary: false
    };

    // 存储列元数据
    metadataStorage.addColumnMetadata(target.constructor, columnMetadata);

    // 在属性上设置元数据标记
    Reflect.defineMetadata('tablestore:createDateColumn', true, target, propertyKey);
    Reflect.defineMetadata('tablestore:column', true, target, propertyKey);
  };
}

/**
 * 检查一个属性是否被 @CreateDateColumn 装饰器标记
 */
export function isCreateDateColumn(target: any, propertyKey: string | symbol): boolean {
  return Reflect.getMetadata('tablestore:createDateColumn', target, propertyKey) === true;
}
