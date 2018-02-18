var APP_VERSION = "0.0.1"
var APP_NAME = "Util"

var util = module.exports;


console.log("Running Module " + APP_NAME + " version " + APP_VERSION);


util.getTimestampAsString = function (theDate) {
    var sd = theDate ? theDate : new Date();
try{
    var ts = sd.getUTCFullYear() + '-' + (sd.getUTCMonth() + 1) + '-' + sd.getUTCDate() + 'T' + sd.getUTCHours() + ':' + sd.getUTCMinutes() + ':' + sd.getSeconds();
    return ts;
}catch (e){"getTimestampAsString exception "+JSON.stringify(e)}
}

util.getDateAsString = function (theDate) {
    var sd = theDate ? theDate : new Date();
    try{
        return sd.getUTCFullYear() + '-' + (sd.getUTCMonth() + 1).padStart(2,'0') + '-' + sd.getUTCDate() ;
    }catch (e){"getTimestampAsString exception "+JSON.stringify(e)}
    }

Date.prototype.addDays = function(days) {
    var dat = new Date(this.valueOf());
    dat.setDate(dat.getDate() + days);
    return dat;
  }

util.guid = function() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
}
