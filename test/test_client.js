//var Promise = require('promise');
var tcp_moudle = require('../lib/tcp_moudle');

var server_node = {};
if(process.argv[2]){
	server_node.host = process.argv[2];
	server_node.port = process.argv[3];
}else{
	return console.log('usage: node test_client.js [host] [port]')
}

tcp_moudle.createConnection({
		server : server_node,
		use_secure_layer : false,
		id : 'node-set'
	}, function(err, conn_warp){
	if(err) return;
	
	console.log('connection --> get:isMaster:null');
	conn_warp.get('isMaster', null, (err, msg) => {
		console.log('connection <-- get:test:' + JSON.stringify(msg.data));
	})
});

