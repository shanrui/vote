# vote
多个app，使用tcp长连接，动态投票选出一个primary

## 简介
看mongodb的时候，知道它的Replica Set能选举出一个primary，其他多个节点是secondaries。粗略了解了一下它的方法，想动手实现很简单的选举，看一下效果。

## 测试

### 启动三个app节点
```
node ./test/run.js
```
### 使用test_client.js来观察节点的情况
```
node ./test/test_client.js [节点的host] [节点监听的port]
```
启动的三个节点的信息在test文件夹下的json格式配置文件内
