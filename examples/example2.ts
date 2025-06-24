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

@Entity("users_index")
class Users {
  @PrimaryColumn()
  email: string;

  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column()
  age: number;

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
  const result = await UsersModel.createQueryBuilder()
    .select(["email", 'name'])
    .where({ email: "user100000@outlook.com" })
    .getOne();
  console.log(result);
})();
