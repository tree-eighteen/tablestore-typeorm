// examples/advanced-decorators-example.ts

import "reflect-metadata";
import { config } from "dotenv";
import { 
  Entity, 
  PrimaryColumn, 
  Column, 
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  DeleteDateColumn,
  DataSource, 
  DataSourceOptions 
} from "../src";

config();

// 定义用户实体 - 展示所有新装饰器的使用
@Entity("advanced_users", { 
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
export class AdvancedUser {
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

  // 创建时间 - 只在创建时设置
  @CreateDateColumn()
  createdAt: Date;

  // 更新时间 - 在创建和更新时都会设置
  @UpdateDateColumn()
  updatedAt: Date;

  // 版本控制 - 每次更新时自动递增
  @VersionColumn()
  version: number;

  // 软删除时间 - 支持逻辑删除
  @DeleteDateColumn()
  deletedAt: Date | null;

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

// 定义文章实体 - 展示不同类型的时间戳存储
@Entity("articles", { autoCreateTable: true })
export class Article {
  @PrimaryColumn()
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  content?: string;

  @Column()
  authorId: string;

  // 使用字符串类型存储创建时间
  @CreateDateColumn({ tablestoreType: 'STRING' })
  createdAt: string;

  // 使用数字类型存储更新时间戳
  @UpdateDateColumn({ tablestoreType: 'INTEGER' })
  updatedAt: number;

  // 版本控制，从0开始
  @VersionColumn({ initialValue: 0 })
  version: number;

  // 软删除，使用字符串类型
  @DeleteDateColumn({ tablestoreType: 'STRING' })
  deletedAt: string | null;

  @Column({ type: Boolean, default: false })
  isPublished: boolean;
}

// 配置数据源
const dataSourceOptions: DataSourceOptions = {
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.ALIYUN_ACCESS_KEY_SECRET || "",
  endpoint: process.env.TABLE_STORE_ENDPOINT || "",
  instancename: process.env.TABLE_STORE_INSTANCE_NAME || "",
  entities: [AdvancedUser, Article],
  synchronize: true,
  logging: true
};

// 创建数据源
const dataSource = new DataSource(dataSourceOptions);

async function runAdvancedExample() {
  try {
    // 初始化数据源
    await dataSource.initialize();
    console.log("数据源初始化成功");

    // 获取 Repository
    const userRepository = dataSource.getRepository(AdvancedUser);
    const articleRepository = dataSource.getRepository(Article);

    console.log("\n=== 测试自动时间戳和版本控制 ===");

    // 创建用户 - 测试 CreateDateColumn 和 UpdateDateColumn
    const user = userRepository.create({
      id: "user001",
      category: "premium",
      name: "张三",
      age: 25,
      email: "zhangsan@example.com",
      isActive: true,
      tags: ["developer", "typescript"],
      metadata: { level: "senior", department: "engineering" }
    });

    console.log("创建前的用户:", {
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      version: user.version,
      deletedAt: user.deletedAt
    });

    const savedUser = await userRepository.save(user);
    console.log("保存后的用户:", {
      createdAt: savedUser.createdAt,
      updatedAt: savedUser.updatedAt,
      version: savedUser.version,
      deletedAt: savedUser.deletedAt
    });

    // 等待一秒，然后更新用户 - 测试 UpdateDateColumn 和 VersionColumn
    await new Promise(resolve => setTimeout(resolve, 1000));

    await userRepository.update(
      { id: "user001", category: "premium" },
      { age: 26, email: "zhangsan.new@example.com" }
    );

    const updatedUser = await userRepository.findOne({
      id: "user001",
      category: "premium"
    });

    console.log("更新后的用户:", {
      createdAt: updatedUser?.createdAt,
      updatedAt: updatedUser?.updatedAt,
      version: updatedUser?.version,
      deletedAt: updatedUser?.deletedAt
    });

    console.log("\n=== 测试软删除功能 ===");

    // 检查软删除功能
    console.log("用户Repository是否支持软删除:", userRepository.hasSoftDelete());
    console.log("用户是否被软删除:", userRepository.isSoftDeleted(updatedUser!));

    // 执行软删除
    await userRepository.softDelete({ id: "user001", category: "premium" });
    console.log("执行软删除完成");

    // 查找软删除的用户
    const deletedUser = await userRepository.findOne({
      id: "user001",
      category: "premium"
    });

    if (deletedUser) {
      console.log("软删除后的用户:", {
        name: deletedUser.name,
        deletedAt: deletedUser.deletedAt,
        isSoftDeleted: userRepository.isSoftDeleted(deletedUser)
      });
    }

    // 恢复软删除的用户
    await userRepository.restore({ id: "user001", category: "premium" });
    console.log("恢复软删除完成");

    const restoredUser = await userRepository.findOne({
      id: "user001",
      category: "premium"
    });

    if (restoredUser) {
      console.log("恢复后的用户:", {
        name: restoredUser.name,
        deletedAt: restoredUser.deletedAt,
        isSoftDeleted: userRepository.isSoftDeleted(restoredUser)
      });
    }

    console.log("\n=== 测试不同类型的时间戳存储 ===");

    // 创建文章 - 测试不同类型的时间戳
    const article = articleRepository.create({
      id: "article001",
      title: "TypeScript 装饰器详解",
      content: "这是一篇关于 TypeScript 装饰器的文章...",
      authorId: "user001",
      isPublished: true
    });

    const savedArticle = await articleRepository.save(article);
    console.log("保存后的文章:", {
      createdAt: savedArticle.createdAt,
      updatedAt: savedArticle.updatedAt,
      version: savedArticle.version,
      deletedAt: savedArticle.deletedAt
    });

    // 更新文章
    await new Promise(resolve => setTimeout(resolve, 1000));
    await articleRepository.update(
      { id: "article001" },
      { title: "TypeScript 高级装饰器详解" }
    );

    const updatedArticle = await articleRepository.findOne({ id: "article001" });
    console.log("更新后的文章:", {
      title: updatedArticle?.title,
      createdAt: updatedArticle?.createdAt,
      updatedAt: updatedArticle?.updatedAt,
      version: updatedArticle?.version
    });

    console.log("\n=== 测试Repository功能检查 ===");
    console.log("用户Repository功能:");
    console.log("- 支持软删除:", userRepository.hasSoftDelete());
    console.log("- 支持版本控制:", userRepository.hasVersionControl());
    console.log("- 支持创建时间:", userRepository.hasCreateDate());
    console.log("- 支持更新时间:", userRepository.hasUpdateDate());

    console.log("\n文章Repository功能:");
    console.log("- 支持软删除:", articleRepository.hasSoftDelete());
    console.log("- 支持版本控制:", articleRepository.hasVersionControl());
    console.log("- 支持创建时间:", articleRepository.hasCreateDate());
    console.log("- 支持更新时间:", articleRepository.hasUpdateDate());

    // 清理测试数据
    console.log("\n=== 清理测试数据 ===");
    await userRepository.delete({ id: "user001", category: "premium" });
    await articleRepository.delete({ id: "article001" });
    console.log("测试数据清理完成");

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
  runAdvancedExample().catch(console.error);
}

export { runAdvancedExample };
