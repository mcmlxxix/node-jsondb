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
JSONdb.prototype.subscribe = function(query) {
}
JSONdb.prototype.unsubscribe = function(query) {
}

/* record locking */
JSONdb.prototype.lock = function(query,lock) {
}
JSONdb.prototype.unlock = function(query) {
}

/* database queries */
JSONdb.prototype.read = function(query,lock) {
	var records = jp.select(this.data,query);
	return records;
}
JSONdb.prototype.write = function(query,lock) {
	var result = jp.update(this.data,query);
	return result;
}

/* record properties */
JSONdb.prototype.isSubscribed = function(query) {
}
JSONdb.prototype.isLocked = function(query,lock) {
}

/* private functions */
function log(str) {
	console.log('jsondb: ' + str);
}

/* public methods */
exports.create = function(namespace) {
	return new JSONdb(namespace);
}
