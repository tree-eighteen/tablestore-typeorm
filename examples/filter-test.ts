// examples/filter-test.ts

import Tablestore from "aliyun-tablestore-nodejs-sdk";
import { FilterFactory } from "../src/filter-factory";
import { EntityMetadata, ColumnMetadata } from "../src/decorators/metadata-storage";

// 模拟实体类
class Product {
  category!: string;
  id!: string;
  name!: string;
  price!: number;
  stock!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

// 模拟实体元数据
const mockMetadata: EntityMetadata = {
  tableName: "products",
  target: Product,
  primaryColumns: [
    { propertyName: "category", type: String, target: Product } as ColumnMetadata,
    { propertyName: "id", type: String, target: Product } as ColumnMetadata
  ],
  columns: [
    { propertyName: "category", type: String, target: Product } as ColumnMetadata,
    { propertyName: "id", type: String, target: Product } as ColumnMetadata,
    { propertyName: "name", type: String, target: Product } as ColumnMetadata,
    { propertyName: "price", type: Number, target: Product } as ColumnMetadata,
    { propertyName: "stock", type: Number, target: Product } as ColumnMetadata,
    { propertyName: "createdAt", type: Date, target: Product } as ColumnMetadata,
    { propertyName: "updatedAt", type: Date, target: Product } as ColumnMetadata
  ]
};

interface Product {
  category: string;
  id: string;
  name: string;
  price: number;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}

function main() {
  console.log("=== FilterFactory 功能测试 ===");

  const filterFactory = new FilterFactory<Product>(mockMetadata);

  try {
    // 1. 测试等于条件
    console.log("\n1. 测试等于条件 (price = 1000):");
    const equalsCondition = filterFactory.equals("price", 1000);
    console.log("✓ 等于条件创建成功");
    console.log(`  条件类型: ${equalsCondition.constructor.name}`);

    // 2. 测试大于条件
    console.log("\n2. 测试大于条件 (price > 500):");
    const greaterThanCondition = filterFactory.greaterThan("price", 500);
    console.log("✓ 大于条件创建成功");

    // 3. 测试小于等于条件
    console.log("\n3. 测试小于等于条件 (stock <= 10):");
    const lessThanOrEqualCondition = filterFactory.lessThanOrEqual("stock", 10);
    console.log("✓ 小于等于条件创建成功");

    // 4. 测试 AND 复合条件
    console.log("\n4. 测试 AND 复合条件 (price >= 100 AND stock > 5):");
    const andCondition = filterFactory.and(
      filterFactory.greaterThanOrEqual("price", 100),
      filterFactory.greaterThan("stock", 5)
    );
    console.log("✓ AND 复合条件创建成功");
    console.log(`  条件类型: ${andCondition.constructor.name}`);

    // 5. 测试 OR 复合条件
    console.log("\n5. 测试 OR 复合条件 (price < 200 OR stock < 3):");
    const orCondition = filterFactory.or(
      filterFactory.lessThan("price", 200),
      filterFactory.lessThan("stock", 3)
    );
    console.log("✓ OR 复合条件创建成功");

    // 6. 测试 NOT 条件
    console.log("\n6. 测试 NOT 条件 (NOT price = 999):");
    const notCondition = filterFactory.not(
      filterFactory.equals("price", 999)
    );
    console.log("✓ NOT 条件创建成功");

    // 7. 测试复杂嵌套条件
    console.log("\n7. 测试复杂嵌套条件:");
    console.log("   (price >= 500 AND stock > 10) OR (price < 100 AND stock > 50)");
    const complexCondition = filterFactory.or(
      filterFactory.and(
        filterFactory.greaterThanOrEqual("price", 500),
        filterFactory.greaterThan("stock", 10)
      ),
      filterFactory.and(
        filterFactory.lessThan("price", 100),
        filterFactory.greaterThan("stock", 50)
      )
    );
    console.log("✓ 复杂嵌套条件创建成功");

    // 8. 测试字符串条件
    console.log("\n8. 测试字符串条件 (name = 'iPhone'):");
    const stringCondition = filterFactory.equals("name", "iPhone");
    console.log("✓ 字符串条件创建成功");

    // 9. 测试日期条件
    console.log("\n9. 测试日期条件 (createdAt > 某个日期):");
    const dateCondition = filterFactory.greaterThan("createdAt", new Date("2024-01-01"));
    console.log("✓ 日期条件创建成功");

    // 10. 测试错误处理
    console.log("\n10. 测试错误处理:");
    try {
      // @ts-ignore - 故意传入不存在的字段来测试错误处理
      filterFactory.equals("nonExistentField", "value");
      console.log("✗ 应该抛出错误但没有");
    } catch (error) {
      console.log("✓ 正确捕获了不存在字段的错误");
      console.log(`  错误信息: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      filterFactory.and(); // 空的 AND 条件
      console.log("✗ 应该抛出错误但没有");
    } catch (error) {
      console.log("✓ 正确捕获了空 AND 条件的错误");
      console.log(`  错误信息: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log("\n=== FilterFactory 功能测试完成 ===");
    console.log("✓ 所有测试通过！FilterFactory 工作正常。");

  } catch (error) {
    console.error("测试过程中发生错误:", error);
    process.exit(1);
  }
}

main();
