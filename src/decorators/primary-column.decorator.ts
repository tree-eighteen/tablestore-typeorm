// src/typeorm-style/decorators/primary-column.decorator.ts

import "reflect-metadata";
import { metadataStorage, ColumnMetadata } from './metadata-storage';
import { ColumnOptions } from './column.decorator';

/**
 * 主键列装饰器选项
 */
export interface PrimaryColumnOptions extends Omit<ColumnOptions, 'nullable'> {
  /** 主键类型，Tablestore 支持 STRING, INTEGER, BINARY */
  tablestoreType?: 'STRING' | 'INTEGER' | 'BINARY';
}

/**
 * PrimaryColumn 装饰器
 * 用于标记一个属性为主键列
 * 
 * @param options 主键列选项
 * @returns 属性装饰器
 * 
 * @example
 * ```typescript
 * @Entity()
 * export class User {
 *   @PrimaryColumn()
 *   id: string;
 * 
 *   @PrimaryColumn({ tablestoreType: 'STRING' })
 *   category: string;
 * 
 *   @Column()
 *   name: string;
 * }
 * ```
 */
export function PrimaryColumn(options?: PrimaryColumnOptions): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol) {
    const propertyName = propertyKey.toString();
    
    // 获取属性的反射类型信息
    const reflectedType = Reflect.getMetadata('design:type', target, propertyKey);
    
    // 创建主键列元数据
    const columnMetadata: ColumnMetadata = {
      target: target.constructor,
      propertyName,
      type: options?.type || reflectedType,
      nullable: false, // 主键不能为空
      default: options?.default,
      transformer: options?.transformer,
      tablestoreType: options?.tablestoreType || 'STRING',
      isPrimary: true
    };

    // 存储列元数据
    metadataStorage.addColumnMetadata(target.constructor, columnMetadata);

    // 在属性上设置元数据标记
    Reflect.defineMetadata('tablestore:primaryColumn', true, target, propertyKey);
    Reflect.defineMetadata('tablestore:column', true, target, propertyKey);
  };
}

/**
 * 检查一个属性是否被 @PrimaryColumn 装饰器标记
 */
export function isPrimaryColumn(target: any, propertyKey: string | symbol): boolean {
  return Reflect.getMetadata('tablestore:primaryColumn', target, propertyKey) === true;
}
