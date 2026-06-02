## 项目约定

\_function : 表示根据 X6 源码对部分 protected 的二开属性提取等对外不暴露的方法进行使用。比如\_getSelectors 表示获取 view selectors 属性，该属性为 protected，直接调用会有 ts error, 通过 \_function 二开解决。
@tips: 对于 X6 框架的版本升级，若出现兼容性问题，优先 search \_function 阅读 X6 新版本的迁移指南进行升级。
