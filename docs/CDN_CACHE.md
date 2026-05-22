# CDN 缓存问题 FAQ

## 问题

Push 到 `main` 分支后，Venera 应用通过 `cdn.jsdelivr.net` 加载的 `pixiv.js` 仍是旧版本，而 GitHub Raw 已是新版本。

## 根本原因

jsDelivr 是一个多层 CDN 网络：

```
GitHub (origin)
   │
   ▼
jsDelivr Origin Cache (purge.jsdelivr.net)
   │
   ▼
Fastly / Cloudflare / BunnyCDN (边缘节点, 全球数百个)
   │
   ▼
用户 / Venera 应用
```

- **GitHub push → jsDelivr Origin**：通常 1-5 分钟，jsDelivr 有定时轮询
- **Origin → 边缘 CDN**：各节点有独立的 TTL（默认 12 小时），即使 purge 了 Origin，边缘节点仍可能返回旧缓存
- **`purge.jsdelivr.net`**：只清除 **Origin** 层缓存，不直接控制边缘 CDN

因此推送新版本后，**最快几分钟，最慢 12-24 小时**，所有边缘节点才会更新。

## 自动解决

本仓库的 GitHub Actions workflow (`.github/workflows/purge_cdn.yml`) 会在每次 push `main` 时自动触发：

1. 通过 `git diff` 找出变更的 `.js` / `.json` 文件
2. 对每个变更文件调用 `https://purge.jsdelivr.net/gh/...@main/...` 
3. 清除 jsDelivr Origin 缓存

这加速了传播但不是即时生效。

## 手动 Purge

当需要立即刷新特定文件时：

```bash
# 对单个文件 purge（可多次执行以穿透多层缓存）
curl https://purge.jsdelivr.net/gh/theoldman-lab/venera-configs@main/pixiv.js

# 多轮 purge 以推动边缘节点刷新
for i in $(seq 1 5); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    https://purge.jsdelivr.net/gh/theoldman-lab/venera-configs@main/pixiv.js
  sleep 2
done
```

HTTP 200 表示 purge 请求已被接受，但不代表边缘节点已刷新。

## 验证方法

```bash
# 1. 确认 GitHub Raw 是最新版本
curl -s https://raw.githubusercontent.com/theoldman-lab/venera-configs/main/pixiv.js | grep version

# 2. 确认本地文件与 GitHub 一致
diff pixiv.js <(curl -s https://raw.githubusercontent.com/theoldman-lab/venera-configs/main/pixiv.js)

# 3. 检查 CDN 版本（多次请求可能命中不同节点）
curl -s https://cdn.jsdelivr.net/gh/theoldman-lab/venera-configs@main/pixiv.js | grep version
```

**注意**：CDN 版本可能不稳定——不同请求可能命中不同边缘节点，有的已刷新、有的未刷新。

## CDN 故障排查

### 确认 GitHub 端正确

```bash
# 检查本地是否有未推送的 commit
git status
git log origin/main..HEAD

# 对比本地与 GitHub
diff pixiv.js <(curl -s https://raw.githubusercontent.com/theoldman-lab/venera-configs/main/pixiv.js)
```

输出为空 = 文件一致，问题在 CDN 侧；输出有差异 = 未 push 或 GitHub 未同步。

### 24 小时后仍未更新

如果 push 超过 24 小时 CDN 仍未更新：

1. **用 commit hash 替代分支名请求 CDN**（绕过分支缓存）：
   ```
   https://cdn.jsdelivr.net/gh/theoldman-lab/venera-configs@<commit_hash>/pixiv.js
   ```

2. **检查 jsDelivr 状态**：https://www.jsdelivr.com/status

3. **联系 jsDelivr 支持**：https://github.com/jsdelivr/jsdelivr/issues

## 预防措施

- **版本号递增**：每次修改 `pixiv.js` 时更新 `version` 字段和 `index.json`，便于快速判断 CDN 是否已更新
- **`git diff` 确认变更范围**：Push 前检查 `git diff origin/main` 确保所有文件变更都被捕获
- **验证 CDN 后再报告"已部署"**：Push 后等待 CDN 稳定再通知用户
