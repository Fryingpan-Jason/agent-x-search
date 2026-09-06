# Agent X Search

**让你的 Agent 原生搜索 X，返回原帖引用，并透明呈现调用用量。**

[English](README.md) · [客户端配置](docs/clients.md) · [真实结果回放](docs/demo.md)

非官方本地 stdio MCP，不是 Skill。默认复用官方 Grok CLI 的现有订阅登录，也可显式选择 xAI API Key。零运行时依赖、无构建，不需要 HTTP 服务、浏览器或开机启动项。

**0.1.0 已发布到 [npm](https://www.npmjs.com/package/agent-x-search)** 和 [GitHub Releases](https://github.com/Fryingpan-Jason/agent-x-search/releases/tag/v0.1.0)，使用同一安装包。可以直接使用下方 npm 命令，也可下载 GitHub 上的 tgz 包和校验文件。API Key 路径仅通过离线契约测试，尚未实测。

## 接入

需要 Node.js 24.5+、支持本地 stdio MCP 的客户端、网络及可用账号。订阅用户先安装并登录官方 Grok CLI，再执行一次 `grok models`。

```sh
codex mcp add agent-x-search -- npx -y agent-x-search@0.1.0 serve
```

只生成配置，不修改文件：

```sh
npx -y agent-x-search@0.1.0 config --client codex
```

配置目标包括 `codex`、`claude-code`、`cursor`、`vscode`、`opencode`、`cline`。建议工具超时设为 300 秒。配置提供、协议测试与客户端实际验证是不同级别，见 [兼容表](docs/clients.md)。不能启动本机进程的云端客户端不算已支持。

日常使用可以安装到自选目录，再用 `config --client codex --local` 生成固定 Node 路径配置；不必全局 npm 安装或每次经 npx 启动。Windows 路径含空格时加引号，完整步骤见英文 README。客户端负责启动 MCP，不需要另开 Grok 或终端窗口。

## 工具与消耗

- 默认只有 `x_search`：一次 Responses 请求，内部可能执行多次检索；正常调用不启动完整 Grok Agent。
- `--enable-deep` 才显示 `x_deep_search`：自定义 CLI 研究流程，最多四个模型回合，不是官方 DeepSearch，也不保证一定更好。
- 默认模型 `grok-4.6`，可用 `--model` 修改。
- 默认 `--auth oauth`，复用登录、不复制 token；过期交给官方 CLI 刷新。
- 显式 `--auth api-key` 才读取 `XAI_API_KEY` 并产生 API 费用；这种模式不启用订阅 CLI 深度工具。
- 不自动切换计费方式或重试。超时不代表没有消耗额度。未知 usage 不填成零。

输入包含查询、账号包含或排除、日期、期望条数、媒体理解和详细程度；账号包含与排除互斥。结果提供答案、引用、引用数、后端、模型、耗时、认证模式、已报告用量及部分结果标记。

```sh
npx -y agent-x-search@0.1.0 doctor
```

Doctor 只读本地状态，不刷新登录或调用模型。订阅代理并非保证长期兼容的第三方公共 API，账号资格、额度和官方版本变化可能影响使用。零依赖不等于无需账号或免费无限调用。

旧版本曾完成真实订阅搜索，深度单轮用时 32.794 秒；不能据此宣传新版全面提速。新版离线指标和待验证平台见 [性能说明](docs/performance.md)、[工程事实](docs/engineer.md)。项目不收集遥测；报告问题时不要提供认证文件、API Key、完整环境变量或私人查询。
