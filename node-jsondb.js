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

/* database object definition */
function JSONdb(name) {
	this.name = name;
	this.users = {};
	this.data = {};
	this.metadata = {};

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
JSONdb.prototype.subscribe = function(query, callback) {
}
JSONdb.prototype.unsubscribe = function(query, callback) {
}

/* record locking */
JSONdb.prototype.lock = function(query, callback) {
}
JSONdb.prototype.unlock = function(query, callback) {
}

/* database queries */
JSONdb.prototype.read = function(query, callback) {
	var records = [];
	for(var i=0;i<query.length;i++) {
		records = records.concat(jp.select(this.data,query[i]));
	}
	if(typeof callback == "function")
		return callback(records);
	return records;
}
JSONdb.prototype.write = function(query, callback) {
	var results = [];
	for(var i=0;i<query.length;i++) {
		results = results.concat(jp.update(this.data,query[i]));
	}
	if(typeof callback == "function")
		return callback(results);
	return results;
}

/* record properties */
JSONdb.prototype.isSubscribed = function(query, callback) {
}
JSONdb.prototype.isLocked = function(query, callback) {
}

/* private functions */
function log(str) {
	console.log('jsondb: ' + str);
}

/* public methods */
exports.create = function(namespace) {
	return new JSONdb(namespace);
}
