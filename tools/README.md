# 异次元图源解密工具

`decrypt_ycy.py` 用于解密 yckceo「异次元」图源仓库中形如：

```
:_R002_<hex>
:_H006_<base64>
:_T004_<base64>
:_S007_<base64>
```

的私有加密规则。算法来自异次元 APK（`com.wsw.cospa.utils.Cfor`、`Cgoto`、`Cimplements`）。

## 用法

```bash
# 拉取图源（示例：一次 100 个 ID）
curl 'https://www.yckceo.com/yiciyuan/tuyuan/jsons?id=946-945-944' -o sources.json

# 解密
python3 tools/decrypt_ycy.py sources.json decrypted.json

# 直接输出到 stdout
python3 tools/decrypt_ycy.py sources.json > decrypted.json
```

脚本会打印成功/失败统计，失败项包含源名称、字段和错误原因。

## 算法

### H / T

```
key = MD5( customDecode(hexDecode(bookSourceUrl)) + KEYS[CODE] + (T ? "648" : "") )
AES-256-CBC, IV = "1234567890123456", PKCS7, payload = Base64
```

- `hexDecode`：按 hex 字符取 `Character.digit`（非 hex 字符为 -1）。
- `customDecode`：`Cgoto` 的 7-bit 打包解码，转义字节为 `{0,10,13,34,38,92}`。
- `KEYS` 是 APK 内的 H001–H006 / T001–T006 表。

### R

```
hexDecode(payload) -> 按 128 字节分块
RSA/ECB/PKCS1Padding 逐块解密
拼接后 URLDecode（+ 还原为空格）
```

R001–R006 各有自己的 1024-bit modulus / private exponent，已内置在脚本中。

### S

AES-256-CBC，key 直接使用 `KEYS[CODE]`，IV/PKCS7 同上。

## 依赖

- Python 3.8+
- `openssl` 命令行（AES 解密；注意不能使用 `openssl enc -a -K`，先本地解 Base64 再传二进制）

RSA、MD5、自定义位解码均为纯 Python 实现。

## 已知结果

对 2026-11 的 622 条图源：

- 417 个源含加密字段
- 822 个加密字段中成功解密 **806 个**
- 8 个源（16 个字段）失败，通常是规则由不同客户端版本生成

失败源：拷贝漫画(海外)、酷漫屋-自用、快看漫画、ZERO搬运网、奇漫屋、733动漫。

## 注意

- 解密结果只恢复规则文本，不代表站点仍可用；站点改版后仍需适配。
- 常量来自特定版本的 APK，客户端更新后可能变化。
- 仅用于规则兼容/迁移研究，请遵守目标站点的使用条款。
