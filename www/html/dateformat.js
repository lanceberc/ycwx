// A utility routine to format dates a few common ways. Not a general formatter

Date.prototype.formatUTC = function (f) {
    const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let year = this.getUTCFullYear().toString();
    let month = (this.getUTCMonth() < 9 ? "0" : "") + (this.getUTCMonth()+1).toString();
    let date = (this.getUTCDate() < 10 ? "0" : "") + this.getUTCDate().toString();
    let hour = (this.getUTCHours() < 10 ? "0" : "") + this.getUTCHours().toString(); 
    let minute = (this.getUTCMinutes() < 10 ? "0" : "") + this.getUTCMinutes().toString();
    let day = shortDays[this.getDay()];
    let mon = shortMonths[this.getMonth()];
    
    if (f == "time") {
	return(`${hour}:${minute}`);
    } else if (f == "short") {
	return(`${day}, ${mon} ${date} ${hour}:${minute}`);
    } else if (f == "year") {
	return(year);
    } else if (f == "month") {
	return(month);
    } else if (f == "date") {
	return(date);
    } else if (f == "hour") {
	return(hour);
    } else if (f == "minute") {
	return(minute);
    } else if (f == "day") {
	return(day);
    } else if (f == "ymd") {
	return(`${year}${month}${date}`);
    } else if (f == "y-m-d") {
	return(`${year}-${month}-${date}`);
    } else {
	return(this.toString());
    }
}

Date.prototype.format = function(f) {
    const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let year = this.getFullYear().toString();
    let month = (this.getMonth() < 9 ? "0" : "") + (this.getMonth()+1).toString();
    let date = (this.getDate() < 10 ? "0" : "") + this.getDate().toString();
    let hour = (this.getHours() < 10 ? "0" : "") + this.getHours().toString(); 
    let minute = (this.getMinutes() < 10 ? "0" : "") + this.getMinutes().toString();
    let day = shortDays[this.getDay()];
    let mon = shortMonths[this.getMonth()];

    if (f == "time") {
	return(`${hour}:${minute}`);
    } else if (f == "short") {
	return(`${day}, ${mon} ${date} ${hour}:${minute}`);
    } else if (f == "year") {
	return(year);
    } else if (f == "month") {
	return(month);
    } else if (f == "date") {
	return(date);
    } else if (f == "hour") {
	return(hour);
    } else if (f == "minute") {
	return(minute);
    } else if (f == "day") {
	return(day);
    } else if (f == "ymd") {
	return(`${year}${month}${date}`);
    } else if (f == "y-m-d") {
	return(`${year}-${month}-${date}`);
    } else {
	return(this.toString());
    }
}
