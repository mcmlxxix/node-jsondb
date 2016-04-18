/**	node.js json shared-object database - mcmlxxix - 2016

	DATABASE PACKET STRUCTURE
		request={
			id: <client id>,
			db: <database name>,
			oper: <db operation>,
			data: <see below>
		};
	
	oper = READ
		data = [
			{ path:"path/to/data" },
			...
		];
	
	oper = WRITE
		data = [
			{ path:"path/to/data", key:"child_property", value:"value_to_be_written" },
			...
		];
	
	oper = UN/LOCK
		data = [
			{ path:	"path/to/data", lock: <see lock types> },
			...
		];
		
	oper = UN/SUBSCRIBE
		data = [
			{ path:	"path/to/data" },
			...
		];
		
	LOCK TYPES
		read = "r"
		write = "w"
		append = "a"	

**/

var fs = require('fs');
var util = require('util');
var jp = require('node-jpath');
var oper = require('./lib/constant').oper;
var err = require('./lib/constant').error;
var lock = require('./lib/constant').lock;

/* global constants */
const RXPATH =				/([A-Za-z0-9_\*@\$\(\)]+(?:\[.+?\])?)/g;
const DELIMITER = 			"/";

/* database object definition */
function JSONdb(name) {
	this.name = name;
	this.settings = new Settings(/* Defaults=locking:lock.NONE, maxConnections:0 */);

	this.clients = {};
	this.data = {};
	this.metadata = {};
	
	this.counter = 0;
	//this.selection = [];

	log(this.name + ' db created');
}

/* database settings */
function Settings(locking,maxConnections) {
	var m = 0;
	var l = lock.NONE;
	
	this.__defineGetter__('locking',function() {
		return l;
	});
	this.__defineSetter__('locking',function(value) {
		switch(value.toLowerCase()) {
		case lock.NONE:
		case lock.TRANS:
		case lock.FULL:
			l = value.toLowerCase();
			break;
		default:
			break;
		}
	});
	this.__defineGetter__('maxConnections',function() {
		return m;
	});
	this.__defineSetter__('maxConnections',function(value) {
		if(value >=0 && value < 999999)
			m = value;
	});
}

/* data methods */
JSONdb.prototype.load = function(fileName) {
	this.data = JSON.parse(fs.readFileSync(fileName),'utf8');
	log(this.name + ' db loaded from ' + fileName);
}
JSONdb.prototype.save = function(fileName) {
	fs.writeFileSync(fileName,JSON.stringify(this.data),'utf8');
	log(this.name + ' db saved to ' + fileName);
}

/* database subscriptions */
JSONdb.prototype.subscribe = function(request,callback) {
	return handleRequest.call(this,request,subscribe,callback);
}
JSONdb.prototype.unsubscribe = function(request,callback) {
	return handleRequest.call(this,request,unsubscribe,callback);
}

/* record locking */
JSONdb.prototype.lock = function(request,callback) {
	if(this.settings.locking == lock.NONE) {
		/* send error - locks disabled */
	}
	else if(this.settings.locking == lock.FULL) {
		return handleRequest.call(this,request,lockAll,callback);
	}
	else if(this.settings.locking == lock.TRANS) {
		return handleRequest.call(this,request,lockTransaction,callback);
	}
}
JSONdb.prototype.unlock = function(request,callback) {
	if(this.settings.locking == lock.NONE) {
		/* send error - locks disabled */
	}
	else if(this.settings.locking == lock.FULL) {
		return handleRequest.call(this,request,unlockAll,callback);
	}
	else if(this.settings.locking == lock.TRANS) {
		return handleRequest.call(this,request,unlockTransaction,callback);
	}
}

/* database queries */
JSONdb.prototype.read = function(request,callback) {
	return handleRequest.call(this,request,read,callback);
}
JSONdb.prototype.write = function(request,callback) {
	return handleRequest.call(this,request,write,callback);
}

/* private functions */
function handleRequest(request,func,callback) {
	if(request.id == null)
		request.id = "L" + this.counter++;
	if(request.time == null)
		request.time = process.hrtime().toString();
	var data = [];
	for(var i=0;i<request.data.length;i++) {
		var result = func.call(this,request,request.data[i],callback);
		if(result == null) {
			/* failed request? */
		}
		else {
			data = data.concat(result);
		}
	}
	request.data = data;
	if(typeof callback == "function")
		callback(request);
	return request;
}
function sendUpdates(response,clientID,metadata) {
	for(var i in metadata) {
		for(var s in metadata[i].subscribe) {
			//if(i == clientID)
				//continue;
			var callback = metadata[i].subscribe[s];
			if(typeof callback == "function") {
				callback(jp.select(this.data,response));
			}
		}
	}
}
function read(request,query) {
	var result = jp.select(this.data,query);
	if(this.settings.locking == lock.TRANS) {
		var status = err.NONE;
		for(var i=0;i<result.length;i++) {
			/* convert path to / delimited string */
			var path = getPath(result[i].path);
			/* find any existing metadata which may match this path */
			var metadata = getMetadata.call(this,path);
			/* find locks in metadata */
			if(canRead(request,metadata) == false) {
				status = err.READ;
				break;
			}
		}
		if(status == err.READ) {
			for(var i=0;i<result.length;i++) {
				delete result[i].value;
			}
		}
		request.status = status;
	}
	else if(this.settings.locking == lock.NONE) {
		// for(var i=0;i<result.length;i++) {
			// result[i].status = NONE;
		// }
		request.status = err.NONE;
	}
	return result;
}
function write(request,query) {
	jp.settings.create = true;
	var result = jp.select(this.data,query);
	jp.settings.create = false;
	/* if we are locking transaction records */
	if(this.settings.locking == lock.TRANS) {
		var status = err.NONE;
		for(var i=0;i<result.length;i++) {
			/* convert path to / delimited string */
			var path = getPath(result[i].path + "/" + result[i].key);
			/* find any existing metadata which may match this path */
			var metadata = getMetadata.call(this,path);
			/* find locks in metadata */
			if(canWrite(request,metadata) == false) {
				status = err.WRITE;
				break;
				//result[i].value = null;
			}
		}
		if(status == err.NONE) {
			for(var i=0;i<result.length;i++) {
				result[i].value[query.key] = query.value;
			}
		}
		request.status = status;
	}
	/* if we arent doing any record locking, distribute updates immediately */
	else if(this.settings.locking == lock.NONE) {
		for(var i=0;i<result.length;i++) {
			result[i].value[query.key] = query.value;
		}
		unlockAll.call(this,request,query);
		request.status = err.NONE;
	}
	return result;
}
function lockTransaction(request,query) {
	var result = jp.select(this.data,query);
	var status = err.NONE;
	for(var i=0;i<result.length;i++) {
		/* convert path to / delimited string */
		var path = getPath(result[i].path);
		/* find any existing metadata which may match this path */
		var metadata = getMetadata.call(this,path);
		/* find locks in metadata */
		if(canLock(metadata) == false) {
			status = err.LOCK;
			break;
		}
	}
	if(status == err.NONE) {
		for(var i=0;i<result.length;i++) {
			var path = getPath(result[i].path);
			setLock.call(this,request,path);
		}
	}
	request.status = status;
	return result;
}
function unlockTransaction(request,query) {
	var result = jp.select(this.data,query);
	for(var i=0;i<result.length;i++) {
		var path = getPath(result[i].path);
		remLock.call(this,request,path,result[i]);
	}
	request.status = err.NONE;
	return result;
}
function lockAll(request,query) {
	if(this.metadata[DELIMITER] == null || !(this.metadata[DELIMITER].hasOwnProperty('lock')))
	this.metadata[DELIMITER] = newMetaData();
	this.metadata[DELIMITER].lock[request.clientID] = request.lock;
	request.status = err.NONE;
	return query;
}
function unlockAll(request,query) {
	if(this.metadata[DELIMITER] != null && this.metadata[DELIMITER].hasOwnProperty('lock')) 
		delete this.metadata[DELIMITER].lock[request.clientID];	
	var path = getPath(query.path);
	var metadata = getMetadata.call(this,path);
	sendUpdates.call(this,query,request.clientID,metadata);
	request.status = err.NONE;
	return query;
}
function subscribe(request,query,callback) {
	var path = getPath(query.path);
	if(this.metadata[path] == null) {
		this.metadata[path] = newMetadata();
	}
	this.metadata[path].subscribe[request.clientID] = callback;
	query.data = this.metadata[path];
	request.status = err.NONE;
	return query;
}
function unsubscribe(request,query) {
	var path = getPath(query.path);
	if(this.metadata[path] != null) {
		delete this.metadata[path].subscribe[request.clientID];
	}
	query.data = this.metadata[path];
	request.status = err.NONE;
	return query;
}
function setLock(request,path) {
	if(this.metadata[path] == null)
		this.metadata[path] = newMetadata();
	this.metadata[path].lock[request.clientID] = request.lock;
}
function remLock(request,path,response) {
	/* if there is no existing lock for this path, skip this result */
	if(this.metadata[path] == null)
		return;
	//log("unlocking: " + path);
	/* if this was a write lock */
	if(/w/i.test(this.metadata[path].lock[request.clientID])) {
		/* find any existing metadata which may match this path */
		var metadata = getMetadata.call(this,path);
		if(metadata.length > 0) {
			sendUpdates.call(this,response,request.clientID,metadata);
		}
	}
	delete this.metadata[path].lock[request.clientID];
}
function getPath(path) {
	if(RXPATH.test(path))
		return path.match(/([A-Za-z0-9_\*@\$\(\)]+(?:\[.+?\])?)/g).join(DELIMITER);
	else if(path == "" || path == null || /^[*\/]$/.test(path))
		return DELIMITER;
	else
		return path;
}
function canLock(metadata) {
	for(var m in metadata) {
		if(metadata[m].lock == null)
			continue;
		for(var l in metadata[m].lock) {
			if(metadata[m].lock[l] != null) {
				return false;
			}
		}
	}
	return true;
}
function canWrite(request,metadata) {
	for(var m in metadata) {
		if(metadata[m].lock == null)
			continue;
		if(/w/i.test(metadata[m].lock[request.clientID]))
			return true;
		for(var l in metadata[m].lock) {
			if(metadata[m].lock[l] != null) {
				return false;
			}
		}
	}
	return false;
}
function canRead(request,metadata) {
	var count = 0;
	for(var m in metadata) {
		count++;
		if(metadata[m].lock == null)
			continue;
		if(/[rw]/i.test(metadata[m].lock[request.clientID]))
			return true;
		for(var l in metadata[m].lock) {
			if(/w/i.test(metadata[m].lock[l])) {
				return false;
			}
		}
	}
	return true;
}
function getMetadata(path) {
	var data = {};
	for(var j in this.metadata) {
		/* if a child or parent of this query path matches existing metadata */
		if(j.match(path) || path.match(j)) {
			data[j] = this.metadata[j];
		}
	}
	log(JSON.stringify(data));
	return data;
}
function newMetadata() {
	return {
		lock:{},
		subscribe:{}
	};
}
function log(str) {
	console.log('jsondb: ' + str);
}

/* public methods */
module.exports.create = function(namespace) {
	return new JSONdb(namespace);
}
