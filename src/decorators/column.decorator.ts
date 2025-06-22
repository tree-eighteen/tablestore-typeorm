// src/typeorm-style/decorators/column.decorator.ts

import "reflect-metadata";
import { metadataStorage, ColumnMetadata } from './metadata-storage';

/**
 * 列装饰器选项
 */
export interface ColumnOptions {
  /** 列类型 */
  type?: Function;
  /** 是否可为空 */
  nullable?: boolean;
  /** 默认值 */
  default?: any;
  /** 值转换器 */
  transformer?: {
    /** 存储到数据库时的转换 */
    to?: (value: any) => any;
    /** 从数据库读取时的转换 */
    from?: (value: any) => any;
  };
  /** Tablestore 特定的列类型 */
  tablestoreType?: 'STRING' | 'INTEGER' | 'DOUBLE' | 'BOOLEAN' | 'BINARY';
}

/**
 * Column 装饰器
 * 用于标记一个属性为数据库列
 * 
 * @param options 列选项
 * @returns 属性装饰器
 * 
 * @example
 * ```typescript
 * @Entity()
 * export class User {
 *   @Column()
 *   name: string;
 * 
 *   @Column({ nullable: true })
 *   email?: string;
 * 
 *   @Column({ type: Number, default: 0 })
 *   age: number;
 * }
 * ```
 */
export function Column(options?: ColumnOptions): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol) {
    const propertyName = propertyKey.toString();
    
    // 获取属性的反射类型信息
    const reflectedType = Reflect.getMetadata('design:type', target, propertyKey);
    
    // 创建列元数据
    const columnMetadata: ColumnMetadata = {
      target: target.constructor,
      propertyName,
      type: options?.type || reflectedType,
      nullable: options?.nullable,
      default: options?.default,
      transformer: options?.transformer,
      tablestoreType: options?.tablestoreType,
      isPrimary: false
    };

    // 存储列元数据
    metadataStorage.addColumnMetadata(target.constructor, columnMetadata);

    // 在属性上设置元数据标记
    Reflect.defineMetadata('tablestore:column', true, target, propertyKey);
  };
}

/**
 * 检查一个属性是否被 @Column 装饰器标记
 */
export function isColumn(target: any, propertyKey: string | symbol): boolean {
  return Reflect.getMetadata('tablestore:column', target, propertyKey) === true;
}
