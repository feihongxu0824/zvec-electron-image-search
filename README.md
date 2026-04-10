# zvec-image-search

基于 [zvec](https://www.npmjs.com/package/@zvec/zvec) + [CLIP](https://huggingface.co/Xenova/clip-vit-base-patch32) 的本地多模态图片语义搜索桌面应用。输入自然语言，即可从本地图片库中找到语义匹配的图片。

## 前置要求

| 依赖 | 版本要求 |
|------|---------|
| Node.js | >= 18 |
| npm | >= 8 |

> **Windows / macOS / Linux** 均可运行。

## 本地运行

```bash
# 1. 进入项目目录
cd zvec-image-search

# 2. 安装依赖
npm install

# 3. 如果无法直接访问 HuggingFace，设置镜像源
export HF_ENDPOINT=https://hf-mirror.com

# 4. 启动应用
npm start
```

## 首次启动

首次启动时，应用会自动完成以下三个阶段的初始化（需要联网）：

1. **下载 CLIP 模型** — 从 HuggingFace 下载量化后的 `clip-vit-base-patch32` 模型（约 150 MB）
2. **下载示例图片** — 从 [Lorem Picsum](https://picsum.photos) 下载 200 张示例图片
3. **构建向量索引** — 对每张图片提取 512 维特征向量，使用 zvec 构建本地索引

整个过程可能需要几分钟，界面上会显示进度。完成后数据会缓存在本地，后续启动无需重复下载。

## 使用方式

初始化完成后，在搜索框中输入**英文**关键词或短语（例如 `sunset over the ocean`、`a cat sitting on a chair`），应用会通过 CLIP 模型将文本转为向量，然后在 zvec 索引中进行语义检索，返回最相关的 20 张图片。

## 技术栈

- **Electron** — 跨平台桌面应用框架
- **@huggingface/transformers** — 在 Node.js 端运行 CLIP 模型
- **onnxruntime-node** — ONNX 模型推理引擎
- **@zvec/zvec** — 轻量级向量数据库，用于存储和检索图片特征向量
