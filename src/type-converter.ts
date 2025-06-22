// src/typeorm-style/type-converter.ts

import Tablestore from "aliyun-tablestore-nodejs-sdk";
import { ColumnMetadata } from "./decorators/metadata-storage";

/**
 * 类型转换器
 * 负责 JavaScript 类型与 Tablestore 类型之间的转换
 */
export class TypeConverter {
  /**
   * 将 JavaScript 值转换为 Tablestore 值
   */
  static toTablestore(value: any, column: ColumnMetadata): any {
    if (value === null || value === undefined) {
      return undefined;
    }

    // 如果有自定义转换器，优先使用
    if (column.transformer?.to) {
      return column.transformer.to(value);
    }

    // 根据列的类型进行转换
    switch (column.type) {
      case String:
        return String(value);

      case Number:
        // 根据 Tablestore 类型决定转换方式
        if (column.tablestoreType === 'INTEGER') {
          return Tablestore.Long.fromNumber(Number(value));
        } else {
          return Number(value);
        }

      case Boolean:
        return Boolean(value);

      case Date:
        const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
        return Tablestore.Long.fromNumber(timestamp);

      case Array:
      case Object:
        return JSON.stringify(value);

      case BigInt:
        return Tablestore.Long.fromNumber(Number(value));

      default:
        // 对于未知类型，尝试根据 tablestoreType 转换
        return this.convertByTablestoreType(value, column.tablestoreType);
    }
  }

  /**
   * 将 Tablestore 值转换为 JavaScript 值
   */
  static fromTablestore(value: any, column: ColumnMetadata): any {
    if (value === null || value === undefined) {
      return undefined;
    }

    // 处理 Tablestore 的特殊值
    if (value === Tablestore.INF_MIN || value === Tablestore.INF_MAX) {
      return value.toString();
    }

    // 如果有自定义转换器，优先使用
    if (column.transformer?.from) {
      return column.transformer.from(value);
    }

    const stringValue = value.toString();

    // 根据列的类型进行转换
    switch (column.type) {
      case String:
        return stringValue;

      case Number:
        return Number(stringValue);

      case Boolean:
        return stringValue === 'true' || stringValue === '1' || stringValue === 'TRUE';

      case Date:
        return new Date(Number(stringValue));

      case Array:
        try {
          const parsed = JSON.parse(stringValue);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }

      case Object:
        try {
          return JSON.parse(stringValue);
        } catch {
          return {};
        }

      case BigInt:
        return BigInt(Number(stringValue));

      default:
        // 对于未知类型，返回字符串值
        return stringValue;
    }
  }

  /**
   * 根据 Tablestore 类型进行转换
   */
  private static convertByTablestoreType(value: any, tablestoreType?: string): any {
    switch (tablestoreType) {
      case 'STRING':
        return String(value);

      case 'INTEGER':
        return Tablestore.Long.fromNumber(Number(value));

      case 'DOUBLE':
        return Number(value);

      case 'BOOLEAN':
        return Boolean(value);

      case 'BINARY':
        if (value instanceof Buffer) {
          return value;
        }
        return Buffer.from(String(value));

      default:
        return String(value);
    }
  }

  /**
   * 获取默认的 Tablestore 类型
   */
  static getDefaultTablestoreType(jsType: Function): string {
    switch (jsType) {
      case String:
        return 'STRING';
      case Number:
        return 'DOUBLE';
      case Boolean:
        return 'BOOLEAN';
      case Date:
        return 'INTEGER'; // 存储为时间戳
      case BigInt:
        return 'INTEGER';
      case Buffer:
        return 'BINARY';
      default:
        return 'STRING'; // 默认为字符串，复杂对象会被序列化
    }
  }

  /**
   * 验证值是否符合列的类型要求
   */
  static validateValue(value: any, column: ColumnMetadata): boolean {
    if (value === null || value === undefined) {
      return column.nullable !== false;
    }

    // 如果有自定义验证逻辑，可以在这里添加
    return true;
  }

  /**
   * 应用默认值
   */
  static applyDefault(column: ColumnMetadata): any {
    if (column.default === undefined) {
      return undefined;
    }

    if (typeof column.default === 'function') {
      return column.default();
    }

    return column.default;
  }
}
