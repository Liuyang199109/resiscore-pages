# 交通城市数据

本目录存放可部署的公共交通数据。当前只提供广州地铁数据，来源为 OpenStreetMap Overpass API，遵循 OpenStreetMap ODbL 1.0，并在数据包中保留署名信息。

- `manifest.json`：城市数据版本、下载地址、文件大小和 SHA-256。
- `cities/guangzhou.json`：广州地铁站点、线路、坐标和站点等级评分。
- `routeRuleVersion=2026-10-07-walk-estimate-public-first-1.35`：步行估算规则版本；客户端缓存会校验该版本，避免同日旧缓存继续使用旧口径。
- `../../scripts/update-guangzhou-transport.mjs`：重新下载并生成广州数据包。

广州数据包同时包含天河中央商务区的三个 CBD 锚点：天河北/天河体育中心、珠江新城、广州国际金融城。小区有坐标后，客户端可以用 `TransportDataStore.distanceToCbd(cityData, latitude, longitude)` 离线计算到最近锚点的球面距离。天河中央商务区的官方口径包括这三个片区，详见[天河中央商务区官方介绍](https://www.thnet.gov.cn/zjth/tzth/zlpt/content/post_8795050.html)。

## 更新数据

手动更新：

```bash
node scripts/update-guangzhou-transport.mjs
```

脚本会从 Overpass 查询广州地铁线路关系，按站点名称合并线路，重新计算中心性和换乘分，并刷新 `manifest.json`。网络接口偶发超时或不可用时，脚本会尝试备用 Overpass 服务；发布前应检查生成的站点数量和来源更新时间。

建议在部署平台配置每月一次的定时任务，运行脚本后上传 `data/transport/` 目录。小程序端只需要读取 `manifest.json`，发现版本变化后再下载对应城市文件。

公共交通高峰时间尚未写入广州包。它需要可授权的 GTFS/时刻表和步行路网，由服务器端的 OpenTripPlanner 等路线引擎预计算后再发布；没有可靠时刻表时不使用估算值冒充实际通勤时间。

## 小程序端缓存

`transport-data.js` 提供 `TransportDataStore.loadCity('guangzhou')`：

1. 读取本机已有的城市数据。
2. 在线检查公共 `manifest.json`。
3. 本机没有数据或版本落后时下载新文件。
4. 网络不可用时继续使用本机旧数据。

在微信小程序中，应把数据域名加入 request 合法域名，并在加载 `transport-data.js` 前设置公共数据域名：

```js
globalThis.RESISCORE_DATA_BASE_URL = 'https://你的数据域名';
```

网页原型默认使用相对路径 `/data/transport/`。数据文件放在静态部署根目录后，其他用户即可按需下载广州数据；其他城市未来可按同样格式新增城市文件，不需要预置到每个用户设备。

## 评分口径

广州站点等级分最高 50 分：以天河中央商务区三个锚点的加权中心计算城市中心性（最高 35 分），再叠加换乘价值（最高 20 分），最终封顶 50 分。

交通位置不再只取一个最近站点。先收集小区主要出入口到所有可用地铁出入口的步行路线，只保留步行距离不超过 1,500 米的站点。距离子项和站点等级子项分别执行同一组合公式：

```text
组合子项分 = 最高站点子项分 + 0.5 × 其余候选站点子项分之和
```

为保持交通位置权重仍为 15 分，每个子项的组合原始分封顶 50 分；距离组合折算到 10 分，站点等级组合折算到 5 分，两个子项相加得到交通位置总分。候选站点必须保存 `walkDistanceM`、`originEntrance`、`stationExit`、`source`、`verifiedAt` 和 `distanceQuality`。`distanceQuality=walking-route` 表示有地图步行路线；`distanceQuality=estimated` 表示按统一估算规则换算，仍可参与评分，但界面必须标注“估算”。

统一估算规则为：先确认小区最近人行道出入口和地铁可用出口；有公开的入口到出口步行距离时直接采用公开值，不再与直线距离比较取最大值。没有公开步行距离时，才使用 `直线距离 × 1.35` 兜底；只有小区中心坐标时必须标记为中心点代理估算，不能冒充入口路线。1.35 来自入口/出口口径一致的高可信样本校准；原始公开目录样本包含中心点、道路距离和异常口径，原始均值不直接作为生产系数。估算值写入 `walkDistanceM`，并保留 `distanceBasis`、`originBasis`、`stationBasis`、`estimateMethod`、输入距离和日期，用户在界面修改后标记为 `user-adjusted`。

当小区没有登记在 `communityRoutes` 中，但广州生活配套包能匹配到小区坐标时，客户端会读取同一城市的 `stations` 坐标，自动生成 1.5km 内最多 3 个最近站点的坐标估算候选。由于没有公开入口路线，这类候选使用直线距离 × 1.35，来源标记为“广州小区坐标 + 地铁站坐标（中心点代理估算）”，入口和出口明确标记为估算。已经登记的社区路线优先级更高；用户可以在界面中输入最近人行道出入口到地铁出口的实测步行距离覆盖估算值。

客户端调用 `TransportDataStore.scoreTransportStationRoutes(routes)` 可得到 `distanceScore`、`stationLevelScore` 和 `totalPoints`；距离项按 10 分折算，站点等级项按 5 分折算，合计 15 分。路线数组中的 `stationLevelScore` 应直接引用广州城市数据包对应站点的 `score` 字段。

小区路线记录中的站点等级不作为永久硬编码值；加载路线时会按站名回查城市站点表，动态使用最新的线路数、中心距离、中心性分和换乘分。这样线路开通或站点数据更新后，不需要逐个修改小区路线记录。

社区交通评分优先使用“小区主要出入口到地铁站可用出入口”的步行路线距离。没有完整路线时，允许使用上述估算值，不能直接把小区几何中心直线距离、楼盘宣传距离或最近道路距离当作最终步行距离。大型社区、TOD 项目和跨道路小区要保留估算偏移和来源；用户可在交通规则卡片中直接修改每条路线距离。站点匹配还要同时核对站点是否已运营、线路和换乘关系。

这是一个可解释的基础评分，不代表官方站点评级。城市中心坐标和评分参数记录在城市数据的 `scoring` 字段中，后续可以按产品口径调整并重新生成版本。

