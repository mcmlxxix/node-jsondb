/**
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
			{ path:	"path/to/data", lock: <lock type> },
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
var jp = require('node-jpath');

/* database object definition */
function JSONdb(name) {
	this.name = name;
	this.users = {};
	this.data = {};
	this.metadata = {};
	this.counter = 0;

	log(this.name + ' db created');
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
	return handleRequest.call(this,request,lock,callback);
}
JSONdb.prototype.unlock = function(request,callback) {
	return handleRequest.call(this,request,unlock,callback);
}

/* database queries */
JSONdb.prototype.read = function(request,callback) {
	return handleRequest.call(this,request,read,callback);
}
JSONdb.prototype.write = function(request,callback) {
	return handleRequest.call(this,request,write,callback);
}

/* record properties */
JSONdb.prototype.isSubscribed = function(request,callback) {
	return handleRequest.call(this,request,isSubscribed,callback);
}
JSONdb.prototype.isLocked = function(request,callback) {
	return handleRequest.call(this,request,isLocked,callback);
}

/* private functions */
function handleRequest(request,func,callback) {
	if(request.id == null)
		request.id = "L" + this.counter++;
	if(request.time == null)
		request.time = process.hrtime().toString();
	var response = [];
	for(var i=0;i<request.data.length;i++) {
		response = response.concat(func.call(this,request.data[i],request.id,callback));
	}
	if(typeof callback == "function")
		callback(response);
	return response;
}
function read(query,clientID) {
	return jp.select(this.data,query);
}
function write(query,clientID) {
	return jp.update(this.data,query);
}
function lock(query,clientID) {
	var path = getPath(query.path);
	var data = getMetadata.call(this,query);
	if(data.length == 0) {
		this.metadata[query.path] = newMetadata();
		this.metadata[query.path].lock[clientID] = query.lock;
		data.push(this.metadata[query.path]);
	}
	else {
		for(var i=0;i<data.length;i++) {
			
		}
	}
	query.data = data;
	return query;
}
function unlock(query,clientID) {
	var path = getPath(query.path);
	if(this.metadata[path] != null) {
		delete this.metadata[path].lock[clientID];
		var data = getMetadata(path);
		for(var i=0;i<data.length;i++) {
			for(var s in data[i].subscribe) {
				var callback = data[i].subscribe[s];
				if(typeof callback == "function") {
					callback(query);
				}
			}
		}
	}
	query.data = this.metadata[path];
	return query;
}
function subscribe(query,clientID,callback) {
	var path = getPath(query.path);
	if(this.metadata[path] == null) {
		this.metadata[path] = newMetadata();
	}
	this.metadata[path].subscribe[clientID] = callback;
	query.data = this.metadata[path];
	return query;
}
function unsubscribe(query,clientID) {
	var path = getPath(query.path);
	if(this.metadata[path] != null) {
		delete this.metadata[path].subscribe[clientID];
	}
	query.data = this.metadata[path];
	return query;
}
function isSubscribed(query,clientID) {
	var path = getPath(query.path);
	var data = getMetadata.call(this,query);
	if(data.length == 0) {
		query.value = false;
	}
	else {
		query.value = true;
	}
	query.data = data;
}
function isLocked(query,clientID) {
	var path = getPath(query.path);
	query.lock = getLock.call(this,path);
	return query;
	//result = result.concat(jp.update(this.metadata,query[i]));
}
function getPath(path) {
	return path.match(/([A-Za-z0-9_\*@\$\(\)]+(?:\[.+?\])?)/g).join("/");
}
function getMetadata(path) {
	var data = [];
	for(var j in this.metadata) {
		/* if a child or parent of this query path matches existing metadata */
		if(j.match(path) || path.match(j)) {
			data.push(this.metadata[j]);
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
function log(str) {
	console.log('jsondb: ' + str);
}

/* public methods */
exports.create = function(namespace) {
	return new JSONdb(namespace);
}
