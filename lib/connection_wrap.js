var util = require("util");  
var events = require("events");//EventEmitter通过events模块来访问
var moment = require("moment-timezone")

//var wait_re_message_time = config.wait_re_message_time || 10;
//	wait_re_message_time *= 1000;

//var time_zone = config.time_zone || 'Asia/Shanghai';

var default_opts = {
	wait_re_message_time : 10,
	time_zone : 'Asia/Shanghai'
}

function ConnectionWrap(conn, opts) {//新建一个类  
	events.EventEmitter.call(this);
	this.conn = conn;
	this.conn.setEncoding('utf8');
	this.sl = null;
	this.opts = opts || {};
	
	this.opts.wait_re_message_time = this.opts.wait_re_message_time || default_opts.wait_re_message_time;
	this.opts.wait_re_message_time *= 1000;

	this.opts.time_zone = this.opts.time_zone || default_opts.time_zone;
	
	var _self = this;
		buffer = '';

	conn.on('close', function(){
		_self.emit('close');		
	});

	conn.on('error', function(){
		_self.emit('error');
	});
	
	conn.on('end', function(){
		_self.emit('end');
	});

	conn.on("data", function(data){
		process.stdout.write("\033[90m"+ moment().tz(_self.opts.time_zone).format("k:mm:ss a, MM-DD") + "\033[39m");
		_self.conn.id && process.stdout.write('\033[90m	| '+ _self.conn.id +' |\033[39m');
		process.stdout.write("\033[90m	recive data:\033[39m\n");
		process.stdout.write('\033[90m' + data+'\033[39m\n');
		//decrypt
		if(_self.sl){
			data = _self.sl.decrypt(data);
			process.stdout.write('recive data decrypted:\n');		
			process.stdout.write(data + '\n');
		}

		if (data.indexOf('\r\n') > -1) { // If there's more than one line in the buffer
			var count = countSubstr(data, '\r\n');
			var lines = data.split('\r\n'); // Split the lines
			for(var i =0; i < count; i++) { // This will read your lines in reverse, be careful
				if(lines[i].length > 0){
					buffer += lines[i];   // Print each line
					_self.handleMessage(buffer);
					buffer = '';
				}
			}
			if(count < lines.length){
				buffer += lines[count];
			}
			/*for(var i =0; i < lines.length; i++) { // This will read your lines in reverse, be careful
				if(lines[i].length > 0){
					buffer += lines[i];   // Print each line
					_self.handleMessage(buffer);
					buffer = '';
				}
			}*/
		} else {
			buffer += data;
		}
	});
}

function countSubstr(str,substr){
   var count;
   var reg = new RegExp(substr, "gi");
   if(str.match(reg)==null){
		count=0;
   }else{
		count=str.match(reg).length;
   }
   return count;
}
  
util.inherits(ConnectionWrap, events.EventEmitter);//使这个类继承EventEmitter  

ConnectionWrap.prototype.write = function(data) {
    this.conn.write(data);
}

ConnectionWrap.prototype.handleMessage = function(data){
	try{
		var dataObj = JSON.parse(data);
	}catch(e){
		console.log("handler message: data format error!");	
		return;		
	}
	var method = dataObj.method ? (dataObj.method.toUpperCase() + ':') : '';
	if(dataObj.type){
		if('RE' === dataObj.method){
			dataObj.id && this.emit(dataObj.id, dataObj);
		}else{
			this.emit(method + dataObj.type, dataObj);
			this.emit('req-message', dataObj);
			this.emit('req-message-string', data);
			/*if(this.route){
				this.route(dataObj.method || '', dataObj.type)(this, dataObj);
			}*/
		}
		this.emit('*', dataObj);
	}else{
		console.log("no handler to message:"+data);
	}
}

//发送一个消息包
ConnectionWrap.prototype.sendMessage = function(message){
	var msg = '';
	if(util.isString(message)){
		msg = message + '\r\n';
	}else{
		msg = JSON.stringify(message) + '\r\n';		
	}
	process.stdout.write("\033[90m"+ moment().tz(this.opts.time_zone).format("k:mm:ss a, MM-DD") + "\033[39m");
	this.conn.id && process.stdout.write('\033[90m	| '+ this.conn.id +' |\033[39m');
	process.stdout.write("\033[90m	send data:\033[39m\n");		
	process.stdout.write(msg+'\n');
	//encrypt
	if(this.sl){
		msg = this.sl.encrypt(msg);
		process.stdout.write('\033[90m' + 'send data encrypted:'+'\033[39m\n');		
		process.stdout.write('\033[90m' + msg + '\033[39m\n');
	}
	this.write(msg);
	
	this.emit('rsp-message', message);
}

/** 发送消息的四个包装方法 **/
//method: GET ->
ConnectionWrap.prototype.get = function(messageType, query, callback){
	var msg = {
		method : "GET",
		type : messageType
	};
	
	if(arguments.length === 2){
		callback = query;
	}else if(arguments.length === 3){
		msg.query = query;
	}
	
	new MessageTask(this, msg, this.opts.wait_re_message_time, callback);
	/*
	this.write(JSON.stringify(msg) + '\r\n');
	var _self =this;
	
	var timerId = 
	setTimeout(function(){
		_self.removeAllListeners('RE:'+messageType);
		callback(new Error('Communication timeout!'));		
	},30000);
	
	this.once('RE:'+messageType, function(data){
		clearTimeout(timerId);
		callback(null, data);
	});
	*/
}
	
//method: put ->
ConnectionWrap.prototype.put = function(messageType, data, callback){
	var msg = {
		method : "PUT",
		type : messageType,
		data : data
	};
	
	new MessageTask(this, msg, this.opts.wait_re_message_time, callback);	
	/*
	var timerId;
	this.write(JSON.stringify(msg) + '\r\n');
	var _self =this;
	timerId = 
	setTimeout(function(){
		_self.removeAllListeners('RE:'+messageType);
		callback(new Error('Communication timeout!'));
	},30000);
	
	this.once('RE:'+messageType, function(data){
		clearTimeout(timerId);
		callback(null, data);
	});
	*/
}

//method: post ->
ConnectionWrap.prototype.post = function(messageType, data, callback){
	var msg = {
		method : "POST",
		type : messageType,
		data : data
	};
	new MessageTask(this, msg, this.opts.wait_re_message_time, callback);
}

//method: del ->
ConnectionWrap.prototype.del = function(messageType, query, callback){
	var msg = {
		method : "DEL",
		type : messageType,
		query : query
	};
	new MessageTask(this, msg, this.opts.wait_re_message_time, callback);
}

/** 处理消息的包装方法 **/
//method: RE <-
ConnectionWrap.prototype.re = function(recv_msg, type){
	var msg = {
		id : recv_msg.id,
		method : "RE",
		type : type ? type : recv_msg.type,
		success : is_success
	};
	if(send_data){
		msg.data = send_data;
	}
	this.sendMessage(msg);
}

//method: RE error<-
ConnectionWrap.prototype.re_error = function(recv_msg, error_code, error_message){
	var msg = {
		id : recv_msg.id,
		method : "RE",
		type : recv_msg.type,
		error_code : error_code,
		error_message : error_message
	};
	this.sendMessage(msg);
}

//method: RE success<-
ConnectionWrap.prototype.re_success = function(recv_msg, send_data){
	var msg = {
		id : recv_msg.id,
		method : "RE",
		type : recv_msg.type,
		success : true
	};
	if(send_data){
		msg.data = send_data;
	}
	this.sendMessage(msg);
}

//method: GET <-
ConnectionWrap.prototype.onGet = function(messageType, callback){
	this.on('GET:'+messageType, callback);
}
//method: POST <-
ConnectionWrap.prototype.onPost = function(messageType, callback){
	this.on('POST:'+messageType, callback);
}
//method: PUT <-
ConnectionWrap.prototype.onPut = function(messageType, callback){
	this.on('PUT:'+messageType, callback);
}
//method: DEL <-
ConnectionWrap.prototype.onDel = function(messageType, callback){
	this.on('DEL:'+messageType, callback);
}



//发送消息并等待应答
function MessageTask(connWarp, message, outTime, callback){
	var _self = this;
	this.msg_id = generateMsgId();

	message.id = this.msg_id;
	connWarp.sendMessage(message);

	if(typeof callback === 'function'){
		this.timerId = 
		setTimeout(function(){
			connWarp.removeAllListeners(_self.msg_id);
			callback(new Error('Communication timeout!'));		
		}, outTime);
		
		connWarp.once(this.msg_id, function(data){
			clearTimeout(_self.timerId);
			callback(null, data);
		});		
	}
}

function generateMsgId(){
	return '' + process.pid + (new Date()).getTime();
}

module.exports = ConnectionWrap;