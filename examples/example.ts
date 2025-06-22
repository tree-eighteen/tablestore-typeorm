import { config } from "dotenv";
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DataSource,
  DataSourceOptions,
  FilterFactory,
} from "../src";

config();

@Entity("interactive_bulk_users_table")
class Users {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column()
  age: number;

  @Column()
  email: string;

  @Column({ nullable: true })
  phone?: string;

  @Column()
  city: string;

  @Column()
  department: string;

  @Column()
  salary: number;

  @Column()
  joinDate: string;

  @Column()
  isActive: boolean;

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
  entities: [Users],
};

(async () => {
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();
  const UsersModel = dataSource.getRepository(Users);
    const result1 = await UsersModel.createQueryBuilder()
      .orderBy("DESC")
      .limit(10)
      .filter((f) => f.equals("city", "上海"))
      .getMany();

  const result = await UsersModel.page({
    limit: 3,
    order: "ASC",
    where: { department: "技术部" },
    filter: (f) => f.equals("city", "上海")
  })
  console.log(result);
})();
