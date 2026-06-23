---
name: venera-comic-source-builder
description: "快速生成Venera漫画阅读器的漫画源配置文件，支持自动分析网站结构、分步测试验证、自动生成完整源文件"
---

# Venera 漫画源生成器

自动分析漫画网站结构，生成完整的 Venera 漫画源配置文件。

## 功能特性

- ✅ 自动分析网站 HTML 结构
- ✅ 分步测试验证（发现页、搜索页、分类页、漫画详情、图片获取）
- ✅ 支持备用域名切换
- ✅ 基础反爬应对（随机 User-Agent、请求延迟）
- ✅ 自动生成完整源文件

## 使用方法

```bash
node main.js
```

## 工作流程

1. **信息收集** → 输入网站URL、名称、Key、版本号等
2. **分步测试** → 自动测试发现页、搜索页、分类页、漫画详情、图片获取
3. **生成源文件** → 根据测试结果自动生成 `.js` 源文件
4. **显示报告** → 展示测试结果和生成的文件路径

## 依赖要求

- Node.js 14+
- Python 3.8+
- 安装 Python 依赖：
  ```bash
  pip install requests beautifulsoup4 fake-useragent
  ```

## 输入参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| URL | string | 是 | 漫画网站URL |
| name | string | 否 | 网站名称（默认从URL提取） |
| key | string | 否 | 源Key（默认小写网站名） |
| version | string | 否 | 版本号（默认1.0.0） |
| needLogin | boolean | 否 | 是否需要登录（默认false） |
| backupDomains | array | 否 | 备用域名列表 |

## 输出

- 生成的漫画源文件（`.js`）
- 详细测试报告