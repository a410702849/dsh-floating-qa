# dsh-floating-qa

<img src="https://raw.githubusercontent.com/a410702849/dsh-floating-qa/main/icon.svg" alt="Floating Q&A icon" width="72" height="72" align="right" />

**悬浮问答**：把对话里的任意一条「问题 + 回答」钉到 DSH 对话界面上，形成一个长期悬浮、可拖拽的速查小列表。适合在长会话里反复查阅同一个结论、配置或代码片段。

**Floating Q&A** for DeepSeek Harness: pin any question/answer pair as a draggable, always-available quick-reference list over the conversation.

## 功能

- 在已完成的助手回答操作行点击图钉，即可收藏该条问答。
- 悬浮面板默认贴紧左侧栏右边线、位于会话顶部菜单下方，可拖拽并记住位置。
- 问题、回答各显示一行，超出省略；点击条目弹出遮罩层查看全文，回答中的 Markdown 会按主对话样式渲染。
- 左右边框都可以拖动调整宽度，最小 130px，最大不超过桌面窗口宽度。
- 默认最多 3 条，可在齿轮设置中调整到 1–20 条。
- 列表默认约三组问答高度，超出后在面板内滚动。
- 每个会话独立维护悬浮列表、设置展开状态；切换会话不会串数据。
- 「取消所有悬浮」只清空当前会话。
- 不修改对话数据，只注册两个客户端 UI 槽位。

## 安装

在 DSH 插件市场搜索 **dsh-floating-qa** 安装。

首次安装后，请刷新 DSH 桌面端页面或重启 DeepSeek Harness，让客户端插件生效。

本地开发时，也可以通过 DSH 的 bundle 安装入口选择本目录。

## 使用

1. 在任意一条已完成的助手回答下方，点击操作行里的图钉按钮。
2. 对话左上角会出现「悬浮问答」面板。
3. 拖动标题栏移动位置；拖动左右边框调整宽度。
4. 点击条目查看完整问答（Markdown 会正常排版）；按 `Esc`、点击遮罩或「关闭」退出。
5. 打开齿轮可调整最多条数；「取消所有悬浮」只清空当前会话。

## 数据与权限

- 悬浮条目保存在浏览器 `localStorage`：`dsh.floating-qa.v1`。
- 面板位置和宽度保存在：`dsh.floating-qa.position.v1`。
- 插件只读取当前会话中已渲染的消息文本，用于生成悬浮条目；不上传任何数据。
- 不写入对话历史，不调用外部网络接口。

## 兼容性

- 目标平台：DeepSeek Harness 桌面端 Web 客户端。
- 注册槽位：`conversation.chat.assistant-actions`、`shell.overlay`。
- 使用 DSH 客户端主题变量，跟随明暗主题。

## 开发与打包

```bash
npm pack --dry-run
npm pack
```

检查生成的 tarball 只包含 `index.js`、`client.js`、`cordis.patch.yml`、`locale/`、`docs/`、`icon.svg`、`README.md`、`LICENSE`。

## 许可证

MIT。见 [LICENSE](LICENSE)。
