// src/filter-factory.ts

import Tablestore from "aliyun-tablestore-nodejs-sdk";
import { EntityMetadata, ColumnMetadata } from "./decorators/metadata-storage";

export type ColumnFilterOptions = {
  passIfMissing?: boolean;
  latestVersionOnly?: boolean;
};

/**
 * 用于构建 Tablestore ColumnCondition 的工厂类
 *
 * 提供丰富的查询条件构建方法，支持：
 * - 比较操作：equals, notEqual, greaterThan, lessThan 等
 * - 逻辑操作：and, or, not
 * - 适用于任何字段类型：字符串、数字、布尔值、日期等
 *
 * @example
 * // 在 QueryBuilder 中使用
 * queryBuilder.filter(f => f.equals('name', 'John'));
 *
 * // 复杂条件组合
 * queryBuilder.filter(f => f.and(
 *   f.greaterThan('age', 18),
 *   f.or(
 *     f.equals('city', '北京'),
 *     f.equals('city', '上海')
 *   )
 * ));
 */
export class FilterFactory<T> {
  private readonly metadata: EntityMetadata;

  constructor(metadata: EntityMetadata) {
    this.metadata = metadata;
  }

  // --- Private Helper for Single Condition ---
  private createSingleCondition<K extends keyof T>(
    field: K,
    value: T[K],
    comparator: any,
    options?: ColumnFilterOptions
  ): Tablestore.SingleColumnCondition {
    const fieldName = field as string;
    const columnMetadata = this.findColumnMetadata(fieldName);
    
    if (!columnMetadata) {
      throw new Error(`字段 "${fieldName}" 在实体定义中不存在。`);
    }

    const columnValue = this.convertValueToTablestore(value, columnMetadata);
    if (columnValue === null || columnValue === undefined) {
      throw new Error(`字段 "${fieldName}" 的值不能为 null 或 undefined。`);
    }

    return new Tablestore.SingleColumnCondition(
      fieldName,
      columnValue,
      comparator,
      options?.passIfMissing ?? true,
      options?.latestVersionOnly ?? true
    );
  }

  private findColumnMetadata(fieldName: string): ColumnMetadata | undefined {
    return this.metadata.columns.find(col => col.propertyName === fieldName);
  }

  private convertValueToTablestore(value: any, column: ColumnMetadata): any {
    // 简化的类型转换，可以根据需要扩展
    if (typeof value === 'number' && Number.isInteger(value)) {
      return Tablestore.Long.fromNumber(value);
    }
    if (value instanceof Date) {
      return value.getTime();
    }
    return value;
  }

  // --- Comparison Methods ---

  /**
   * 等于 (=) - 精确匹配查询
   *
   * @param field 要查询的字段名
   * @param value 要匹配的值
   * @param options 列过滤选项
   *
   * @example
   * // 查询姓名为 'John' 的记录
   * f.equals('name', 'John')
   *
   * // 查询年龄为 25 的记录
   * f.equals('age', 25)
   *
   * // 查询激活状态的用户
   * f.equals('isActive', true)
   */
  public equals<K extends keyof T>(
    field: K,
    value: T[K],
    options?: ColumnFilterOptions
  ): Tablestore.SingleColumnCondition {
    return this.createSingleCondition(
      field,
      value,
      Tablestore.ComparatorType.EQUAL,
      options
    );
  }

  /**
   * 不等于 (!=) - 排除特定值
   *
   * @param field 要查询的字段名
   * @param value 要排除的值
   * @param options 列过滤选项
   *
   * @example
   * // 查询姓名不是 'John' 的记录
   * f.notEqual('name', 'John')
   *
   * // 查询非激活状态的用户
   * f.notEqual('isActive', true)
   */
  public notEqual<K extends keyof T>(
    field: K,
    value: T[K],
    options?: ColumnFilterOptions
  ): Tablestore.SingleColumnCondition {
    return this.createSingleCondition(
      field,
      value,
      Tablestore.ComparatorType.NOT_EQUAL,
      options
    );
  }

  /**
   * 大于 (>) - 范围查询
   *
   * @param field 要查询的字段名
   * @param value 比较的基准值
   * @param options 列过滤选项
   *
   * @example
   * // 查询年龄大于 18 的记录
   * f.greaterThan('age', 18)
   *
   * // 查询工资大于 5000 的记录
   * f.greaterThan('salary', 5000)
   */
  public greaterThan<K extends keyof T>(
    field: K,
    value: T[K],
    options?: ColumnFilterOptions
  ): Tablestore.SingleColumnCondition {
    return this.createSingleCondition(
      field,
      value,
      Tablestore.ComparatorType.GREATER_THAN,
      options
    );
  }

  /**
   * 大于等于 (>=) - 范围查询（包含边界值）
   *
   * @param field 要查询的字段名
   * @param value 比较的基准值（包含此值）
   * @param options 列过滤选项
   *
   * @example
   * // 查询年龄大于等于 18 的记录（包含 18 岁）
   * f.greaterThanOrEqual('age', 18)
   *
   * // 工资范围查询的下限
   * f.greaterThanOrEqual('salary', 5000)
   */
  public greaterThanOrEqual<K extends keyof T>(
    field: K,
    value: T[K],
    options?: ColumnFilterOptions
  ): Tablestore.SingleColumnCondition {
    return this.createSingleCondition(
      field,
      value,
      Tablestore.ComparatorType.GREATER_EQUAL,
      options
    );
  }

  /**
   * 小于 (<) - 范围查询
   *
   * @param field 要查询的字段名
   * @param value 比较的基准值
   * @param options 列过滤选项
   *
   * @example
   * // 查询年龄小于 65 的记录
   * f.lessThan('age', 65)
   *
   * // 查询工资小于 10000 的记录
   * f.lessThan('salary', 10000)
   */
  public lessThan<K extends keyof T>(
    field: K,
    value: T[K],
    options?: ColumnFilterOptions
  ): Tablestore.SingleColumnCondition {
    return this.createSingleCondition(
      field,
      value,
      Tablestore.ComparatorType.LESS_THAN,
      options
    );
  }

  /**
   * 小于等于 (<=) - 范围查询（包含边界值）
   *
   * @param field 要查询的字段名
   * @param value 比较的基准值（包含此值）
   * @param options 列过滤选项
   *
   * @example
   * // 查询年龄小于等于 65 的记录（包含 65 岁）
   * f.lessThanOrEqual('age', 65)
   *
   * // 工资范围查询的上限
   * f.lessThanOrEqual('salary', 10000)
   *
   * // 组合使用：查询工资在 5000-10000 之间的记录
   * f.and(
   *   f.greaterThanOrEqual('salary', 5000),
   *   f.lessThanOrEqual('salary', 10000)
   * )
   */
  public lessThanOrEqual<K extends keyof T>(
    field: K,
    value: T[K],
    options?: ColumnFilterOptions
  ): Tablestore.SingleColumnCondition {
    return this.createSingleCondition(
      field,
      value,
      Tablestore.ComparatorType.LESS_EQUAL,
      options
    );
  }

  // --- Logic Methods ---

  /**
   * 逻辑与 (AND) - 所有条件都必须满足
   *
   * @param conditions 要组合的条件列表
   *
   * @example
   * // 查询年龄大于 18 且城市为北京的记录
   * f.and(
   *   f.greaterThan('age', 18),
   *   f.equals('city', '北京')
   * )
   *
   * // 工资范围查询：5000-10000 之间
   * f.and(
   *   f.greaterThanOrEqual('salary', 5000),
   *   f.lessThanOrEqual('salary', 10000)
   * )
   *
   * // 多条件组合
   * f.and(
   *   f.equals('isActive', true),
   *   f.greaterThan('age', 18),
   *   f.notEqual('department', '已离职')
   * )
   */
  public and(
    ...conditions: Tablestore.ColumnCondition[]
  ): Tablestore.CompositeCondition {
    if (conditions.length === 0) {
      throw new Error("AND 操作符需要至少一个条件。");
    }
    const composite = new Tablestore.CompositeCondition(
      Tablestore.LogicalOperator.AND
    );
    conditions.forEach((cond) => composite.addSubCondition(cond));
    return composite;
  }

  /**
   * 逻辑或 (OR) - 任一条件满足即可
   *
   * @param conditions 要组合的条件列表
   *
   * @example
   * // 查询城市为北京或上海的记录
   * f.or(
   *   f.equals('city', '北京'),
   *   f.equals('city', '上海')
   * )
   *
   * // 查询高级员工：高工资或高级职位
   * f.or(
   *   f.greaterThan('salary', 20000),
   *   f.equals('position', '总监')
   * )
   *
   * // 复杂组合：年轻高薪或资深员工
   * f.or(
   *   f.and(
   *     f.lessThan('age', 30),
   *     f.greaterThan('salary', 15000)
   *   ),
   *   f.greaterThan('workYears', 10)
   * )
   */
  public or(
    ...conditions: Tablestore.ColumnCondition[]
  ): Tablestore.CompositeCondition {
    if (conditions.length === 0) {
      throw new Error("OR 操作符需要至少一个条件。");
    }
    const composite = new Tablestore.CompositeCondition(
      Tablestore.LogicalOperator.OR
    );
    conditions.forEach((cond) => composite.addSubCondition(cond));
    return composite;
  }

  /**
   * 逻辑非 (NOT) - 条件取反
   *
   * @param condition 要取反的条件
   *
   * @example
   * // 查询不是北京的记录
   * f.not(f.equals('city', '北京'))
   *
   * // 查询工资不在 5000-8000 范围内的记录
   * f.not(
   *   f.and(
   *     f.greaterThanOrEqual('salary', 5000),
   *     f.lessThanOrEqual('salary', 8000)
   *   )
   * )
   *
   * // 查询非激活状态的用户（另一种写法）
   * f.not(f.equals('isActive', true))
   */
  public not(
    condition: Tablestore.ColumnCondition
  ): Tablestore.CompositeCondition {
    const composite = new Tablestore.CompositeCondition(
      Tablestore.LogicalOperator.NOT
    );
    composite.addSubCondition(condition);
    return composite;
  }
}
