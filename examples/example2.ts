import { config } from "dotenv";
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DataSource,
  DataSourceOptions,
  BaseModel,
} from "../src";

config();

@Entity("users_email_index")
class UsersEmailIndex extends BaseModel {
  @PrimaryColumn()
  email: string;

  @PrimaryColumn()
  id: string;
}

@Entity("interactive_bulk_users_table")
class Users extends BaseModel {
  @PrimaryColumn()
  id: string;

  @Column()
  email: string;

  @Column()
  name: string;

  @Column()
  age: number;

  @Column()
  phone: string;

  @Column()
  city: string;

  @Column()
  department: string;

  @Column()
  salary: number;

  @Column()
  joinDate: Date;

  @Column()
  isActive: boolean;

  @CreateDateColumn()
  created: Date;

  @UpdateDateColumn()
  updated: Date;
}

// 配置数据源
const dataSourceOptions: DataSourceOptions = {
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.ALIYUN_ACCESS_KEY_SECRET || "",
  endpoint: process.env.TABLE_STORE_ENDPOINT || "",
  instancename: process.env.TABLE_STORE_INSTANCE_NAME || "",
};

(async () => {
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();
  // const result = await UsersEmailIndex.findOne({
  //   email: "user300079@qq.com",
  // });

  // const userInfo = await Users.findOne({
  //   id: 'fdsafdsafdsa'
  // })

  // console.log(userInfo);

  const result2 = await Users.update(
    { id: "fdsafdsafdsa" },
    {
      email: "123@qq.com",
    }
  );

  console.log(result2);
})();
