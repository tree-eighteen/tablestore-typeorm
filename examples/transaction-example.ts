// examples/transaction-example.ts

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
  Transaction,
  TransactionStatus,
} from "../src";

config();

// 定义用户实体
@Entity("transaction_users", {
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
export class User {
  @PrimaryColumn({ tablestoreType: "STRING" })
  userId: string;

  @PrimaryColumn({ tablestoreType: "STRING" })
  id: string;

  @Column()
  name: string;

  @Column({ type: Number, default: 0 })
  balance: number;

  @Column()
  email: string;

  @Column({ type: Boolean, default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// 定义订单实体
@Entity("transaction_orders", {
  autoCreateTable: true,
  tableOptions: {
    timeToLive: -1,
    maxVersions: 1,
  },
})
export class Order {
  @PrimaryColumn({ tablestoreType: "STRING" })
  userId: string;

  @PrimaryColumn({ tablestoreType: "STRING" })
  orderId: string;

  @Column({ type: Number })
  amount: number;

  @Column()
  status: string;

  @Column()
  description: string;

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
  entities: [User, Order],
  synchronize: true,
  logging: true,
};

// 创建数据源
const dataSource = new DataSource(dataSourceOptions);

async function runTransactionExample() {
  try {
    // 初始化数据源
    await dataSource.initialize();
    console.log("数据源初始化成功");

    // 获取 Repository
    const userRepository = dataSource.getRepository(User);
    const orderRepository = dataSource.getRepository(Order);

    const userId = "user123";

    // 准备测试数据
    console.log("\n=== 准备测试数据 ===");
    const user = userRepository.create({
      userId,
      id: "profile",
      name: "张三",
      balance: 1000,
      email: "zhangsan@example.com",
      isActive: true,
    });

    await userRepository.save(user);
    console.log("用户创建成功:", user);

    // 示例 1: 使用手动事务管理
    console.log("\n=== 示例 1: 手动事务管理 ===");
    await manualTransactionExample(dataSource, userId);

    // 示例 2: 使用自动事务管理
    console.log("\n=== 示例 2: 自动事务管理 ===");
    await autoTransactionExample(dataSource, userId);

    // 示例 3: 事务回滚示例
    console.log("\n=== 示例 3: 事务回滚示例 ===");
    await transactionRollbackExample(dataSource, userId);

    // 示例 4: 事务超时示例
    console.log("\n=== 示例 4: 事务超时示例 ===");
    await transactionTimeoutExample(dataSource, userId);

    // 查看最终状态
    console.log("\n=== 最终状态 ===");
    const finalUser = await userRepository.findOne({ userId, id: "profile" });
    console.log("最终用户状态:", finalUser);

  } catch (error) {
    console.error("事务示例执行失败:", error);
  } finally {
    // 清理资源
    await dataSource.destroy();
    console.log("数据源已销毁");
  }
}

// 手动事务管理示例
async function manualTransactionExample(dataSource: DataSource, userId: string) {
  const transaction = await dataSource.startTransaction("transaction_users", { userId });

  try {
    console.log(`事务已开始，ID: ${transaction.getTransactionId()}`);

    // 在事务中查找用户
    const user = await transaction.findOne(User, { userId, id: "profile" });
    if (!user) {
      throw new Error("用户不存在");
    }

    console.log("事务中查找到用户:", user);

    // 检查余额
    if (user.balance < 100) {
      throw new Error("余额不足");
    }

    // 扣减余额
    await transaction.update(User, { userId, id: "profile" }, { balance: user.balance - 100 });

    // 创建订单
    const order = new Order();
    order.userId = userId;
    order.orderId = `order_${Date.now()}`;
    order.amount = 100;
    order.status = "paid";
    order.description = "手动事务测试订单";

    await transaction.save(order);

    // 提交事务
    await transaction.commit();
    console.log("事务提交成功");
    console.log("事务状态:", transaction.getStatus());

  } catch (error) {
    console.error("事务执行失败:", error);
    await transaction.rollback();
    console.log("事务已回滚");
    console.log("事务状态:", transaction.getStatus());
  }
}

// 自动事务管理示例
async function autoTransactionExample(dataSource: DataSource, userId: string) {
  try {
    const result = await dataSource.runInTransaction(
      "transaction_users",
      { userId },
      async (transaction: Transaction) => {
        console.log(`自动事务已开始，ID: ${transaction.getTransactionId()}`);

        // 查找用户
        const user = await transaction.findOne(User, { userId, id: "profile" });
        if (!user) {
          throw new Error("用户不存在");
        }

        // 检查余额
        if (user.balance < 50) {
          throw new Error("余额不足");
        }

        // 扣减余额
        await transaction.update(User, { userId, id: "profile" }, { balance: user.balance - 50 });

        // 创建订单
        const order = new Order();
        order.userId = userId;
        order.orderId = `order_auto_${Date.now()}`;
        order.amount = 50;
        order.status = "paid";
        order.description = "自动事务测试订单";

        await transaction.save(order);

        return "交易成功";
      }
    );

    console.log("自动事务执行结果:", result);
  } catch (error) {
    console.error("自动事务执行失败:", error);
  }
}

// 事务回滚示例
async function transactionRollbackExample(dataSource: DataSource, userId: string) {
  const transaction = await dataSource.startTransaction("transaction_users", { userId });

  try {
    console.log(`回滚测试事务已开始，ID: ${transaction.getTransactionId()}`);

    // 查找用户
    const user = await transaction.findOne(User, { userId, id: "profile" });
    if (!user) {
      throw new Error("用户不存在");
    }

    // 扣减余额
    await transaction.update(User, { userId, id: "profile" }, { balance: user.balance - 200 });

    // 创建订单
    const order = new Order();
    order.userId = userId;
    order.orderId = `order_rollback_${Date.now()}`;
    order.amount = 200;
    order.status = "paid";
    order.description = "回滚测试订单";

    await transaction.save(order);

    // 模拟业务逻辑错误
    throw new Error("模拟的业务逻辑错误");

  } catch (error) {
    console.error("事务执行失败:", error);
    await transaction.rollback();
    console.log("事务已回滚，所有更改都被撤销");
    console.log("事务状态:", transaction.getStatus());
  }
}

// 事务超时示例
async function transactionTimeoutExample(dataSource: DataSource, userId: string) {
  // 创建一个超时时间很短的事务
  const transaction = await dataSource.startTransaction(
    "transaction_users",
    { userId },
    { timeout: 5000 } // 5秒超时
  );

  try {
    console.log(`超时测试事务已开始，ID: ${transaction.getTransactionId()}`);
    console.log("事务是否活跃:", transaction.isActive());

    // 等待超过超时时间
    await new Promise(resolve => setTimeout(resolve, 6000));

    console.log("等待6秒后，事务是否活跃:", transaction.isActive());
    console.log("事务状态:", transaction.getStatus());

    // 尝试在超时后执行操作
    const user = await transaction.findOne(User, { userId, id: "profile" });
    console.log("超时后查找用户:", user);

  } catch (error) {
    console.error("超时事务操作失败:", error);
    console.log("事务状态:", transaction.getStatus());
  }
}

// 运行示例
if (require.main === module) {
  runTransactionExample().catch(console.error);
}

export { runTransactionExample };
