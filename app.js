//var Promise = require('promise');
var Router = require('./lib/message_route');
var tcp_moudle = require('./lib/tcp_moudle');

var config = require('./config');

/**
 * Set message router.
 */

var s_router = new Router();
s_router.setContext('prop', 'value');

s_router.get('sycn-time', function sycn_time(context, conn_wrap, message){
	var value = context.prop;
	conn_wrap.re_success(message, (new Date()).getTime());
});

s_router.get('test', function(context, conn_wrap, message){
	var value = context.prop;
	conn_wrap.re_success(message, 'test-data');
	console.log('server <-- get:test:from ' + conn_wrap.conn.id);
});

s_router.get('isMaster', function(context, conn_wrap, message){
	conn_wrap.re_success(message, inner_config);
	console.log('server <-- get:isMaster:from ' + conn_wrap.conn.id);
});

s_router.get('vote', function(context, conn_wrap, message){
	if(!inner_config.isMaster && !inner_config.in_try_election){
		hasPrimary()
		.then((re)=>{
			if(re){
				conn_wrap.re_success(message, 'no');				
			}else{
				conn_wrap.re_success(message, 'ok');				
			}
		})
	}else{
		conn_wrap.re_success(message, 'no');		
	}
});

//

var node_conf;

if(process.argv[2]){
	node_conf = require(process.argv[2]);
}else{
	return console.log('usage: node app.js [json config file]')
}

config.server = node_conf.server;

var conns = {};
var inner_config = node_conf; 

inner_config.isMaster = false;
inner_config.primary = null;

var server = tcp_moudle.createServer(s_router, config);
server.start({port:node_conf.server.port});


keepConnect();

setInterval(function(){
	keepConnect();
}, 60*1000);


checkIfNeedElection();


process.on('uncaughtException', function(err) {
	console.log(err);
});



function checkIfNeedElection(){
	var check_if_need_election_timer;
	
	check_if_need_election();

	function check_if_need_election(){
		console.log('check_if_need_election');
		
		if(!isMajarityTouched()){
			console.log('no majarity touched');
			inner_config.isMaster = false;
			inner_config.primary = null;
			
			tick(10);
			return;
		}

		console.log('has primary?');
		if(inner_config.isMaster || (inner_config.primary !== null && conns[inner_config.primary])){ //has primary
			console.log('has primary?yes');
			tick(10);
		}else{
			console.log('has primary?no');
			inner_config.isMaster = false;
			inner_config.primary = null;

			inner_config.in_try_election = true;
			try_election()
			.then( re => {
				inner_config.isMaster = true;
				inner_config.primary = node_conf.id;
				inner_config.in_try_election = false;
				tick(60);
			})
			.catch(re => {
				inner_config.in_try_election = false;
				if(re === 0){  //'no conn majarity'
					tick(10);
				}
				else if(re === 1){  //'had primary'
					tick(60);
				}else if( re === 2){  //'no ok majarity'
					let random_wating = 5 + Math.floor(Math.random()*30);
					tick(random_wating);
				}else{
					tick(30);		
				}
			});
		}
	}
	
	function tick(second){
		clearTimeout(check_if_need_election_timer);
		
		check_if_need_election_timer =
		setTimeout(function(){
			check_if_need_election();
		}, second*1000);
	}
}


//
function isMajarityTouched(){
	var touch_count = 0;
	var majarity = (Math.floor(node_conf.nodes.length/2)+1);
	
	node_conf.nodes.forEach((ele) => {
		if( ele.id === node_conf.id){
			touch_count++;
		}else if(conns[ele.id]){
			touch_count++;
		}
	});
	return touch_count >= majarity
}

function try_election(){
	console.log('try_election');
	return new Promise((resolve, reject) => {
		var touch_count = 0;
		var majarity = (Math.floor(node_conf.nodes.length/2)+1);
		
		node_conf.nodes.forEach((ele) => {
			if( ele.id === node_conf.id){
				touch_count++;
			}else if(conns[ele.id]){
				touch_count++;
			}
		});
		
		if( touch_count < majarity ){
			return reject(0);	//'no conn majarity'
		}
		
		var hasPrimaryRe = hasPrimary();
		
		hasPrimaryRe.then( m => {
			if(m !== null){
				console.log('hasPrimary', m.node);
				inner_config.isMaster = false;
				inner_config.primary = m.node;
				return reject(1);	//'hasPrimary'
			}
		});
		
		hasPrimaryRe.then( m => {
			if(m === null ){
				console.log('getVotes');
				return getVotes();
			}else{
				return reject(1);	//'hasPrimary'
			}
		})
		.then( re => {
			var c = 0;
			re.forEach( e => {
				if(e && e.message && e.message.data === 'ok'){
					c++;
				}
			});
			if(c < majarity){
				console.log('vote fail: no ok majarity');
				return reject(2); //'no ok majarity'
			}else{
				console.log('vote success: ok majarity');
				return resolve();
			}
		})
	});
}

function hasPrimary(){
	return new Promise((resolve, reject) => {
		sendToConns('get', 'isMaster')
		.then(re => {
			var m = null;
			console.log('hasPrimary:', JSON.stringify(re));
			re.forEach(e =>{
				if(e && e.message && e.message.data && e.message.data.isMaster){
					m = e;
				}
			});
			resolve(m);
		});
	});
}

function getVotes(){
	return new Promise((resolve, reject) => {
		sendToConns('get', 'vote')
		.then(re => {
			resolve(re);
		});
	});
}

function keepConnect(){
	node_conf.nodes.forEach((ele) => {
		if( ele.id === node_conf.id) return;
		if(conns[ele.id]) return;
		tcp_moudle.createConnection({
				server : ele.server,
				use_secure_layer : false,
				id : node_conf.id
			}, function(err, conn_warp){
			if(err) return;
			
			conns[ele.id] = conn_warp;
			
			conn_warp.on('close', () => { console.log('close', ele.id); delete conns[ele.id] });
			conn_warp.on('error', () => { console.log('error', ele.id); delete conns[ele.id] });
			
			console.log('connection --> get:test:null');
			conn_warp.get('test', null, (err, msg) => {
				console.log('connection <-- get:test:' + msg.data);
			})
		});
	});
}

function sendToConns(method, type, data){
	return Promise.all(
		node_conf.nodes.map((ele) => {
			return new Promise((resolve, reject) => {
				if(conns[ele.id]){
					conns[ele.id][method](type, data, (err, msg) => {
						if(err){
							resolve(null)
						}else{
							resolve({node: ele.id, message: msg});
						}
					});
				}else{
					resolve(null);
				}
			});
		})
	);
}