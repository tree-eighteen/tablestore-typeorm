// src/base-model.ts

import { DataSource } from './data-source';
import { Repository, SaveOptions, DeleteOptions } from './repository';
import { FindOptions } from './pagination';
import { metadataStorage } from './decorators/metadata-storage';

/**
 * BaseModel 基类
 * 提供 ActiveRecord 风格的数据库操作方法
 * 
 * @example
 * ```typescript
 * @Entity("users")
 * class User extends BaseModel {
 *   @PrimaryColumn()
 *   id: string;
 * 
 *   @Column()
 *   name: string;
 * 
 *   static async findByName(name: string): Promise<User[]> {
 *     return this.createQueryBuilder()
 *       .filter(f => f.equals('name', name))
 *       .getMany();
 *   }
 * }
 * 
 * // 使用方式
 * const user = new User();
 * user.id = "123";
 * user.name = "John";
 * await user.save();
 * 
 * const foundUser = await User.findOne({ id: "123" });
 * const users = await User.findByName("John");
 * ```
 */
export abstract class BaseModel {
  private static dataSource: DataSource;

  /**
   * 设置全局 DataSource
   */
  static setDataSource(dataSource: DataSource): void {
    BaseModel.dataSource = dataSource;
  }

  /**
   * 获取当前实体的 Repository
   */
  private static getRepository<T extends BaseModel>(entityClass: new () => T): Repository<T> {
    if (!BaseModel.dataSource) {
      throw new Error('DataSource 未设置，请先调用 BaseModel.setDataSource()');
    }
    return BaseModel.dataSource.getRepository(entityClass);
  }

  /**
   * 获取当前实例的 Repository
   */
  private getRepository(): Repository<this> {
    const constructor = this.constructor as new () => this;
    return BaseModel.getRepository(constructor);
  }

  // ==================== 实例方法 ====================

  /**
   * 保存当前实体
   */
  async save(options?: SaveOptions): Promise<this> {
    const repository = this.getRepository();
    return repository.save(this, options);
  }

  /**
   * 删除当前实体
   */
  async remove(options?: DeleteOptions): Promise<void> {
    const repository = this.getRepository();
    const primaryKeys = this.extractPrimaryKeys();
    return repository.delete(primaryKeys, options);
  }

  /**
   * 软删除当前实体
   */
  async softRemove(): Promise<void> {
    const repository = this.getRepository();
    const primaryKeys = this.extractPrimaryKeys();
    return repository.softDelete(primaryKeys);
  }

  /**
   * 恢复软删除的实体
   */
  async restore(): Promise<void> {
    const repository = this.getRepository();
    const primaryKeys = this.extractPrimaryKeys();
    return repository.restore(primaryKeys);
  }

  /**
   * 重新加载实体数据
   */
  async reload(): Promise<this> {
    const repository = this.getRepository();
    const primaryKeys = this.extractPrimaryKeys();
    const reloaded = await repository.findOne(primaryKeys);
    if (!reloaded) {
      throw new Error('实体不存在，无法重新加载');
    }
    Object.assign(this, reloaded);
    return this;
  }

  /**
   * 提取当前实体的主键值
   */
  private extractPrimaryKeys(): Partial<this> {
    const constructor = this.constructor as new () => this;
    const metadata = metadataStorage.getEntityMetadata(constructor);
    if (!metadata) {
      throw new Error(`实体 ${constructor.name} 没有被 @Entity 装饰器标记`);
    }

    const primaryKeys: any = {};
    for (const column of metadata.primaryColumns) {
      const value = (this as any)[column.propertyName];
      if (value !== undefined) {
        primaryKeys[column.propertyName] = value;
      }
    }
    return primaryKeys;
  }

  // ==================== 静态方法 ====================

  /**
   * 创建新实体实例
   */
  static create<T extends BaseModel>(this: new () => T, entityLike?: Partial<T>): T {
    const repository = BaseModel.getRepository(this);
    return repository.create(entityLike);
  }

  /**
   * 根据主键查找实体
   */
  static async findOne<T extends BaseModel>(this: new () => T, primaryKeys: Partial<T>): Promise<T | null> {
    const repository = BaseModel.getRepository(this);
    return repository.findOne(primaryKeys);
  }

  /**
   * 根据条件查找实体
   */
  static async findOneBy<T extends BaseModel>(this: new () => T, where: Partial<T>): Promise<T | null> {
    const repository = BaseModel.getRepository(this);
    return repository.findOneBy(where);
  }

  /**
   * 查找多个实体
   */
  static async find<T extends BaseModel>(this: new () => T, options?: FindOptions<T>): Promise<T[]> {
    const repository = BaseModel.getRepository(this);
    return repository.find(options);
  }

  /**
   * 查找所有实体
   */
  static async findAll<T extends BaseModel>(this: new () => T): Promise<T[]> {
    const repository = BaseModel.getRepository(this);
    return repository.findAll();
  }

  /**
   * 根据条件查找多个实体
   */
  static async findBy<T extends BaseModel>(this: new () => T, where: Partial<T>): Promise<T[]> {
    const repository = BaseModel.getRepository(this);
    return repository.findBy(where);
  }

  /**
   * 统计实体数量
   */
  static async count<T extends BaseModel>(this: new () => T, where?: Partial<T>): Promise<number> {
    const repository = BaseModel.getRepository(this);
    return repository.count(where);
  }

  /**
   * 保存多个实体
   */
  static async saveMany<T extends BaseModel>(this: new () => T, entities: T[], options?: SaveOptions): Promise<T[]> {
    const repository = BaseModel.getRepository(this);
    return repository.saveMany(entities, options);
  }

  /**
   * 删除实体
   */
  static async delete<T extends BaseModel>(this: new () => T, primaryKeys: Partial<T>, options?: DeleteOptions): Promise<void> {
    const repository = BaseModel.getRepository(this);
    return repository.delete(primaryKeys, options);
  }

  /**
   * 软删除实体
   */
  static async softDelete<T extends BaseModel>(this: new () => T, primaryKeys: Partial<T>): Promise<void> {
    const repository = BaseModel.getRepository(this);
    return repository.softDelete(primaryKeys);
  }

  /**
   * 恢复软删除的实体
   */
  static async restore<T extends BaseModel>(this: new () => T, primaryKeys: Partial<T>): Promise<void> {
    const repository = BaseModel.getRepository(this);
    return repository.restore(primaryKeys);
  }

  /**
   * 更新实体
   */
  static async update<T extends BaseModel>(this: new () => T, primaryKeys: Partial<T>, partialEntity: Partial<T>): Promise<T> {
    const repository = BaseModel.getRepository(this);
    return repository.update(primaryKeys, partialEntity);
  }

  /**
   * 创建查询构建器
   */
  static createQueryBuilder<T extends BaseModel>(this: new () => T, alias?: string) {
    const repository = BaseModel.getRepository(this);
    return repository.createQueryBuilder(alias);
  }

  /**
   * 分页查询
   */
  static async page<T extends BaseModel>(this: new () => T, options: any) {
    const repository = BaseModel.getRepository(this);
    return repository.page(options);
  }

  /**
   * 获取实体元数据
   */
  static getMetadata<T extends BaseModel>(this: new () => T) {
    const repository = BaseModel.getRepository(this);
    return repository.getMetadata();
  }
}
