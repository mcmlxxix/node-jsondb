var error = {
	/* non-errors */
	NONE: 			0,

	/* service errors */
	INVALID_REQUEST:1,
	INVALID_PATH: 	2,
	INVALID_DB: 	3,
	INVALID_OPER: 	4,
	INVALID_USER: 	5,
	INVALID_PASS: 	6,
	AUTH_REQD: 		7,

	/* database errors */
	LOCK: 			8,
	UNLOCK: 		9,
	WRITE:			10,
	READ: 			11
};

var oper = {
	/* operations */
	READ: 			0,
	WRITE: 			1,
	LOCK: 			2,
	UNLOCK: 		3,
	SUBSCRIBE: 		4,
	UNSUBSCRIBE: 	5,
	AUTH: 			6
};

var lock = {
	/* lock types */
	READ: 			"r",
	WRITE: 			"w",
	/* lock-level options */
	NONE: 			null,
	TRANS:	 		"transaction",
	FULL: 			"full"
};

module.exports = {
	error:error,
	oper:oper,
	lock:lock
}