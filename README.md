# node-jsondb

JSON shared object database

---
## Description

[node-jsondb](https://github.com/mcmlxxix/node-jsondb/) is a shared object database which can traverse an object structure, read properties, change properties, and handle record locks (transactions) and subscriptions. 

When used in conjunction with [node-jsondb-srv](https://github.com/mcmlxxix/node-jsondb-srv/), it acts as a database server which accepts socket connections via [node-jsondb-client](https://github.com/mcmlxxix/node-jsondb-client/).

## Installation
	
	npm install node-jsdb
	
or

	git clone https://github.com/mcmlxxix/node-jsondb.git
	
you can also add https://github.com/mcmlxxix/node-jsondb.git as a dependency to your project's package.json file

NOTE: 	to use the full socket service, which already has this library as a dependent,
		see [node-jsondb-srv](https://github.com/mcmlxxix/node-jsondb-srv/) and/or [node-jsondb-client](https://github.com/mcmlxxix/node-jsondb-client/) for installation instructions.
	
## Features

[jPath](https://github.com/mcmlxxix/node-jpath/) queries:

	path/to/object[property==value]
	path/object
	path/to/object[property > 0 && property < 10]
	path/to/array(index)
	etc..
	
### Transactions:

with transaction mode enabled for a given database, any changes to the database must be preceded by a "write lock" on the affected records, and any locks or writes that fail during the transaction will cause the transaction to fail entirely, and the data will remain unchanged.
	
### Database locks:

with "full" lock mode enabled, any changes to the database must be preceded by a "write lock," and no changes will be allowed anywhere in the database until it is unlocked.
	
### No locks:

you can also throw caution to the wind, be a wild and crazy guy, and just let any client make any changes they want without locking. This is most useful in chat room databases and other applications where you are more interested in distributing subscription updates than maintaining data integrity.
	
### Subscriptions:

clients may "subscribe" to a particular record location, and those clients will receive a packet containing the latest copy of the data stored at that location (or it will be passed to a callback) any time another client makes a change affecting that record.
	
### Save/Load:
	
databases can be saved to file (in JSON format) and loaded from file (in JSON format)
	
## Packet Structure

	request={
		id: <client id>,
		db: <database name>,
		oper: <database operation>,
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
		
## Methods

	db.load(fileName); 
	db.save(fileName);
	
	db.read(request,callback);
	db.write(request,callback);
	
	db.lock(request,callback);
	db.unlock(request,callback);
	
	db.subscribe(request,callback);
	db.unsubscribe(request,callback);
	
## Properties

	db.settings.locking = "transaction" | "full" | null
	db.settings.maxconnections = num
	
		

