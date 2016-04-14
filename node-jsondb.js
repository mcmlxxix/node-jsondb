/**	node.js json shared-object database - mcmlxxix - 2016

	DATABASE PACKET STRUCTURE
		request={
			id: <client id>,
			db: <database name>,
			oper: <db operation>,
			data: <see below>
		};
	
	READ QUERY
		data = [
			{ path:"path/to/data" },
			...
		];
	
	WRITE QUERY
		data = [
			{ path:"path/to/data", key:"child_property", value:"value_to_be_written" },
			...
		];
	
	LOCK QUERY
		data = [
			{ path:	"path/to/data", lock: <see lock types> },
			...
		];
		
	SUBSCRIPTION QUERY
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

/* global constants */
const rxPath =				/([A-Za-z0-9_\*@\$\(\)]+(?:\[.+?\])?)/g;
const DELIMITER = 			"/";

/* lock types */
const READ = 				"r";
const WRITE = 				"w";

/* lock-level options */
const NONE = 				null;
const RECORD = 				"record";
const TRANS = 				"transaction";
const FULL = 				"full";

/* error types */ 
const ERROR_NONE =			0;
const ERROR_INVALID_PATH = 	1;
const ERROR_LOCK_WRITE = 	2;
const ERROR_LOCK = 			3;
const ERROR_UNLOCK = 		4;
const ERROR_WRITE = 		5;
const ERROR_READ = 			6;

/* database object definition */
function JSONdb(name) {
	this.name = name;
	this.settings = new Settings(/* Defaults=locking:NONE, maxConnections:0 */);

	this.clients = {};
	this.data = {};
	this.metadata = {};
	
	this.counter = 0;
	//this.selection = [];

	log(this.name + ' db created');
}

/* database settings */
function Settings(locking,maxConnections) {
	var maxConnections = 0;
	var locking = NONE;
	this.__defineGetter__('locking',function() {
		return locking;
	});
	this.__defineSetter__('locking',function(value) {
		switch(value.toLowerCase()) {
		case NONE:
		case RECORD:
		case TRANS:
		case FULL:
			locking = value.toLowerCase();
			break;
		default:
			break;
		}
	});
	this.__defineGetter__('maxConnections',function() {
		return maxConnections;
	});
	this.__defineSetter__('maxConnections',function(value) {
		if(value >=0 && value < 999999)
			maxConnections = value;
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
	if(this.settings.locking == NONE) {
		/* send error - locks disabled */
	}
	else if(this.settings.locking == FULL) {
		return handleRequest.call(this,request,lockAll,callback);
	}
	else if(this.settings.locking == RECORD) {
		return handleRequest.call(this,request,lockRecord,callback);
	}
	else if(this.settings.locking == TRANS) {
		return handleRequest.call(this,request,lockTransaction,callback);
	}
}
JSONdb.prototype.unlock = function(request,callback) {
	if(this.settings.locking == NONE) {
		/* send error - locks disabled */
	}
	else if(this.settings.locking == FULL) {
		return handleRequest.call(this,request,unlockAll,callback);
	}
	else if(this.settings.locking == RECORD) {
		return handleRequest.call(this,request,unlockRecord,callback);
	}
	else if(this.settings.locking == TRANS) {
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
	var response = [];
	for(var i=0;i<request.data.length;i++) {
		var result = func.call(this,request,request.data[i],callback);
		if(result == null) {
			/* failed request? */
		}
		else {
			response = response.concat(result);
		}
	}
	if(typeof callback == "function")
		callback(response);
	return response;
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
	if(this.settings.locking == RECORD) {
		for(var i=0;i<result.length;i++) {
			/* convert path to / delimited string */
			var path = getPath(result[i].path);
			/* find any existing metadata which may match this path */
			var metadata = getMetadata.call(this,query);
			/* find locks in metadata */
			if(canRead(request,metadata) == false) {
				result[i].status = ERROR_READ;
				result[i].value = null;
			}
			else {
				result[i].status = ERROR_NONE;
			}
		}
	}
	else if(this.settings.locking == NONE) {
		for(var i=0;i<result.length;i++) {
			result[i].status = ERROR_NONE;
		}
	}
	return result;
}
function write(request,query) {
	jp.settings.create = true;
	var result = jp.select(this.data,query);
	jp.settings.create = false;
	/* if we are locking individual records */
	if(this.settings.locking == RECORD) {
		for(var i=0;i<result.length;i++) {
			/* convert path to / delimited string */
			var path = getPath(result[i].path + "/" + result[i].key);
			/* find any existing metadata which may match this path */
			var metadata = getMetadata.call(this,query);
			/* find locks in metadata */
			if(canWrite(request,metadata) == false) {
				query.status = ERROR_WRITE;
				result[i].value = null;
			}
			else {
				query.status = ERROR_NONE;
				result[i].value[query.key] = query.value;
			}
		}
	}
	/* special scenario where if we arent doing any record locking, distribute updates immediately */
	else if(this.settings.locking == NONE) {
		for(var i=0;i<result.length;i++) {
			query.status = ERROR_NONE;
			result[i].value[query.key] = query.value;
		}
		unlockAll.call(this,request,query);
	}
	return query;
}
function lockRecord(request,query) {
	var result = jp.select(this.data,query);
	for(var i=0;i<result.length;i++) {
		/* convert path to / delimited string */
		var path = getPath(result[i].path);
		/* find any existing metadata which may match this path */
		var metadata = getMetadata.call(this,path);
		/* find locks in metadata */
		if(isLocked(metadata)) {
			result[i].status = ERROR_LOCK;
		}
		/* if there is no lock data that matches this path, set the specified lock */
		else {
			result[i].status = ERROR_NONE;
			setLock.call(this,request,path);
		}
	}
	return result;
}
function unlockRecord(request,query) {
	var result = jp.select(this.data,query);
	for(var i=0;i<result.length;i++) {
		var path = getPath(result[i].path);
		result[i].status = ERROR_NONE;
		remLock.call(this,request,path,result[i]);
	}
	return result;
}
function lockAll(request,query) {
	if(this.metadata[DELIMITER] == null || !(this.metadata[DELIMITER].hasOwnProperty('lock')))
	this.metadata[DELIMITER] = newMetaData();
	this.metadata[DELIMITER].lock[request.clientID] = request.lock;
	return null;
}
function unlockAll(request,query) {
	if(this.metadata[DELIMITER] != null && this.metadata[DELIMITER].hasOwnProperty('lock')) 
		delete this.metadata[DELIMITER].lock[request.clientID];	
	var path = getPath(query.path);
	var metadata = getMetadata.call(this,path);
	sendUpdates.call(this,query,request.clientID,metadata);
	return null;
}
function lockTransaction(request,query) {
	return null;
}
function unlockTransaction(request,query) {
	return null;
}
function subscribe(request,query,callback) {
	var path = getPath(query.path);
	if(this.metadata[path] == null) {
		this.metadata[path] = newMetadata();
	}
	this.metadata[path].subscribe[request.clientID] = callback;
	query.data = this.metadata[path];
	return query;
}
function unsubscribe(request,query) {
	var path = getPath(query.path);
	if(this.metadata[path] != null) {
		delete this.metadata[path].subscribe[request.clientID];
	}
	query.data = this.metadata[path];
	return query;
}
function setLock(request,path) {
	//log("locking: " + path);
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
	if(rxPath.test(path))
		return path.match(/([A-Za-z0-9_\*@\$\(\)]+(?:\[.+?\])?)/g).join(DELIMITER);
	else if(path == "" || path == null || /[*\/]/.test(path))
		return DELIMITER;
	else
		return path;
}
function isLocked(metadata) {
	for(var m in metadata) {
		for(var l in metadata[m].lock) {
			if(metadata[m].lock[l] != null) {
				return true;
			}
		}
	}
	return false;
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
	return data;
}
function newMetadata() {
	return {
		lock:{},
		subscribe:{}
	};
}
function error(e,str) {
	return util.format(e,str);
}
function log(str) {
	console.log('jsondb: ' + str);
}

/* public methods */
exports.create = function(namespace) {
	return new JSONdb(namespace);
}
