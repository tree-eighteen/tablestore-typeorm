// examples/where-example.ts

import { config } from "dotenv";
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DataSource,
  DataSourceOptions,
  FilterFactory,
} from "../src";

config();

@Entity("pagination_products")
class Product {
  @PrimaryColumn({ tablestoreType: "STRING" })
  category!: string;

  @PrimaryColumn({ tablestoreType: "STRING" })
  id!: string;

  @Column()
  name!: string;

  @Column({ type: Number })
  price!: number;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: Boolean, default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

async function main() {
  try {
    // 配置数据源
    const dataSourceOptions: DataSourceOptions = {
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.ALIYUN_ACCESS_KEY_SECRET || "",
      endpoint: process.env.TABLE_STORE_ENDPOINT || "",
      instancename: process.env.TABLE_STORE_INSTANCE_NAME || "",
      entities: [Product],
    };

    const dataSource = new DataSource(dataSourceOptions);
    await dataSource.initialize();

    const productRepository = dataSource.getRepository(Product);

    console.log("=== 测试 WHERE 条件查询 ===");

    // 1. 部分主键查询 (自动补充为范围查询)
    console.log("\n1. 部分主键查询 (category = 'electronics'):");
    const electronicsProducts = await productRepository
      .createQueryBuilder()
      .where({ category: "electronics" })
      .orderBy('DESC')  // 直接传入排序方向，自动使用主键排序
      .limit(5)
      .getMany();

    console.log(`找到 ${electronicsProducts.length} 个电子产品 (降序):`);
    electronicsProducts.forEach((product) => {
      console.log(
        `  - ${product.category}/${product.id}: ${product.name} (¥${product.price})`
      );
    });

    // 1.2. 升序排序测试
    console.log("\n1.2. 部分主键查询 (升序排序):");
    const electronicsProductsAsc = await productRepository
      .createQueryBuilder()
      .where({ category: "electronics" })
      .orderBy('ASC')  // 直接传入升序排序
      .limit(5)
      .getMany();

    console.log(`找到 ${electronicsProductsAsc.length} 个电子产品 (升序):`);
    electronicsProductsAsc.forEach((product) => {
      console.log(
        `  - ${product.category}/${product.id}: ${product.name} (¥${product.price})`
      );
    });

    // 1.5. 精确主键查询
    console.log("\n1.5. 精确主键查询 (category = 'electronics', id = 'product003'):");
    const specificProduct = await productRepository
      .createQueryBuilder()
      .where({ category: "electronics", id: "product003" })
      .getOne();

    if (specificProduct) {
      console.log(`找到产品: ${specificProduct.category}/${specificProduct.id}: ${specificProduct.name} (¥${specificProduct.price})`);
    } else {
      console.log("未找到指定产品");
    }

    // 2. 使用 filter 进行高级条件查询
    console.log("\n2. 高级条件查询 (price > 1000):");
    const expensiveProducts = await productRepository
      .createQueryBuilder()
      .filter((f) => f.greaterThan("price", 1000))
      .getMany();

    console.log(`找到 ${expensiveProducts.length} 个价格超过 1000 的产品:`);
    expensiveProducts.forEach((product) => {
      console.log(
        `  - ${product.category}/${product.id}: ${product.name} (¥${product.price})`
      );
    });

    // 3. 复合条件查询 (AND)
    console.log("\n3. 复合条件查询 (price >= 500 AND isActive = true):");
    const availableProducts = await productRepository
      .createQueryBuilder()
      .filter((f) =>
        f.and(f.greaterThanOrEqual("price", 500), f.equals("isActive", true))
      )
      .getMany();

    console.log(`找到 ${availableProducts.length} 个符合条件的产品:`);
    availableProducts.forEach((product) => {
      console.log(
        `  - ${product.category}/${product.id}: ${product.name} (¥${product.price}, 活跃: ${product.isActive})`
      );
    });

    // 4. 复合条件查询 (OR)
    console.log("\n4. 复合条件查询 (price < 500 OR isActive = false):");
    const cheapOrInactiveProducts = await productRepository
      .createQueryBuilder()
      .filter((f) => f.or(f.lessThan("price", 500), f.equals("isActive", false)))
      .getMany();

    console.log(
      `找到 ${cheapOrInactiveProducts.length} 个便宜或非活跃的产品:`
    );
    cheapOrInactiveProducts.forEach((product) => {
      console.log(
        `  - ${product.category}/${product.id}: ${product.name} (¥${product.price}, 活跃: ${product.isActive})`
      );
    });

    // 5. 否定条件查询 (NOT)
    console.log("\n5. 否定条件查询 (NOT price = 999):");
    const notSpecificPriceProducts = await productRepository
      .createQueryBuilder()
      .filter((f) => f.not(f.equals("price", 999)))
      .limit(5)
      .getMany();

    console.log(
      `找到 ${notSpecificPriceProducts.length} 个价格不等于 999 的产品:`
    );
    notSpecificPriceProducts.forEach((product) => {
      console.log(
        `  - ${product.category}/${product.id}: ${product.name} (¥${product.price})`
      );
    });

    // 6. 结合分页的条件查询 - WHERE
    console.log("\n6. 分页 + WHERE 条件查询:");
    const electronicsPage = await productRepository.page({
      limit: 3,
      order: "ASC",
      where: { category: "electronics" }
    });

    console.log(`电子产品分页结果 (前3个):`);
    electronicsPage.items.forEach((product) => {
      console.log(
        `  - ${product.category}/${product.id}: ${product.name} (¥${product.price})`
      );
    });
    console.log(`是否有下一页: ${electronicsPage.hasNext}`);

    // 7. 分页 + FILTER 条件查询
    console.log("\n7. 分页 + FILTER 条件查询:");
    const expensiveProductsPage = await productRepository.page({
      limit: 3,
      order: "ASC",
      filter: (f) => f.greaterThan("price", 500)
    });

    console.log(`价格 > 500 的产品分页结果:`);
    expensiveProductsPage.items.forEach((product) => {
      console.log(
        `  - ${product.category}/${product.id}: ${product.name} (¥${product.price})`
      );
    });
    console.log(`是否有下一页: ${expensiveProductsPage.hasNext}`);

    // 8. 分页 + WHERE + FILTER 组合查询
    console.log("\n8. 分页 + WHERE + FILTER 组合查询:");
    const combinedPage = await productRepository.page({
      limit: 2,
      order: "DESC",
      where: { category: "books" },
      filter: (f) => f.greaterThanOrEqual("price", 300)
    });

    console.log(`书籍类别且价格 >= 300 的产品:`);
    combinedPage.items.forEach((product) => {
      console.log(
        `  - ${product.category}/${product.id}: ${product.name} (¥${product.price})`
      );
    });
    console.log(`是否有下一页: ${combinedPage.hasNext}`);

    await dataSource.destroy();
    console.log("\n=== WHERE 条件查询测试完成 ===");
  } catch (error) {
    console.error("测试过程中发生错误:", error);
    process.exit(1);
  }
}

main().catch(console.error);
