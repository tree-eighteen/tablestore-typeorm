// examples/typeorm-style-example.ts

import "reflect-metadata";
import { config } from "dotenv";
import { 
  Entity, 
  PrimaryColumn, 
  Column, 
  DataSource, 
  DataSourceOptions 
} from "../src";

config();

// 定义用户实体
@Entity("users", { 
  autoCreateTable: true,
  tableOptions: {
    timeToLive: -1,
    maxVersions: 1
  },
  reservedThroughput: {
    read: 0,
    write: 0
  }
})
export class User {
  @PrimaryColumn({ tablestoreType: 'STRING' })
  id: string;

  @PrimaryColumn({ tablestoreType: 'STRING' })
  category: string;

  @Column()
  name: string;

  @Column({ type: Number, default: 0 })
  age: number;

  @Column({ nullable: true })
  email?: string;

  @Column({ type: Boolean, default: true })
  isActive: boolean;

  @Column({ 
    type: Date,
    transformer: {
      to: (value: Date) => value.getTime(),
      from: (value: number) => new Date(value)
    }
  })
  createdAt: Date;

  @Column({ type: Array, nullable: true })
  tags?: string[];

  @Column({ 
    type: Object, 
    nullable: true,
    transformer: {
      to: (value: any) => JSON.stringify(value),
      from: (value: string) => JSON.parse(value)
    }
  })
  metadata?: Record<string, any>;
}

// 定义产品实体
@Entity("products", { autoCreateTable: true })
export class Product {
  @PrimaryColumn()
  productId: string;

  @PrimaryColumn()
  category: string;

  @Column()
  name: string;

  @Column({ type: Number, default: 0 })
  price: number;

  @Column({ type: Number, nullable: true })
  stock?: number;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: Boolean, default: true })
  status: boolean;
}

// 配置数据源
const dataSourceOptions: DataSourceOptions = {
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.ALIYUN_ACCESS_KEY_SECRET || "",
  endpoint: process.env.TABLE_STORE_ENDPOINT || "",
  instancename: process.env.TABLE_STORE_INSTANCE_NAME || "",
  entities: [User, Product],
  synchronize: true, // 自动同步表结构
  logging: true
};

// 创建数据源
const dataSource = new DataSource(dataSourceOptions);

async function runExample() {
  try {
    // 初始化数据源
    await dataSource.initialize();
    console.log("数据源初始化成功");

    // 获取 Repository
    const userRepository = dataSource.getRepository(User);
    const productRepository = dataSource.getRepository(Product);

    // 创建用户
    console.log("\n=== 创建用户 ===");
    const user = userRepository.create({
      id: "user001",
      category: "premium",
      name: "张三",
      age: 25,
      email: "zhangsan@example.com",
      isActive: true,
      createdAt: new Date(),
      tags: ["developer", "typescript"],
      metadata: { level: "senior", department: "engineering" }
    });

    const savedUser = await userRepository.save(user);
    console.log("用户创建成功:", savedUser);

    // 查找用户
    console.log("\n=== 查找用户 ===");
    const foundUser = await userRepository.findOne({
      id: "user001",
      category: "premium"
    });
    console.log("找到用户:", foundUser);

    // 使用 QueryBuilder 查询
    console.log("\n=== 使用 QueryBuilder 查询 ===");
    const queryResult = await userRepository
      .createQueryBuilder("user")
      .where({ id: "user001", category: "premium" })
      .select(["name", "age", "email"])
      .getOne();
    console.log("QueryBuilder 查询结果:", queryResult);

    // 更新用户
    console.log("\n=== 更新用户 ===");
    await userRepository.update(
      { id: "user001", category: "premium" },
      { age: 26, email: "zhangsan.new@example.com" }
    );
    console.log("用户更新成功");

    // 验证更新
    const updatedUser = await userRepository.findOne({
      id: "user001",
      category: "premium"
    });
    console.log("更新后的用户:", updatedUser);

    // 创建产品
    console.log("\n=== 创建产品 ===");
    const product = productRepository.create({
      productId: "prod001",
      category: "electronics",
      name: "智能手机",
      price: 2999.99,
      stock: 100,
      description: "最新款智能手机",
      status: true
    });

    await productRepository.save(product);
    console.log("产品创建成功");

    // 批量创建产品
    console.log("\n=== 批量创建产品 ===");
    const products = [
      productRepository.create({
        productId: "prod002",
        category: "electronics",
        name: "平板电脑",
        price: 1999.99,
        stock: 50
      }),
      productRepository.create({
        productId: "prod003",
        category: "electronics",
        name: "笔记本电脑",
        price: 5999.99,
        stock: 30
      })
    ];

    await productRepository.saveMany(products);
    console.log("批量产品创建成功");

    // 使用 EntityManager 进行操作
    console.log("\n=== 使用 EntityManager ===");
    const entityManager = dataSource.getEntityManager();
    
    const managerUser = await entityManager.findOne(User, {
      id: "user001",
      category: "premium"
    });
    console.log("EntityManager 查找用户:", managerUser);

    // 范围查询示例
    console.log("\n=== 范围查询 ===");
    const rangeResults = await productRepository
      .createQueryBuilder("product")
      .startWith({ productId: "prod001", category: "electronics" })
      .endWith({ productId: "prod999", category: "electronics" })
      .limit(10)
      .getMany();
    console.log("范围查询结果:", rangeResults);

    // // 删除操作
    // console.log("\n=== 删除操作 ===");
    // await userRepository.delete({ id: "user001", category: "premium" });
    // console.log("用户删除成功");

    // await productRepository.deleteBy({ category: "electronics" });
    // console.log("产品批量删除成功");

  } catch (error) {
    console.error("示例执行失败:", error);
  } finally {
    // 清理资源
    await dataSource.destroy();
    console.log("数据源已销毁");
  }
}

// 运行示例
if (require.main === module) {
  runExample().catch(console.error);
}

export { runExample };
