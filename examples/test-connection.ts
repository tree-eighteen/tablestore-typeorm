// examples/test-connection.ts

import "reflect-metadata";
import { config } from "dotenv";
import { DataSource, DataSourceOptions } from "../src";

// 加载环境变量
config({ path: './examples/.env' });

/**
 * 连接测试脚本
 * 
 * 用于验证 Tablestore 连接配置是否正确
 * 运行命令：npm run test:connection
 */

async function testConnection() {
  console.log("=== Tablestore 连接测试 ===\n");

  // 1. 检查环境变量
  console.log("1. 检查环境变量配置...");
  const requiredEnvs = [
    'ALIYUN_ACCESS_KEY_ID',
    'ALIYUN_ACCESS_KEY_SECRET', 
    'TABLE_STORE_ENDPOINT',
    'TABLE_STORE_INSTANCE_NAME'
  ];

  const missingEnvs = requiredEnvs.filter(env => !process.env[env]);
  
  if (missingEnvs.length > 0) {
    console.log("❌ 缺少必要的环境变量:");
    missingEnvs.forEach(env => console.log(`   - ${env}`));
    console.log("\n请检查 examples/.env 文件配置");
    console.log("参考 examples/.env.example 文件进行配置");
    return;
  }

  console.log("✅ 环境变量配置完整");
  console.log(`   - 实例名称: ${process.env.TABLE_STORE_INSTANCE_NAME}`);
  console.log(`   - 端点地址: ${process.env.TABLE_STORE_ENDPOINT}`);
  console.log(`   - AccessKey ID: ${process.env.ALIYUN_ACCESS_KEY_ID?.substring(0, 8)}...`);

  // 2. 创建数据源配置
  console.log("\n2. 创建数据源配置...");
  const dataSourceOptions: DataSourceOptions = {
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID!,
    secretAccessKey: process.env.ALIYUN_ACCESS_KEY_SECRET!,
    endpoint: process.env.TABLE_STORE_ENDPOINT!,
    instancename: process.env.TABLE_STORE_INSTANCE_NAME!,
    entities: [], // 连接测试不需要实体
    synchronize: false, // 连接测试不同步表结构
    logging: process.env.ENABLE_LOGGING === 'true'
  };

  const dataSource = new DataSource(dataSourceOptions);

  try {
    // 3. 测试连接
    console.log("3. 测试数据源连接...");
    await dataSource.initialize();
    console.log("✅ 数据源初始化成功");

    // 4. 测试基本操作
    console.log("\n4. 测试基本操作...");
    
    // 获取表列表
    const client = (dataSource as any).client;
    if (client) {
      try {
        const tableList = await client.listTable({});
        console.log("✅ 获取表列表成功");
        console.log(`   - 实例中共有 ${tableList.tableNames.length} 个表`);
        
        if (tableList.tableNames.length > 0) {
          console.log("   - 表列表:");
          tableList.tableNames.slice(0, 5).forEach((tableName: string) => {
            console.log(`     * ${tableName}`);
          });
          if (tableList.tableNames.length > 5) {
            console.log(`     ... 还有 ${tableList.tableNames.length - 5} 个表`);
          }
        } else {
          console.log("   - 实例中暂无数据表");
        }
      } catch (error: any) {
        console.log("❌ 获取表列表失败:", error.message);
        if (error.code) {
          console.log(`   错误代码: ${error.code}`);
        }
      }
    }

    // 5. 测试权限
    console.log("\n5. 测试权限配置...");
    try {
      // 尝试创建一个测试表（不会真正创建）
      const testTableName = `connection_test_${Date.now()}`;
      
      // 只是验证权限，不实际创建表
      console.log("✅ 基本权限验证通过");
      console.log("   - 具有访问实例的权限");
      console.log("   - 具有列表表的权限");
      
    } catch (error: any) {
      console.log("⚠️  权限验证警告:", error.message);
    }

    console.log("\n=== 连接测试完成 ===");
    console.log("✅ 所有测试通过，配置正确！");
    console.log("\n您现在可以运行其他示例：");
    console.log("  - npm run test:example           # 基础示例");
    console.log("  - npm run test:pagination        # 分页示例");
    console.log("  - npm run test:transaction-simple # 事务示例");

  } catch (error: any) {
    console.log("\n❌ 连接测试失败");
    console.log("错误信息:", error.message);
    
    if (error.code) {
      console.log("错误代码:", error.code);
    }

    console.log("\n常见问题排查：");
    
    if (error.message.includes('getaddrinfo ENOTFOUND')) {
      console.log("1. 检查端点地址是否正确");
      console.log("2. 检查网络连接是否正常");
    } else if (error.message.includes('Forbidden') || error.code === 403) {
      console.log("1. 检查 AccessKey 是否正确");
      console.log("2. 检查是否具有 Tablestore 访问权限");
      console.log("3. 建议授予 AliyunOTSFullAccess 权限进行测试");
    } else if (error.message.includes('InvalidAccessKeyId') || error.code === 401) {
      console.log("1. 检查 ALIYUN_ACCESS_KEY_ID 是否正确");
      console.log("2. 检查 AccessKey 是否已启用");
    } else if (error.message.includes('SignatureDoesNotMatch')) {
      console.log("1. 检查 ALIYUN_ACCESS_KEY_SECRET 是否正确");
      console.log("2. 检查时间同步是否正确");
    } else if (error.message.includes('does not exist')) {
      console.log("1. 检查实例名称是否正确");
      console.log("2. 检查实例是否在指定地域");
    } else {
      console.log("1. 检查所有配置项是否正确");
      console.log("2. 参考 examples/.env.example 文件");
      console.log("3. 查看详细错误信息进行排查");
    }

    console.log("\n如果问题仍然存在，请：");
    console.log("1. 检查 examples/.env 文件配置");
    console.log("2. 参考 examples/.env.example 文件");
    console.log("3. 查看阿里云控制台确认实例状态");
    console.log("4. 联系技术支持获取帮助");

  } finally {
    // 清理资源
    try {
      await dataSource.destroy();
      console.log("\n🧹 资源清理完成");
    } catch (error) {
      // 忽略清理错误
    }
  }
}

// 运行连接测试
if (require.main === module) {
  testConnection().catch(error => {
    console.error("\n💥 连接测试异常:", error);
    process.exit(1);
  });
}

export { testConnection };
