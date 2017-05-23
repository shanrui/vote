const crypto = require('crypto');
const fs = require('fs');

function SecureLayer(end){
	var key, iv, public_key, private_key, inited;
	
	inited = false;
	public_key = fs.readFileSync('./keys/rsa_public_key.pem');
	private_key = fs.readFileSync('./keys/rsa_private_key.pem');

	function privateEncrypt(text){
		var buffer = new Buffer(text);
		var en = crypto.privateEncrypt(private_key, buffer);
		return en.toString('hex');
	}
	
	function privateDecrypt(text){
		var buffer = new Buffer(text, 'hex');
		var de = crypto.privateDecrypt(private_key, buffer);
		return de.toString();
	}
	
	function publicEncrypt(text){
		var buffer = new Buffer(text);
		var en = crypto.publicEncrypt(public_key, buffer);
		return en.toString('hex');
	}
	
	function publicDecrypt(text){
		var buffer = new Buffer(text, 'hex');
		var de = crypto.publicDecrypt(public_key, buffer);
		return de.toString();
	}
	
	function init(secret, salt1, salt2){
		key = crypto.pbkdf2Sync(secret, salt1, 100000, 24, 'sha512');
		iv = crypto.pbkdf2Sync(secret, salt2, 100000, 16, 'sha512');
		inited = true;		
	}
	
	function encrypt (text){
		if(!inited ){ return end === 'server' ? privateEncrypt(text) : publicEncrypt(text); }
		//const cipher = crypto.createCipher('aes192', key);
		const cipher = crypto.createCipheriv('aes192', key, iv);
		var encrypted = cipher.update(text, 'utf8', 'hex');
		encrypted += cipher.final('hex');
		return encrypted;
	}
	
	function decrypt (text){
		if(!inited ){ return end === 'server' ? privateDecrypt(text) : publicDecrypt(text); }
		//const decipher = crypto.createDecipher('aes192', key);
		const decipher = crypto.createDecipheriv('aes192', key, iv);
		var encrypted = text;
		var decrypted = decipher.update(encrypted, 'hex', 'utf8');
		decrypted += decipher.final('utf8');
		return decrypted;
	}
	
	function inited(){
		return inited;
	} 
	
	return {
		publicEncrypt: publicEncrypt,
		publicDecrypt : publicDecrypt,
		privateEncrypt : privateEncrypt,
		privateDecrypt: privateDecrypt,
		init : init,
		encrypt : encrypt,
		decrypt : decrypt
	}
}

//test

//var sl = SecureLayer();
//var encrypted =  sl.encrypt("I am not hanppy!");
//console.log(encrypted);
//var decrypt =  sl.decrypt(encrypted);
//console.log(decrypt);

//var buffer = new Buffer('hello');
//var e1 = crypto.privateEncrypt(private_key, buffer);
//var e2 = crypto.publicDecrypt(public_key, e1);
//console.log(e2.toString());


/*
sl.init('s', new Buffer('12fe', 'hex'), new Buffer('12ff', 'hex'));
var encrypted =  sl.encrypt("I am not hanppy!");
console.log(encrypted);
var decrypt =  sl.decrypt(encrypted);
console.log(decrypt);
*/

module.exports = SecureLayer;