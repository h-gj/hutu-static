# HuTu Static

[HuTu](https://github.com/h-gj/hutu) 的 GitHub Pages 静态部署版，托管于 **https://hutu.hgjhub.com**。

源码项目 `hutu` 保持不变（含 Python 后端）；本仓库仅包含可静态托管的前端资源。

## 功能范围

- 工具首页与分类导航
- 纯前端工具页面（如时间戳转换等）
- 依赖 `server.py` API 的工具（Dict 转换、Request Local、在线分享、管理后台等）**在本站不可用**，请本地运行 HuTu：

```powershell
git clone git@github.com:h-gj/hutu.git
cd hutu
pip install -r requirements.txt
cp admin_config.example.json admin_config.json
python server.py
```

## 本地预览

```powershell
cd hutu-static
python -m http.server 8080
```

访问 http://127.0.0.1:8080/

## 部署

### GitHub Pages

1. 推送 `main` 到 https://github.com/h-gj/hutu-static
2. **Settings → Pages** → Branch: `main` / `/ (root)`
3. **Custom domain**: `hutu.hgjhub.com` → 勾选 **Enforce HTTPS**

### 阿里云 DNS（hgjhub.com）

| 记录类型 | 主机记录 | 记录值 |
|----------|----------|--------|
| CNAME | `hutu` | `h-gj.github.io` |

## 与 HuTu 的关系

| 仓库 | 用途 |
|------|------|
| [h-gj/hutu](https://github.com/h-gj/hutu) | 完整版，本地 Python 服务 |
| [h-gj/hutu-static](https://github.com/h-gj/hutu-static) | 静态在线版，GitHub Pages |

更新工具列表时，同步 `tools.json` 及 `tools/`、`static/` 目录即可。

## License

Private / personal use.
