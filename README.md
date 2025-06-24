# Tablestore TypeORM SDK

[![npm version](https://badge.fury.io/js/tablestore-typeorm.svg)](https://badge.fury.io/js/tablestore-typeorm)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)

一个基于 TypeORM 风格的阿里云 Tablestore 数据库 SDK，提供类似 TypeORM 的装饰器、Repository 模式和查询构建器，让您能够以熟悉的方式操作 Tablestore 数据库。

> **注意**: 这是一个为阿里云 Tablestore 设计的 TypeORM 风格的 SDK，不是官方的 TypeORM 适配器。它提供了相似的 API 体验，但专门针对 Tablestore 的特性进行了优化。

## 目录

- [特性](#特性)
- [安装](#安装)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [装饰器详解](#装饰器详解)
- [查询操作](#查询操作)
- [分页查询](#分页查询)
- [过滤器详解](#过滤器详解)
- [数据类型支持](#数据类型支持)
- [事务操作](#事务操作)
- [软删除](#软删除)
- [版本控制](#版本控制)
- [错误处理](#错误处理)
- [性能优化建议](#性能优化建议)
- [配置选项](#配置选项)
- [完整示例](#完整示例)
- [迁移指南](#迁移指南)
- [常见问题](#常见问题)
- [API 参考](#api-参考)
- [许可证](#许可证)
- [贡献](#贡献)
- [更新日志](#更新日志)

## 特性

- 🎯 **TypeORM 风格的 API** - 熟悉的装饰器和 Repository 模式
- 🚀 **自动表管理** - 自动创建和同步表结构
- 📝 **丰富的装饰器** - 支持实体、列、主键、时间戳等装饰器
- 🔍 **强大的查询功能** - 支持主键查询、范围查询、过滤查询
- 📄 **游标分页** - 高效的分页查询支持
- 🛡️ **TypeScript 支持** - 完整的类型安全
- ⚡ **高性能** - 基于阿里云 Tablestore 原生 SDK

## 安装

```bash
npm install tablestore-typeorm
```

## 环境要求

- Node.js >= 16.0.0
- TypeScript >= 4.0.0

## 快速开始

### 1. 环境配置

创建 `.env` 文件：

```env
ALIYUN_ACCESS_KEY_ID=your_access_key_id
ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret
TABLE_STORE_ENDPOINT=https://your-instance.region.tablestore.aliyuncs.com
TABLE_STORE_INSTANCE_NAME=your-instance-name
```

### 2. 定义实体

```typescript
import "reflect-metadata";
import { 
  Entity, 
  PrimaryColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn 
} from "tablestore-typeorm";

@Entity("users", {
  autoCreateTable: true,
  tableOptions: {
    timeToLive: -1,
    maxVersions: 1
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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### 3. 配置数据源

```typescript
import { DataSource, DataSourceOptions } from "tablestore-typeorm";

const dataSourceOptions: DataSourceOptions = {
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
  secretAccessKey: process.env.ALIYUN_ACCESS_KEY_SECRET,
  endpoint: process.env.TABLE_STORE_ENDPOINT,
  instancename: process.env.TABLE_STORE_INSTANCE_NAME,
  maxRetries: process.env.TABLESTORE_MAX_RETRIES, // 重试次数
  entities: [User],
  synchronize: true, // 自动同步表结构
  logging: true
};

const dataSource = new DataSource(dataSourceOptions);
```

### 4. 基本操作

```typescript
async function example() {
  // 初始化数据源
  await dataSource.initialize();

  // 获取 Repository
  const userRepository = dataSource.getRepository(User);

  // 创建用户
  const user = userRepository.create({
    id: "user001",
    category: "premium",
    name: "张三",
    age: 25,
    email: "zhangsan@example.com"
  });

  // 保存用户
  await userRepository.save(user);

  // 查找用户
  const foundUser = await userRepository.findOne({
    id: "user001",
    category: "premium"
  });

  // 更新用户
  await userRepository.update(
    { id: "user001", category: "premium" },
    { age: 26 }
  );

  // 删除用户
  await userRepository.delete({ id: "user001", category: "premium" });
}
```

## 装饰器详解

### @Entity

定义实体类和对应的 Tablestore 表：

```typescript
@Entity("table_name", {
  autoCreateTable: true,           // 自动创建表
  tableOptions: {
    timeToLive: -1,               // 数据生存时间（秒），-1 表示永不过期
    maxVersions: 1                // 最大版本数
  },
  reservedThroughput: {
    read: 0,                      // 预留读吞吐量
    write: 0                      // 预留写吞吐量
  }
})
export class MyEntity {
  // ...
}
```

### @PrimaryColumn

定义主键列：

```typescript
@PrimaryColumn({ tablestoreType: 'STRING' })
id: string;

@PrimaryColumn({ tablestoreType: 'INTEGER' })
timestamp: number;
```

### @Column

定义普通列：

```typescript
@Column()
name: string;

@Column({ type: Number, default: 0 })
age: number;

@Column({ nullable: true })
email?: string;

@Column({ 
  type: Date,
  transformer: {
    to: (value: Date) => value.getTime(),
    from: (value: number) => new Date(value)
  }
})
createdAt: Date;
```

### 时间戳装饰器

```typescript
@CreateDateColumn()  // 创建时自动设置
createdAt: Date;

@UpdateDateColumn()  // 更新时自动设置
updatedAt: Date;

@DeleteDateColumn()  // 软删除时设置
deletedAt?: Date;

@VersionColumn()     // 版本控制
version: number;
```

## 查询操作

### Repository 基本查询

```typescript
const repository = dataSource.getRepository(User);

// 根据主键查找
const user = await repository.findOne({ id: "123", category: "premium" });

// 查找多个
const users = await repository.find({ 
  where: { category: "premium" },  // 仅支持主键字段
  take: 10 
});

// 根据条件查找
const activeUsers = await repository.findBy({ isActive: true }); // 注意：仅主键字段有效

// 统计数量
const count = await repository.count({ category: "premium" });
```

### QueryBuilder 高级查询

QueryBuilder 提供了更强大的查询功能，支持 `where`（主键查询）和 `filter`（任意字段查询）：

```typescript
const queryBuilder = repository.createQueryBuilder("user");

// 主键查询（高效）
const result1 = await queryBuilder
  .where({ id: "123", category: "premium" })
  .getOne();

// 非主键字段查询（使用 filter）
const result2 = await queryBuilder
  .filter(f => f.equals('name', 'John'))
  .getMany();

// 范围查询
const result3 = await queryBuilder
  .filter(f => f.and(
    f.greaterThan('age', 18),
    f.lessThan('age', 65)
  ))
  .getMany();

// 复杂条件查询
const result4 = await queryBuilder
  .filter(f => f.and(
    f.equals('isActive', true),
    f.or(
      f.equals('category', 'premium'),
      f.greaterThan('age', 30)
    )
  ))
  .limit(10)
  .getMany();
```

### WHERE vs FILTER

- **WHERE**: 仅适用于主键字段，支持精确匹配和部分主键查询，性能高效
- **FILTER**: 适用于任何字段，支持复杂条件和逻辑组合，功能强大

```typescript
// ✅ WHERE - 主键查询（推荐）
.where({ id: "123", category: "premium" })

// ❌ WHERE - 非主键字段无效
.where({ name: "John" })  // 不会生效

// ✅ FILTER - 任意字段查询
.filter(f => f.equals('name', 'John'))

// ✅ 组合使用
.where({ category: "premium" })      // 主键范围
.filter(f => f.equals('isActive', true))  // 非主键过滤
```

## 分页查询

支持高效的游标分页：

```typescript
// 基础分页
const result = await repository.page({
  limit: 10,
  order: "ASC"  // 或 "DESC"
});

// 获取下一页
const nextPage = await repository.page({
  limit: 10,
  cursor: result.nextCursor,
  order: "ASC"
});

// 带条件的分页
const filteredPage = await repository.page({
  limit: 10,
  where: { category: "premium" },           // 主键条件
  filter: f => f.equals('isActive', true),  // 非主键条件
  order: "ASC"
});

console.log(filteredPage.items);     // 当前页数据
console.log(filteredPage.hasNext);   // 是否有下一页
console.log(filteredPage.nextCursor); // 下一页游标
```

## 过滤器详解

FilterFactory 提供了丰富的查询条件构建方法：
注意，他的作用是在本地过滤的，如果范围查询不到就无法过滤，建议还是二级索引。

### 比较操作

```typescript
// 等于
.filter(f => f.equals('name', 'John'))

// 不等于
.filter(f => f.notEqual('status', 'deleted'))

// 大于
.filter(f => f.greaterThan('age', 18))

// 大于等于
.filter(f => f.greaterThanOrEqual('score', 60))

// 小于
.filter(f => f.lessThan('price', 100))

// 小于等于
.filter(f => f.lessThanOrEqual('discount', 0.5))
```

### 逻辑操作

```typescript
// AND 操作
.filter(f => f.and(
  f.greaterThan('age', 18),
  f.equals('isActive', true)
))

// OR 操作
.filter(f => f.or(
  f.equals('category', 'premium'),
  f.greaterThan('score', 90)
))

// NOT 操作
.filter(f => f.not(f.equals('status', 'banned')))

// 复杂组合
.filter(f => f.and(
  f.greaterThan('age', 18),
  f.or(
    f.equals('city', '北京'),
    f.equals('city', '上海')
  ),
  f.not(f.equals('status', 'inactive'))
))
```

## 数据类型支持

### 基础类型

```typescript
@Column()
name: string;                    // 字符串

@Column({ type: Number })
age: number;                     // 数字

@Column({ type: Boolean })
isActive: boolean;               // 布尔值

@Column({ type: Date })
createdAt: Date;                 // 日期
```

### 复杂类型

```typescript
@Column({ type: Array })
tags: string[];                  // 数组

@Column({
  type: Object,
  transformer: {
    to: (value: any) => JSON.stringify(value),
    from: (value: string) => JSON.parse(value)
  }
})
metadata: Record<string, any>;   // 对象

@Column({
  type: Buffer,
  transformer: {
    to: (value: Buffer) => value.toString('base64'),
    from: (value: string) => Buffer.from(value, 'base64')
  }
})
data: Buffer;                    // 二进制数据
```

## 事务操作

本 SDK 基于 Tablestore 的局部事务功能提供 ACID 事务支持。

### 前提条件

**重要**：使用事务功能前，必须为数据表启用局部事务功能：

1. **通过控制台启用**（推荐）：
   - 登录 [表格存储控制台](https://otsnext.console.aliyun.com/)
   - 找到目标数据表，点击"修改表属性"
   - 开启"是否开启局部事务"开关

2. **创建表时启用**：
   - 在控制台创建表时，在高级设置中开启局部事务
   - 注意：Node.js SDK 目前不支持在创建表时直接开启局部事务

3. **联系技术支持**：
   - 如果无法通过控制台启用，请[提交工单](https://smartservice.console.aliyun.com/service/create-ticket)申请

详细说明请参考：[如何启用局部事务功能](docs/ENABLE_TRANSACTION.md)

### 事务限制

- **分区键限制**：事务范围限制在单个分区键值内
- **生命周期**：事务最长生命周期为 60 秒
- **数据量限制**：每个事务写入数据量最大 4MB
- **一致性**：同一事务中所有写操作的分区键值必须相同

### 手动事务管理

```typescript
// 开始事务
const transaction = await dataSource.startTransaction('users', { userId: '123' });

try {
  // 在事务中查找用户
  const user = await transaction.findOne(User, { userId: '123', id: 'profile' });

  // 检查业务逻辑
  if (user.balance < 100) {
    throw new Error('余额不足');
  }

  // 更新用户余额
  await transaction.update(User,
    { userId: '123', id: 'profile' },
    { balance: user.balance - 100 }
  );

  // 创建订单
  const order = new Order();
  order.userId = '123';
  order.orderId = 'order_001';
  order.amount = 100;
  await transaction.save(order);

  // 提交事务
  await transaction.commit();
  console.log('事务提交成功');

} catch (error) {
  // 回滚事务
  await transaction.rollback();
  console.log('事务已回滚');
}
```

### 自动事务管理

```typescript
// 使用自动事务管理（推荐）
const result = await dataSource.runInTransaction(
  'users',
  { userId: '123' },
  async (transaction) => {
    // 查找用户
    const user = await transaction.findOne(User, { userId: '123', id: 'profile' });

    // 业务逻辑
    if (user.balance < 100) {
      throw new Error('余额不足');
    }

    // 更新余额
    await transaction.update(User,
      { userId: '123', id: 'profile' },
      { balance: user.balance - 100 }
    );

    // 创建订单
    const order = new Order();
    order.userId = '123';
    order.orderId = 'order_001';
    order.amount = 100;
    await transaction.save(order);

    return '交易成功';
  }
);

console.log('交易结果:', result);
```

### 事务状态监控

```typescript
const transaction = await dataSource.startTransaction('users', { userId: '123' });

// 检查事务状态
console.log('事务ID:', transaction.getTransactionId());
console.log('事务状态:', transaction.getStatus()); // ACTIVE, COMMITTED, ABORTED, TIMEOUT
console.log('是否活跃:', transaction.isActive());

// 事务操作...

await transaction.commit();
console.log('最终状态:', transaction.getStatus()); // COMMITTED
```

### 批量操作

```typescript
const transaction = await dataSource.startTransaction('users', { userId: '123' });

try {
  // 批量写入操作
  const operations = [
    {
      tableName: 'users',
      request: {
        type: 'PUT',
        primaryKey: [{ userId: '123' }, { id: 'profile1' }],
        attributeColumns: [{ name: 'John' }]
      }
    },
    {
      tableName: 'users',
      request: {
        type: 'PUT',
        primaryKey: [{ userId: '123' }, { id: 'profile2' }],
        attributeColumns: [{ name: 'Jane' }]
      }
    }
  ];

  await transaction.batchWrite(operations);
  await transaction.commit();

} catch (error) {
  await transaction.rollback();
}
```

### 事务超时处理

```typescript
// 设置事务超时时间
const transaction = await dataSource.startTransaction(
  'users',
  { userId: '123' },
  { timeout: 30000 } // 30秒超时
);

// 检查事务是否超时
if (!transaction.isActive()) {
  console.log('事务已超时或结束');
  return;
}

// 执行事务操作...
```

## 软删除

```typescript
@Entity("users")
export class User {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @DeleteDateColumn()
  deletedAt?: Date;
}

// 软删除操作
await repository.softDelete({ id: "123" });

// 查找包含软删除的记录
const allUsers = await repository.findWithDeleted();

// 只查找软删除的记录
const deletedUsers = await repository.findDeleted();

// 恢复软删除的记录
await repository.restore({ id: "123" });
```

## 版本控制

```typescript
@Entity("documents")
export class Document {
  @PrimaryColumn()
  id: string;

  @Column()
  content: string;

  @VersionColumn()
  version: number;
}

// 版本控制会自动处理并发更新
const doc = await repository.findOne({ id: "doc1" });
doc.content = "新内容";
await repository.save(doc); // 版本号自动递增
```

## 错误处理

```typescript
try {
  await repository.save(user);
} catch (error) {
  if (error.code === 'OTSConditionCheckFail') {
    console.log('条件检查失败');
  } else if (error.code === 'OTSObjectNotExist') {
    console.log('记录不存在');
  } else {
    console.error('其他错误:', error);
  }
}
```

## 性能优化建议

### 1. 主键设计

```typescript
// ✅ 好的主键设计
@Entity("user_posts")
export class UserPost {
  @PrimaryColumn()
  userId: string;      // 第一主键：用户ID

  @PrimaryColumn()
  timestamp: number;   // 第二主键：时间戳

  @PrimaryColumn()
  postId: string;      // 第三主键：帖子ID
}

// 支持高效的范围查询：
// - 查询某用户的所有帖子
// - 查询某用户某时间段的帖子
```

### 2. 查询优化

```typescript
// ✅ 高效：使用主键查询
const user = await repository.findOne({ id: "123", category: "premium" });

// ✅ 高效：主键范围查询
const users = await repository.find({ where: { category: "premium" } });

// ⚠️ 较慢：非主键字段过滤（但有时必需）
const activeUsers = await repository.createQueryBuilder()
  .filter(f => f.equals('isActive', true))
  .getMany();

// ✅ 最佳：组合使用
const result = await repository.createQueryBuilder()
  .where({ category: "premium" })           // 主键范围
  .filter(f => f.equals('isActive', true))  // 非主键过滤
  .getMany();
```

### 3. 分页优化

```typescript
// ✅ 使用游标分页，避免 skip/offset
const page1 = await repository.page({ limit: 20 });
const page2 = await repository.page({
  limit: 20,
  cursor: page1.nextCursor
});

// ❌ 避免大量数据的一次性查询
// const allUsers = await repository.find(); // 可能很慢
```

## 配置选项

### DataSource 配置

```typescript
const dataSourceOptions: DataSourceOptions = {
  // 阿里云认证
  accessKeyId: "your_access_key_id",
  secretAccessKey: "your_access_key_secret",
  endpoint: "https://instance.region.tablestore.aliyuncs.com",
  instancename: "your_instance_name",

  // 实体配置
  entities: [User, Product],

  // 开发选项
  synchronize: true,    // 自动同步表结构（生产环境建议关闭）
  logging: true,        // 启用日志

  // 连接选项
  maxRetries: 3,        // 最大重试次数
  timeout: 30000        // 超时时间（毫秒）
};
```

### 表配置选项

```typescript
@Entity("table_name", {
  autoCreateTable: true,
  tableOptions: {
    timeToLive: 86400,        // 24小时后过期
    maxVersions: 3,           // 保留3个版本
    deviationCellVersionInSec: 86400
  },
  reservedThroughput: {
    read: 100,               // 预留读吞吐量
    write: 100               // 预留写吞吐量
  }
})
```

## 完整示例

### 电商系统示例

```typescript
import "reflect-metadata";
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DataSource
} from "tablestore-typeorm";

// 用户实体
@Entity("users", { autoCreateTable: true })
export class User {
  @PrimaryColumn()
  id: string;

  @Column()
  username: string;

  @Column()
  email: string;

  @Column({ type: Number, default: 0 })
  balance: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// 订单实体
@Entity("orders", { autoCreateTable: true })
export class Order {
  @PrimaryColumn()
  userId: string;

  @PrimaryColumn()
  orderId: string;

  @Column({ type: Number })
  amount: number;

  @Column()
  status: string; // 'pending', 'paid', 'shipped', 'completed'

  @Column({ type: Array })
  items: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// 业务逻辑
class ECommerceService {
  constructor(
    private userRepository: Repository<User>,
    private orderRepository: Repository<Order>
  ) {}

  // 创建用户
  async createUser(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    return await this.userRepository.save(user);
  }

  // 创建订单
  async createOrder(userId: string, orderData: Partial<Order>): Promise<Order> {
    const order = this.orderRepository.create({
      ...orderData,
      userId,
      orderId: `order_${Date.now()}`,
      status: 'pending'
    });
    return await this.orderRepository.save(order);
  }

  // 获取用户订单（分页）
  async getUserOrders(userId: string, limit: number = 10, cursor?: string) {
    return await this.orderRepository.page({
      limit,
      cursor,
      where: { userId },
      order: "DESC" // 最新订单在前
    });
  }

  // 查询活跃订单
  async getActiveOrders(limit: number = 20) {
    return await this.orderRepository.createQueryBuilder()
      .filter(f => f.or(
        f.equals('status', 'pending'),
        f.equals('status', 'paid'),
        f.equals('status', 'shipped')
      ))
      .limit(limit)
      .getMany();
  }

  // 统计用户订单金额
  async getUserOrderStats(userId: string) {
    const orders = await this.orderRepository.find({
      where: { userId }
    });

    const totalAmount = orders.reduce((sum, order) => sum + order.amount, 0);
    const orderCount = orders.length;

    return { totalAmount, orderCount };
  }
}
```

## 迁移指南

### 从原生 Tablestore SDK 迁移

```typescript
// 原生 SDK 方式
const client = new Tablestore.Client({
  accessKeyId: 'xxx',
  secretAccessKey: 'xxx',
  endpoint: 'xxx',
  instancename: 'xxx'
});

const params = {
  tableName: 'users',
  primaryKey: [
    { id: 'user123' },
    { category: 'premium' }
  ]
};

client.getRow(params, (err, data) => {
  // 处理结果
});

// 使用本 SDK
const dataSource = new DataSource(options);
await dataSource.initialize();

const userRepository = dataSource.getRepository(User);
const user = await userRepository.findOne({
  id: 'user123',
  category: 'premium'
});
```

### 从其他 ORM 迁移

```typescript
// TypeORM 风格（本 SDK 支持）
const user = await userRepository.findOne({ where: { id: '123' } });
const users = await userRepository.find({ take: 10 });

// Sequelize 风格 -> 本 SDK 等价写法
// User.findAll({ where: { age: { [Op.gt]: 18 } } })
const users = await userRepository.createQueryBuilder()
  .filter(f => f.greaterThan('age', 18))
  .getMany();

// Mongoose 风格 -> 本 SDK 等价写法
// User.find({ isActive: true }).limit(10)
const users = await userRepository.createQueryBuilder()
  .filter(f => f.equals('isActive', true))
  .limit(10)
  .getMany();
```

## 常见问题

### Q: 为什么我的 where 条件不生效？

A: `where` 条件只能用于主键字段。对于非主键字段，请使用 `filter`：

```typescript
// ❌ 错误：name 不是主键
await repository.find({ where: { name: 'John' } });

// ✅ 正确：使用 filter
await repository.createQueryBuilder()
  .filter(f => f.equals('name', 'John'))
  .getMany();
```

### Q: 如何实现复杂的查询条件？

A: 使用 FilterFactory 的逻辑组合方法：

```typescript
await repository.createQueryBuilder()
  .filter(f => f.and(
    f.greaterThan('age', 18),
    f.or(
      f.equals('city', '北京'),
      f.equals('city', '上海')
    ),
    f.not(f.equals('status', 'banned'))
  ))
  .getMany();
```

### Q: 如何优化查询性能？

A:
1. 优先使用主键查询
2. 合理设计主键结构
3. 使用游标分页而非偏移分页
4. 组合使用 where 和 filter

### Q: 支持事务吗？

A: 支持！本 SDK 基于 Tablestore 的局部事务功能提供完整的 ACID 事务支持：

```typescript
// 自动事务管理
await dataSource.runInTransaction('users', { userId: '123' }, async (transaction) => {
  await transaction.save(user);
  await transaction.update(User, primaryKey, updateData);
  return 'success';
});

// 手动事务管理
const transaction = await dataSource.startTransaction('users', { userId: '123' });
try {
  await transaction.save(user);
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
}
```

### Q: 事务有什么限制？

A:
1. **分区键限制**：事务范围限制在单个分区键值内
2. **时间限制**：事务最长生命周期为 60 秒
3. **数据量限制**：每个事务写入数据量最大 4MB
4. **一致性要求**：同一事务中所有写操作的分区键值必须相同

### Q: 如何处理事务超时？

A:
```typescript
const transaction = await dataSource.startTransaction(
  'users',
  { userId: '123' },
  { timeout: 30000 } // 设置30秒超时
);

// 检查事务状态
if (!transaction.isActive()) {
  console.log('事务已超时，状态:', transaction.getStatus());
  return;
}
```

### Q: 为什么出现 "explicit-transaction-disabled table" 错误？

A: 这表示数据表没有启用局部事务功能。解决方案：

1. **通过控制台启用**：
   - 登录表格存储控制台
   - 找到目标表，修改表属性
   - 开启"是否开启局部事务"开关

2. **Node.js SDK 限制**：
   - 目前 Node.js SDK 不支持在创建表时直接开启局部事务
   - 需要通过控制台或联系技术支持开启

3. **详细说明**：参考 [启用局部事务文档](docs/ENABLE_TRANSACTION.md)

### Q: 事务功能支持哪些操作？

A: 事务内支持以下操作：
- `save()` - 保存实体
- `update()` - 更新实体
- `delete()` - 删除实体
- `findOne()` - 查找实体
- `batchWrite()` - 批量写入

不支持：`find()`、`page()` 等批量查询操作

## API 参考

### 装饰器

- `@Entity(tableName, options?)` - 定义实体
- `@PrimaryColumn(options?)` - 定义主键列
- `@Column(options?)` - 定义普通列
- `@CreateDateColumn()` - 创建时间自动设置
- `@UpdateDateColumn()` - 更新时间自动设置
- `@DeleteDateColumn()` - 软删除时间
- `@VersionColumn()` - 版本控制

### Repository 方法

- `create(entityLike)` - 创建实体实例
- `save(entity, options?)` - 保存实体
- `findOne(primaryKeys)` - 根据主键查找
- `find(options?)` - 查找多个实体
- `update(primaryKeys, partialEntity)` - 更新实体
- `delete(primaryKeys, options?)` - 删除实体
- `page(options)` - 分页查询
- `createQueryBuilder(alias?)` - 创建查询构建器

### QueryBuilder 方法

- `where(condition)` - 添加主键查询条件
- `filter(callback)` - 添加过滤条件
- `select(columns)` - 选择返回字段
- `limit(count)` - 限制返回数量
- `orderBy(direction)` - 设置排序方向
- `getOne()` - 获取单个结果
- `getMany()` - 获取多个结果

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 相关链接

- [阿里云 Tablestore 官方文档](https://help.aliyun.com/product/27278.html)
- [Tablestore Node.js SDK](https://github.com/aliyun/aliyun-tablestore-nodejs-sdk)
- [TypeORM 官方文档](https://typeorm.io/)

## 社区

- 如果您发现了 bug，请提交 [Issue](https://github.com/tree-eighteen/tablestore-typeorm/issues)
- 如果您有功能建议，请提交 [Feature Request](https://github.com/tree-eighteen/tablestore-typeorm/issues)
- 如果您想贡献代码，请提交 [Pull Request](https://github.com/tree-eighteen/tablestore-typeorm/pulls)

## 更新日志

### v0.0.1 (2024-06-22)
- 🎉 初始版本发布
- ✨ 支持基础的 CRUD 操作
- ✨ 支持游标分页
- ✨ 支持复杂查询条件
- ✨ 支持 TypeORM 风格的装饰器
- ✨ 支持自动时间戳管理
- ✨ 支持软删除和版本控制
- 📚 完整的 TypeScript 类型支持
- 📚 详细的使用文档和示例

---

**Made with ❤️ for Alibaba Cloud Tablestore developers**
