/**
 * Message router.
 */
 
//var handlers = require('./message_handlers');
function Router(){
	var maps = {
			get : {},
			post : {},
			put : {},
			del : {},
			empty : {}
	};
	var context = {};
	var noop  = function(){};
	return {
		route : function(method, message_type){
			if('' === method){
				return function(conn_wrap, message){
					var handler = maps.empty[message_type] || noop;
					handler(context, conn_wrap, message);
				};
			}
			return function(conn_wrap, message){
				var handler = maps[method.toLowerCase()][message_type] || noop;
				handler(context, conn_wrap, message);
			};
		},

		map : function(message_type, callback){
			maps.empty[message_type] = callback;
		},

		get : function(message_type, callback){
			maps.get[message_type] = callback;
		},

		post : function(message_type, callback){
			maps.post[message_type] = callback;
		},

		put : function(message_type, callback){
			maps.put[message_type] = callback;
		},

		del : function(message_type, callback){
			maps.del[message_type] = callback;
		},
		
		setContext : function (key, value){
			context[key]=value;
		}
	}
}

/*
Router.prototype.route = function(method, message_type){
//	this.context = context;
	if('' === method){
		return  this.maps.empty[message_type];		
	}
	return  this.maps[method][message_type];
};

Router.prototype.map = function(message_type, callback){
	this.maps.empty[message_type] = callback;
};

Router.prototype.get = function(message_type, callback){
	this.maps.get[message_type] = callback;
};

Router.prototype.post = function(message_type, callback){
	this.maps.post[message_type] = callback;
};

Router.prototype.put = function(message_type, callback){
	this.maps.put[message_type] = callback;
};

Router.prototype.del = function(message_type, callback){
	this.maps.del[message_type] = callback;
};
*/

module.exports = Router;