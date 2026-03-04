# log-w

使用 Node.js + MySQL + Redis 的 Session 登录示例。

## 依赖

- Node.js 18+
- MySQL 8+
- Redis

## 配置

1. 复制环境变量模板

```
copy .env.example .env
```

2. 按需填写 `.env`

Redis 单用户密码示例：`REDIS_URL=redis://:你的密码@127.0.0.1:6379`

## 初始化数据库

```
mysql -u root -p < schema.sql
```

演示账号：`demo@example.com`，密码：`password123`

## 启动

```
npm install
npm run dev
```

访问 `http://localhost:3000`
