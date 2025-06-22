// examples/debug-metadata.ts

import "reflect-metadata";
import { 
  Entity, 
  PrimaryColumn, 
  Column, 
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  DeleteDateColumn,
  metadataStorage
} from "../src";

// 定义测试实体
@Entity("debug_test")
export class DebugTest {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @VersionColumn()
  version: number;

  @DeleteDateColumn()
  deletedAt: Date | null;
}

// 调试元数据
function debugMetadata() {
  console.log("=== 调试元数据 ===");
  
  const metadata = metadataStorage.getEntityMetadata(DebugTest);
  
  if (!metadata) {
    console.log("❌ 没有找到实体元数据");
    return;
  }
  
  console.log("✅ 找到实体元数据:");
  console.log("- 表名:", metadata.tableName);
  console.log("- 列数量:", metadata.columns.length);
  console.log("- 主键列数量:", metadata.primaryColumns.length);
  
  console.log("\n所有列:");
  metadata.columns.forEach((column, index) => {
    console.log(`${index + 1}. ${column.propertyName}:`);
    console.log(`   - 类型: ${column.type?.name}`);
    console.log(`   - 特殊类型: ${column.specialType || '无'}`);
    console.log(`   - 插入时设置: ${column.setOnInsert || false}`);
    console.log(`   - 更新时设置: ${column.setOnUpdate || false}`);
    console.log(`   - 是否主键: ${column.isPrimary || false}`);
  });
  
  console.log("\n特殊列:");
  console.log("- 创建时间列:", metadata.createDateColumn?.propertyName || '未定义');
  console.log("- 更新时间列:", metadata.updateDateColumn?.propertyName || '未定义');
  console.log("- 版本列:", metadata.versionColumn?.propertyName || '未定义');
  console.log("- 删除时间列:", metadata.deleteDateColumn?.propertyName || '未定义');

  console.log("\n直接访问特殊列属性:");
  console.log("- createDateColumn 存在:", !!metadata.createDateColumn);
  console.log("- updateDateColumn 存在:", !!metadata.updateDateColumn);
  console.log("- versionColumn 存在:", !!metadata.versionColumn);
  console.log("- deleteDateColumn 存在:", !!metadata.deleteDateColumn);

  if (metadata.createDateColumn) {
    console.log("- createDateColumn 详情:", metadata.createDateColumn);
  }

  console.log("\n元数据对象的所有属性:");
  console.log(Object.keys(metadata));
}

// 运行调试
debugMetadata();
