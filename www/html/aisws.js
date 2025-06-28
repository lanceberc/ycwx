//var localAISURL = "ws://192.168.2.13/ais/"

class AISwebsocket {
    constructor(caller, url) {
	if (url == '') url = '/ais/';
	this.socket = null;
	this.caller = caller;
	this.url = url;
	this.reopen = false;
    }

    open() {
	const now = new Date();
	const time = now.format("HH:MM");
	
	const aisws = this; // Stash 'this' so it can be used in event handlers - kludgey, no?

	if (this.socket) {
	    console.debug(`AISwebsocket: ${time} already open '${this.url}'`);
	    return;
	}

	console.log(`AISwebsocket: ${time} opening '${this.url}'`);
	try {
	    this.socket = new WebSocket(this.url);
	} catch(err) {
	    console.log(`AISwebsocket: ${time} open error ${err.message}`);
	    aisws.socket = null;
	    console.log(`AISwebsocket: ${time} open error sleeping for a minute '${aisws.url}'`);
	    setTimeout(function() {
		const now = new Date();
		const time = now.format("HH:MM");
		console.log(`AISwebsocket: ${time} open error reopening '${aisws.url} '`);
		aisws.open();
	    }, 60 * 1000);
	    return ;
	}

	this.reopen = true; // Try to reopen if connection closes
	
	this.socket.addEventListener('open', function(e) {
	    const now = new Date();
	    const time = now.format("HH:MM");
	    console.log(`AISwebsocket: ${time} open '${aisws.url}'`);
	});
	
	this.socket.addEventListener('close', (e) => {
	    const now = new Date();
	    const time = now.format("HH:MM");
	    aisws.socket = false;
	    console.log(`AISwebsocket: ${time} closed '${aisws.url}'`);
	    if (!aisws.reopen) return;
	    console.log(`AISwebsocket: ${time} sleeping for a minute '${aisws.url}'`);
	    setTimeout(function() {
		const now = new Date();
		const time = now.format("HH:MM");
		console.log(`AISwebsocket: ${time} reopening '${aisws.url} '`);
		aisws.open();
	    }, 60 * 1000);
	});
	
	this.socket.addEventListener('error', (e) => {
	    const now = new Date();
	    const time = now.format("HH:MM");
	    const s = "";
	    for (const f in e) s+= `[${f}]='${e[f]}']`;
	    console.error(`AISwebsocket: ${time} messege error '${aisws.url}' ${s}`);
	});
	
	this.socket.addEventListener('message', function(json) {
	    const now = new Date();
	    const time = now.format("HH:MM");
	    let localAIS;
	    try {
		localAIS = JSON.parse(json.data);
	    }
	    catch (err) {
		console.error(`AISwebsocket: ${time} json error '${aisws.url}' ${err.message}`);
		return;
	    }
	    //console.log("localAISMessage() localAIS " + json.data);
	    aisws.caller.callback(json.data);
	});
    }
    
    close() {
	const now = new Date();
	const time = now.format("HH:MM");
	
	console.log(`AISwebsocket: ${time} closing '${this.url}'`);
	
	this.reopen = false;
	if (this.socket) this.socket.close();
	//this.socket = null; // should be set in close event handler
    }

}

export { AISwebsocket };
