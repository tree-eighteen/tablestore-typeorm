// src/typeorm-style/pagination.ts

import Tablestore from "aliyun-tablestore-nodejs-sdk";
import { FilterFactory } from "./filter-factory";

/**
 * 查找选项（简化版本，仅用于基本查询）
 */
export interface FindOptions<T> {
  /** 要选择的列 */
  select?: (keyof T)[];
  /** 查询条件 */
  where?: Partial<T>;
  /** 排序 */
  order?: { [P in keyof T]?: "ASC" | "DESC" };
  /** 限制数量 */
  take?: number;
  /** 起始位置的主键值（替代 skip） */
  startAfter?: Partial<T>;
  /** 结束位置的主键值 */
  endBefore?: Partial<T>;
}

/**
 * 游标分页选项
 */
export interface CursorPaginationOptions<T = any> {
  /** 每页数量 */
  limit: number;
  /** 游标（编码后的主键信息） */
  cursor?: string;
  /** 排序方向 */
  order?: "ASC" | "DESC";
  /** 主键 WHERE 条件 */
  where?: Partial<T>;
  /** 高级过滤条件回调 */
  filter?: (filter: FilterFactory<T>) => any;
}

/**
 * 游标分页结果
 */
export interface CursorPaginationResult<T> {
  /** 当前页的数据 */
  items: T[];
  /** 是否有下一页 */
  hasNext: boolean;
  /** 下一页的游标 */
  nextCursor?: string;
}

/**
 * 分页工具类
 */
export class PaginationUtils {
  /**
   * 编码主键为游标字符串
   */
  static encodeCursor<T>(primaryKeys: Partial<T>): string {
    try {
      return Buffer.from(JSON.stringify(primaryKeys)).toString("base64");
    } catch (error) {
      throw new Error(
        `编码游标失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 解码游标字符串为主键
   */
  static decodeCursor<T>(cursor: string): Partial<T> {
    try {
      const decoded = Buffer.from(cursor, "base64").toString("utf-8");
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error(
        `解码游标失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 从 Tablestore 主键输出创建主键对象
   */
  static createPrimaryKeysFromTablestore<T>(
    tablestorePrimaryKey: Tablestore.PrimaryKeyOutput
  ): Partial<T> {
    const primaryKeys: any = {};

    if (tablestorePrimaryKey && Array.isArray(tablestorePrimaryKey)) {
      for (const pk of tablestorePrimaryKey) {
        if (pk && typeof pk === "object" && "name" in pk && "value" in pk) {
          const name = pk.name as string;
          const value = pk.value;

          // 处理 Tablestore 的特殊值
          if (
            value &&
            typeof value === "object" &&
            (value.toString() === "INF_MIN" || value.toString() === "INF_MAX")
          ) {
            continue;
          }

          primaryKeys[name] = value;
        }
      }
    }

    return primaryKeys;
  }
}
