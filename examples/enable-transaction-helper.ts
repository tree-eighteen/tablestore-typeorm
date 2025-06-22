// examples/enable-transaction-helper.ts

import "reflect-metadata";
import { config } from "dotenv";
import Tablestore from "aliyun-tablestore-nodejs-sdk";

config();

/**
 * 辅助脚本：尝试为表启用局部事务功能
 * 
 * 注意：根据阿里云文档，局部事务功能可能需要：
 * 1. 在创建表时指定特殊参数
 * 2. 通过控制台启用
 * 3. 联系技术支持开通
 */

const client = new Tablestore.Client({
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.ALIYUN_ACCESS_KEY_SECRET || "",
  endpoint: process.env.TABLE_STORE_ENDPOINT || "",
  instancename: process.env.TABLE_STORE_INSTANCE_NAME || "",
});

async function enableTransactionForTable() {
  const tableName = "simple_transaction_test";
  
  try {
    console.log("=== 检查表信息 ===");
    
    // 1. 检查表是否存在
    let tableExists = false;
    try {
      const tableInfo = await client.describeTable({ tableName });
      console.log("表已存在:", tableInfo.tableMeta.tableName);
      console.log("表选项:", tableInfo.tableOptions);
      tableExists = true;
    } catch (error: any) {
      if (error.code === 404 || error.message.includes('does not exist')) {
        console.log("表不存在，将创建新表");
        await createTableWithTransaction(tableName);
        return;
      }
      throw error;
    }

    // 2. 尝试测试局部事务
    console.log("\n=== 测试局部事务支持 ===");
    const testResult = await testTransactionSupport(tableName);
    
    if (testResult) {
      console.log("✅ 表已支持局部事务功能");
    } else {
      console.log("❌ 表不支持局部事务功能");
      console.log("\n可能的解决方案:");
      console.log("1. 删除现有表并重新创建（会丢失数据）");
      console.log("2. 在阿里云控制台为表启用局部事务功能");
      console.log("3. 联系阿里云技术支持开通局部事务功能");
      
      // 询问是否重新创建表
      console.log("\n是否要删除现有表并重新创建？(这会丢失所有数据)");
      console.log("如果要继续，请手动删除表后重新运行此脚本");
    }

  } catch (error) {
    console.error("操作失败:", error);
  }
}

async function createTableWithTransaction(tableName: string) {
  try {
    console.log(`创建支持局部事务的表: ${tableName}`);
    
    // 尝试创建表，包含可能的局部事务参数
    const params = {
      tableMeta: {
        tableName,
        primaryKey: [
          {
            name: 'partitionKey',
            type: Tablestore.PrimaryKeyType.STRING
          },
          {
            name: 'id',
            type: Tablestore.PrimaryKeyType.STRING
          }
        ]
      },
      reservedThroughput: {
        capacityUnit: {
          read: 0,
          write: 0
        }
      },
      tableOptions: {
        timeToLive: -1,
        maxVersions: 1,
        // 尝试添加可能的局部事务参数
        // 注意：这些参数可能不被当前 SDK 版本支持
        deviationCellVersionInSec: 86400
      }
    };

    await client.createTable(params);
    console.log("✅ 表创建成功");

    // 等待表变为活跃状态
    console.log("等待表变为活跃状态...");
    await waitForTableActive(tableName);

    // 测试局部事务支持
    const isSupported = await testTransactionSupport(tableName);
    if (isSupported) {
      console.log("✅ 表支持局部事务功能");
    } else {
      console.log("❌ 新创建的表仍不支持局部事务功能");
      console.log("可能需要联系阿里云技术支持开通此功能");
    }

  } catch (error) {
    console.error("创建表失败:", error);
  }
}

async function waitForTableActive(tableName: string, maxWaitTime = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const tableInfo = await client.describeTable({ tableName });
      console.log("表状态检查完成");
      return;
    } catch (error: any) {
      if (error.code === 'OTSObjectNotExist') {
        console.log("等待表创建...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      throw error;
    }
  }
  
  throw new Error("等待表变为活跃状态超时");
}

async function testTransactionSupport(tableName: string): Promise<boolean> {
  try {
    console.log("测试局部事务支持...");
    
    // 尝试创建局部事务
    const result = await client.startLocalTransaction({
      tableName,
      primaryKey: [{ partitionKey: 'test' }]
    });
    
    console.log("✅ 成功创建局部事务:", result.transactionId);
    
    // 立即回滚事务
    await client.abortTransaction({ transactionId: result.transactionId });
    console.log("✅ 成功回滚事务");
    
    return true;
  } catch (error: any) {
    console.log("❌ 局部事务测试失败:", error.message);
    
    if (error.message && error.message.includes('explicit-transaction-disabled')) {
      console.log("错误原因: 表未启用局部事务功能");
    }
    
    return false;
  }
}

async function deleteTable(tableName: string) {
  try {
    console.log(`删除表: ${tableName}`);
    await client.deleteTable({ tableName });
    console.log("✅ 表删除成功");
  } catch (error: any) {
    if (error.code === 'OTSObjectNotExist') {
      console.log("表不存在，无需删除");
    } else {
      console.error("删除表失败:", error);
    }
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'enable':
        await enableTransactionForTable();
        break;
      case 'delete':
        await deleteTable("simple_transaction_test");
        break;
      case 'test':
        await testTransactionSupport("simple_transaction_test");
        break;
      default:
        console.log("用法:");
        console.log("  npm run build && node dist/examples/enable-transaction-helper.js enable  # 启用事务功能");
        console.log("  npm run build && node dist/examples/enable-transaction-helper.js delete  # 删除测试表");
        console.log("  npm run build && node dist/examples/enable-transaction-helper.js test    # 测试事务支持");
    }
  } catch (error) {
    console.error("执行失败:", error);
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

export { enableTransactionForTable, testTransactionSupport, createTableWithTransaction };
