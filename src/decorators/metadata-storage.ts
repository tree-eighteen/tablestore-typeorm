// src/typeorm-style/decorators/metadata-storage.ts

import "reflect-metadata";

/**
 * 实体元数据
 */
export interface EntityMetadata {
  target: Function;
  tableName: string;
  columns: ColumnMetadata[];
  primaryColumns: ColumnMetadata[];
  // 特殊列的快速访问
  createDateColumn?: ColumnMetadata;
  updateDateColumn?: ColumnMetadata;
  versionColumn?: ColumnMetadata;
  deleteDateColumn?: ColumnMetadata;
  autoCreateTable?: boolean;
  tableOptions?: {
    timeToLive?: number;
    maxVersions?: number;
  };
  reservedThroughput?: {
    read: number;
    write: number;
  };
}

/**
 * 特殊列类型
 */
export type SpecialColumnType = 'create-date' | 'update-date' | 'version' | 'delete-date';

/**
 * 列元数据
 */
export interface ColumnMetadata {
  target: Function;
  propertyName: string;
  type?: Function;
  isPrimary?: boolean;
  nullable?: boolean;
  default?: any;
  transformer?: {
    to?: (value: any) => any;
    from?: (value: any) => any;
  };
  // Tablestore 特定选项
  tablestoreType?: 'STRING' | 'INTEGER' | 'DOUBLE' | 'BOOLEAN' | 'BINARY';
  // 特殊列类型
  specialType?: SpecialColumnType;
  // 是否在插入时自动设置
  setOnInsert?: boolean;
  // 是否在更新时自动设置
  setOnUpdate?: boolean;
}

/**
 * 全局元数据存储
 */
export class MetadataStorage {
  private static instance: MetadataStorage;
  private entities: Map<Function, EntityMetadata> = new Map();

  static getInstance(): MetadataStorage {
    if (!MetadataStorage.instance) {
      MetadataStorage.instance = new MetadataStorage();
    }
    return MetadataStorage.instance;
  }

  /**
   * 添加实体元数据
   */
  addEntityMetadata(metadata: EntityMetadata): void {
    // 如果已经存在实体元数据，合并而不是覆盖
    const existing = this.entities.get(metadata.target);
    if (existing) {
      // 保留已有的列信息和特殊列信息，只更新实体级别的信息
      metadata.columns = existing.columns;
      metadata.primaryColumns = existing.primaryColumns;
      metadata.createDateColumn = existing.createDateColumn;
      metadata.updateDateColumn = existing.updateDateColumn;
      metadata.versionColumn = existing.versionColumn;
      metadata.deleteDateColumn = existing.deleteDateColumn;
    }
    this.entities.set(metadata.target, metadata);
  }

  /**
   * 获取实体元数据
   */
  getEntityMetadata(target: Function): EntityMetadata | undefined {
    return this.entities.get(target);
  }

  /**
   * 获取所有实体元数据
   */
  getAllEntityMetadata(): EntityMetadata[] {
    return Array.from(this.entities.values());
  }

  /**
   * 添加列元数据到实体
   */
  addColumnMetadata(target: Function, column: ColumnMetadata): void {
    let entityMetadata = this.entities.get(target);
    if (!entityMetadata) {
      entityMetadata = {
        target,
        tableName: target.name.toLowerCase(),
        columns: [],
        primaryColumns: []
      };
      this.entities.set(target, entityMetadata);
    }

    // 添加列到实体
    const existingColumnIndex = entityMetadata.columns.findIndex(
      col => col.propertyName === column.propertyName
    );

    let finalColumn: ColumnMetadata;
    if (existingColumnIndex >= 0) {
      finalColumn = { ...entityMetadata.columns[existingColumnIndex], ...column };
      entityMetadata.columns[existingColumnIndex] = finalColumn;
    } else {
      finalColumn = column;
      entityMetadata.columns.push(finalColumn);
    }

    // 如果是主键列，也添加到主键列表
    if (finalColumn.isPrimary) {
      const existingPrimaryIndex = entityMetadata.primaryColumns.findIndex(
        col => col.propertyName === finalColumn.propertyName
      );

      if (existingPrimaryIndex >= 0) {
        entityMetadata.primaryColumns[existingPrimaryIndex] = finalColumn;
      } else {
        entityMetadata.primaryColumns.push(finalColumn);
      }
    }

    // 处理特殊列类型
    if (finalColumn.specialType) {
      switch (finalColumn.specialType) {
        case 'create-date':
          entityMetadata.createDateColumn = finalColumn;
          break;
        case 'update-date':
          entityMetadata.updateDateColumn = finalColumn;
          break;
        case 'version':
          entityMetadata.versionColumn = finalColumn;
          break;
        case 'delete-date':
          entityMetadata.deleteDateColumn = finalColumn;
          break;
      }
    }
  }

  /**
   * 清空所有元数据（主要用于测试）
   */
  clear(): void {
    this.entities.clear();
  }
}

// 导出单例实例
export const metadataStorage = MetadataStorage.getInstance();
