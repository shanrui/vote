var net = require('net')
	, connection_wrap = require('./connection_wrap')
	, SecureLayer = require("./secure_layer")
	, Router = require('./message_route')
//    , Promise = require('promise')
	, assert = require('assert')
	, moment = require("moment-timezone");

var default_config = {
	"time_zone" : "Asia/Shanghai",
	
	"client_heart_beat_check" : {
		"timeout" : 400,
		"interval" : 120
	},
	
	"use_secure_layer": false,
	
	"wait_re_message_time" : 15,

	"server":{
		"host" : "127.0.0.1",
		"port" : 4000
	}	
}
	
function createServer(message_router, config){
	// Keep track of connections.
	var conns={};

	var client_heart_beat_check = config.client_heart_beat_check || default_config.client_heart_beat_check;

	var use_secure_layer = config.use_secure_layer || default_config.use_secure_layer;

	//time zone
	var zone = config.time_zone || default_config.time_zone;	
	
	var client_heart_beat_check_timer;
	
	var server = net.createServer(function(conn){
		console.log('	Has connection.');
		var conn_wrap = new connection_wrap(conn, {
			wait_re_message_time : config.wait_re_message_time || default_config.wait_re_message_time,
			time_zone : zone
		});
		
		if(use_secure_layer) conn_wrap.sl = SecureLayer('server');

		conn_wrap.had_error = false;
		conn_wrap.had_close = false;

		//conn_wrap.sendMessage({type : "init"});
		
		conn_wrap.on('close', function(){
			console.log('\033[31m	'+ conn.id +'连接关闭!\033[39m');
			if (!conn_wrap.had_error && conn.id){
				//
			}
			conn_wrap.had_close = true;
		});
		
		conn_wrap.on('error', function(){
			console.log('\033[31m	'+ conn.id +'连接错误!\033[39m');
			if(conn.id){
				//
			}
			conn_wrap.had_error = true;
		});
		
		conn_wrap.on('node-meta-info', function(message){
			if(message && message.data && message.data['id']){
				var id = message.data['id'],
					salt_for_key = message.data['salt-for-key'],
					salt_for_iv = message.data['salt-for-iv'];
					
					if(false){
						console.log('\033[31m	connection come from: ' + id + ' error!\033[39m');
						conn_wrap.sendMessage({type:"refuse"});		
					}
					else{
						console.log('\033[31m	connection come from: ' + id + '!\033[39m');
						conn.id = id;
						conns[id] = conn_wrap;
						
						conn_wrap.sendMessage({type:"work"});
						
						try{
							//to aes mode
							conn_wrap.sl && conn_wrap.sl.init('secret', new Buffer(salt_for_key, 'hex'), new Buffer(salt_for_iv, 'hex'));
						}catch(err){
							conn.end();
							conn.destroy();
						}
					}
			}
		});

		conn_wrap.on('*', function(message){
			//
		});
		
		if(message_router){
			conn_wrap.on('req-message', function(message){
				message_router.route(message.method || '', message.type)(conn_wrap, message);
			});	
		}
		
		//处理心跳包
		conn.latest_heart_beat = Math.floor((new Date()).getTime()/1000);
		conn_wrap.on('heart-beat', function(msg){
			conn.latest_heart_beat = Math.floor((new Date()).getTime()/1000);
			conn_wrap.sendMessage({type : "heart-beat"});
		});
		
		//ping pong
		conn_wrap.on('ping', function(msg){
			conn_wrap.re(msg, "pong");
		});
		
	});

	//检查客户端心跳包超时
	function checkClientState(){
		var now_sec = Math.floor((new Date()).getTime()/1000);
		Object.keys(conns).forEach(function(index){
			var conn_wrap = conns[index];
			var conn = conn_wrap.conn;
			var should_over = conn_wrap.had_error || conn_wrap.had_close;
			if(should_over || (now_sec - conn.latest_heart_beat) > client_heart_beat_check.timeout){
				conn.end();
				conn.destroy();
				delete conns[index];
			}
		});
	}
	
	return {
		start : function(opts){
			var port = default_config.server.port;
			if(opts && opts.port) port = opts.port;
			server.listen(port, function(){
				console.log('\033[90m	server listening on port '+ port +'!\033[39m');
			});
			server.on('error', function(){
				console.log('\033[31m	Tcp server error!\033[39m');
			});
			client_heart_beat_check_timer = setInterval(checkClientState, client_heart_beat_check.interval*1000);
		},
		stop : function(){
			server.close();
			clearInterval(client_heart_beat_check_timer);
		}
	}
}

function createConnection(config, cb){
	var metaData = {
		type: 'node-meta-info',
		data:{
			'id' : config.id,
			'salt-for-key' : 'aabbccddeeff00112233445566778899', //should generate and use random hex string
			'salt-for-iv' : '00112233445566778899aabbccddeeff' //should generate and use random hex string
		}
	};
	var host = default_config.server.host;
	var port = default_config.server.port;
	
	if(config && config.server && config.server.host) host = config.server.host;
	if(config && config.server && config.server.port) port = config.server.port;

	var client = net.connect({host: host, port: port}, function () {
		// 'connect' listener
		client.setEncoding('utf8');
		
		client.id = metaData.data.id;
		
		console.log('client to server' + config.server.host + ':' + config.server.port+ ' : connected to server!');
		
		var conn_wrap = new connection_wrap(client);
		if(config.use_secure_layer) {
			conn_wrap.sl = SecureLayer('client');
		}
		
		conn_wrap.sendMessage(metaData);

		conn_wrap.on('close', function(){
			console.log('\033[31m	client to server ' + config.server.host + ':' + config.server.port + ' : disconnection!\033[39m');
			//process.exit(0);
		});

		conn_wrap.on('error', function(){
			console.log('\033[31m	client to server ' + config.server.host + ':' + config.server.port + ' : error!\033[39m');	
			//process.exit(1);
		});
		
		conn_wrap.on('init', function(rev_msg){
			conn_wrap.sendMessage(metaData);
		});

		conn_wrap.on('work', function(rev_msg){
			//init to AES mode
			conn_wrap.sl &&
			conn_wrap.sl.init('secret',
					new Buffer(metaData.data['salt-for-key'], 'hex'), 
					new Buffer(metaData.data['salt-for-iv'], 'hex'));
			
			setInterval(function(){
				conn_wrap.sendMessage({type:"heart-beat"});
			}, 60*1000);
			
			/*
			setInterval(function(){
				conn_wrap.get('sycn-time', function(err, message){
					if(err){
						console.log("get sycn-time error");
					}else{
						//console.log(JSON.stringify(message));
					}
				});
			}, 10000);*/
			
			cb(null, conn_wrap);
		});

		conn_wrap.on('refuse', () => {
			console.log('client to server ' + config.server.host + ':' + config.server.port + ' : refuse connection!');
			client.end();
			cb(new Error('refuse'));
		});

		conn_wrap.on('end', function(){
			console.log('client to server ' + config.server.host + ':' + config.server.port + ' : disconnected from server');
		});
		
	});
}

exports.createServer = createServer;
exports.createConnection = createConnection;