/**
	DATABASE PACKET STRUCTURE
		query={
			id: <request id>,
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

const rxTokens = /([A-Za-z0-9_\*@\$\(\)]+(?:\[.+?\])?)/g;
const delimiter = "/";

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
	var response = [];
	for(var i=0;i<request.data.length;i++) {
		response = response.concat(func.call(this,request.data[i],request.id));
	}
	if(typeof callback == "function")
		callback(request,response);
	return response;
}
function read(query,clientID) {
	return jp.select(this.data,query);
}
function write(query,clientID) {
	return jp.update(this.data,query);
}
function lock(query,clientID) {
	var path = query.path.match(rxTokens)[0].join(delimiter);
	var lock = getLock.call(this,query);
	if(lock == null) {
		this.metadata[query.path] = query.lock;
	}
	else {
		
	}
	query.lock = lock;
	return query;
}
function unlock(query,clientID) {
	
}
function subscribe(query,clientID) {
	
}
function unsubscribe(query,clientID) {
	
}
function isSubscribed(query,clientID) {
	
}
function isLocked(query,clientID) {
	query.lock = getLock.call(this,query);
	return query;
	//result = result.concat(jp.update(this.metadata,query[i]));
}
function getPath(path) {
	return path.match(/([A-Za-z0-9_\*@\$\(\)]+(?:\[.+?\])?)/g)[0].join("/");
}
function getLock(path) {
	for(var j in this.metadata) {
		/* if a child or parent of this query path is locked */
		if(j.match(path) || path.match(j)) {
			return this.metadata[j];
		}
	}
	return null;
}
function log(str) {
	console.log('jsondb: ' + str);
}

/* public methods */
exports.create = function(namespace) {
	return new JSONdb(namespace);
}
