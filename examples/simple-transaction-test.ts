// examples/simple-transaction-test.ts

import "reflect-metadata";
import { config } from "dotenv";
import {
  Entity,
  PrimaryColumn,
  Column,
  DataSource,
  DataSourceOptions,
} from "../src";

config();

// 简单的测试实体
@Entity("simple_transaction_test", {
  autoCreateTable: true,
  tableOptions: {
    timeToLive: -1,
    maxVersions: 1,
  },
})
export class TestEntity {
  @PrimaryColumn({ tablestoreType: "STRING" })
  partitionKey: string;

  @PrimaryColumn({ tablestoreType: "STRING" })
  id: string;

  @Column()
  value: string;

  @Column({ type: Number, default: 0 })
  counter: number;
}

// 配置数据源
const dataSourceOptions: DataSourceOptions = {
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.ALIYUN_ACCESS_KEY_SECRET || "",
  endpoint: process.env.TABLE_STORE_ENDPOINT || "",
  instancename: process.env.TABLE_STORE_INSTANCE_NAME || "",
  entities: [TestEntity],
  synchronize: true,
  logging: true,
};

const dataSource = new DataSource(dataSourceOptions);

async function checkTransactionSupport(partitionKey: string): Promise<boolean> {
  try {
    // 尝试创建一个局部事务来检查是否支持
    const transaction = await dataSource.startTransaction("simple_transaction_test", { partitionKey });

    // 如果成功创建，立即回滚
    await transaction.rollback();
    return true;
  } catch (error: any) {
    if (error.message && error.message.includes('explicit-transaction-disabled')) {
      return false;
    }
    // 其他错误也认为不支持
    console.log("检查事务支持时出错:", error.message);
    return false;
  }
}

async function runSimpleTransactionTest() {
  try {
    // 初始化数据源
    await dataSource.initialize();
    console.log("数据源初始化成功");

    const partitionKey = "test_partition";

    // 首先检查表是否支持局部事务
    console.log("\n=== 检查表是否支持局部事务 ===");
    const isTransactionSupported = await checkTransactionSupport(partitionKey);

    if (!isTransactionSupported) {
      console.log("❌ 表不支持局部事务功能");
      console.log("\n解决方案：");
      console.log("1. 在阿里云控制台手动为表开启局部事务功能：");
      console.log("   - 登录表格存储控制台");
      console.log("   - 找到表 'simple_transaction_test'");
      console.log("   - 修改表属性，开启'是否开启局部事务'开关");
      console.log("2. 或者联系阿里云技术支持开通此功能");
      console.log("3. 注意：Node.js SDK 目前不支持在创建表时直接开启局部事务");

      console.log("\n继续测试模拟事务功能...");
      await testSimulatedTransaction(partitionKey);
      return;
    }

    console.log("✅ 表支持局部事务功能");

    // 测试 1: 基本事务操作
    console.log("\n=== 测试 1: 基本事务操作 ===");
    await testBasicTransaction(partitionKey);

    // 测试 2: 事务回滚
    console.log("\n=== 测试 2: 事务回滚 ===");
    await testTransactionRollback(partitionKey);

    // 测试 3: 自动事务管理
    console.log("\n=== 测试 3: 自动事务管理 ===");
    await testAutoTransaction(partitionKey);

    console.log("\n=== 所有测试完成 ===");

  } catch (error) {
    console.error("测试执行失败:", error);
  } finally {
    await dataSource.destroy();
    console.log("数据源已销毁");
  }
}

async function testBasicTransaction(partitionKey: string) {
  const transaction = await dataSource.startTransaction("simple_transaction_test", { partitionKey });

  try {
    console.log(`事务开始，ID: ${transaction.getTransactionId()}`);

    // 创建测试实体
    const entity1 = new TestEntity();
    entity1.partitionKey = partitionKey;
    entity1.id = "entity1";
    entity1.value = "test value 1";
    entity1.counter = 10;

    const entity2 = new TestEntity();
    entity2.partitionKey = partitionKey;
    entity2.id = "entity2";
    entity2.value = "test value 2";
    entity2.counter = 20;

    // 在事务中保存
    await transaction.save(entity1);
    await transaction.save(entity2);

    // 更新第一个实体
    await transaction.update(TestEntity, 
      { partitionKey, id: "entity1" }, 
      { counter: 15 }
    );

    // 提交事务
    await transaction.commit();
    console.log("事务提交成功");

    // 验证数据
    const repository = dataSource.getRepository(TestEntity);
    const savedEntity1 = await repository.findOne({ partitionKey, id: "entity1" });
    const savedEntity2 = await repository.findOne({ partitionKey, id: "entity2" });

    console.log("保存的实体1:", savedEntity1);
    console.log("保存的实体2:", savedEntity2);

  } catch (error) {
    console.error("基本事务测试失败:", error);
    await transaction.rollback();
  }
}

async function testTransactionRollback(partitionKey: string) {
  const transaction = await dataSource.startTransaction("simple_transaction_test", { partitionKey });

  try {
    console.log(`回滚测试事务开始，ID: ${transaction.getTransactionId()}`);

    // 创建测试实体
    const entity = new TestEntity();
    entity.partitionKey = partitionKey;
    entity.id = "rollback_test";
    entity.value = "should be rolled back";
    entity.counter = 999;

    await transaction.save(entity);

    // 模拟错误
    throw new Error("模拟的错误，触发回滚");

  } catch (error) {
    console.log("捕获到错误:", (error as any).message);
    await transaction.rollback();
    console.log("事务已回滚");

    // 验证数据没有被保存
    const repository = dataSource.getRepository(TestEntity);
    const entity = await repository.findOne({ partitionKey, id: "rollback_test" });
    
    if (entity === null) {
      console.log("✓ 回滚成功，数据没有被保存");
    } else {
      console.log("✗ 回滚失败，数据被意外保存了");
    }
  }
}

async function testAutoTransaction(partitionKey: string) {
  try {
    const result = await dataSource.runInTransaction(
      "simple_transaction_test",
      { partitionKey },
      async (transaction) => {
        console.log(`自动事务开始，ID: ${transaction.getTransactionId()}`);

        // 查找现有实体
        const entity = await transaction.findOne(TestEntity, { partitionKey, id: "entity1" });
        if (!entity) {
          throw new Error("找不到实体");
        }

        console.log("找到实体:", entity);

        // 更新计数器
        await transaction.update(TestEntity,
          { partitionKey, id: "entity1" },
          { counter: entity.counter + 5 }
        );

        return "自动事务执行成功";
      }
    );

    console.log("自动事务结果:", result);

    // 验证更新
    const repository = dataSource.getRepository(TestEntity);
    const updatedEntity = await repository.findOne({ partitionKey, id: "entity1" });
    console.log("更新后的实体:", updatedEntity);

  } catch (error) {
    console.error("自动事务测试失败:", error);
  }
}

async function testSimulatedTransaction(partitionKey: string) {
  console.log("\n=== 模拟事务功能测试 ===");
  console.log("注意：这不是真正的事务，只是演示如何使用条件更新来模拟事务行为");

  const repository = dataSource.getRepository(TestEntity);

  try {
    // 创建测试数据
    const entity = repository.create({
      partitionKey,
      id: "simulated_tx_test",
      value: "initial value",
      counter: 100
    });

    await repository.save(entity);
    console.log("✓ 创建测试数据成功");

    // 模拟事务：条件更新
    const currentEntity = await repository.findOne({ partitionKey, id: "simulated_tx_test" });
    if (!currentEntity) {
      throw new Error("找不到测试数据");
    }

    console.log("当前数据:", currentEntity);

    // 使用条件更新模拟事务行为
    try {
      await repository.update(
        { partitionKey, id: "simulated_tx_test" },
        { counter: currentEntity.counter + 10, value: "updated by simulated transaction" }
      );
      console.log("✓ 条件更新成功");

      // 验证更新结果
      const updatedEntity = await repository.findOne({ partitionKey, id: "simulated_tx_test" });
      console.log("更新后数据:", updatedEntity);

    } catch (error) {
      console.log("❌ 条件更新失败:", error);
    }

  } catch (error) {
    console.error("模拟事务测试失败:", error);
  }
}

// 运行测试
if (require.main === module) {
  runSimpleTransactionTest().catch(console.error);
}

export { runSimpleTransactionTest };
