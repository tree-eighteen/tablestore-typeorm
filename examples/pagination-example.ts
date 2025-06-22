// examples/pagination-example.ts

import "reflect-metadata";
import { config } from "dotenv";
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DataSource,
  DataSourceOptions,
  CursorPaginationOptions,
  PaginationUtils,
} from "../src";

config();

// 定义产品实体
@Entity("pagination_products", {
  autoCreateTable: true,
  tableOptions: {
    timeToLive: -1,
    maxVersions: 1,
  },
  reservedThroughput: {
    read: 0,
    write: 0,
  },
})
export class Product {
  @PrimaryColumn({ tablestoreType: "STRING" })
  category: string;

  @PrimaryColumn({ tablestoreType: "STRING" })
  id: string;

  @Column()
  name: string;

  @Column({ type: Number })
  price: number;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: Boolean, default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// 配置数据源
const dataSourceOptions: DataSourceOptions = {
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.ALIYUN_ACCESS_KEY_SECRET || "",
  endpoint: process.env.TABLE_STORE_ENDPOINT || "",
  instancename: process.env.TABLE_STORE_INSTANCE_NAME || "",
  entities: [Product],
  synchronize: true,
  logging: true,
};

// 创建数据源
const dataSource = new DataSource(dataSourceOptions);

async function runPaginationExample() {
  try {
    // 初始化数据源
    await dataSource.initialize();
    console.log("数据源初始化成功");

    // 获取 Repository
    const productRepository = dataSource.getRepository(Product);

    // console.log("\n=== 准备测试数据 ===");

    // // 创建测试数据
    // const testProducts = [];
    // const categories = ['electronics', 'books', 'clothing'];

    // for (let i = 1; i <= 25; i++) {
    //   const category = categories[i % 3];
    //   const product = productRepository.create({
    //     category,
    //     id: `product${i.toString().padStart(3, '0')}`,
    //     name: `产品 ${i}`,
    //     price: Math.floor(Math.random() * 1000) + 10,
    //     description: `这是产品 ${i} 的描述`,
    //     isActive: true
    //   });
    //   testProducts.push(product);
    // }

    // // 批量保存测试数据
    // for (const product of testProducts) {
    //   await productRepository.save(product);
    // }
    // console.log(`创建了 ${testProducts.length} 个测试产品`);

    console.log("\n=== 测试游标分页查询 (升序) ===");
    var cursorPage;
    let pageNum = 1;
    do {
      cursorPage = await productRepository.page({
        limit: 3,
        cursor: cursorPage?.nextCursor,
        order: "ASC"
      });
      console.log(`第 ${pageNum} 页 (升序):`, cursorPage.items.map(p => `${p.category}/${p.id}`));
      pageNum++;
    } while (cursorPage.hasNext && pageNum <= 3);

    console.log("\n=== 测试游标分页查询 (降序) ===");
    var cursorPageDesc;
    pageNum = 1;
    do {
      cursorPageDesc = await productRepository.page({
        limit: 3,
        cursor: cursorPageDesc?.nextCursor,
        order: "DESC"
      });
      console.log(`第 ${pageNum} 页 (降序):`, cursorPageDesc.items.map(p => `${p.category}/${p.id}`));
      pageNum++;
    } while (cursorPageDesc.hasNext && pageNum <= 3);

    // // 清理测试数据
    // for (const product of testProducts) {
    //   await productRepository.delete({
    //     category: product.category,
    //     id: product.id
    //   });
    // }
    // console.log("测试数据清理完成");
  } catch (error) {
    console.error("分页示例执行失败:", error);
  } finally {
    // 清理资源
    await dataSource.destroy();
    console.log("数据源已销毁");
  }
}

// 运行示例
if (require.main === module) {
  runPaginationExample().catch(console.error);
}

export { runPaginationExample };
