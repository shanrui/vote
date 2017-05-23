# vote
多个app，使用tcp长连接，动态投票选出一个master

测试

启动三个app节点
node ./test/run.js

使用test_client.js来观察节点的情况

node ./test/test_client.js [节点的host] [节点监听的port]
