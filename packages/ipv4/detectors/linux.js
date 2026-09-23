var childProcess = require('child_process');
var ifconfig     = require('./ifconfig');

var DEFAULT_GATEWAY_LINE_PATTERN = /\n0\.0\.0\.0.*?\s*(\w+?)\n/m;

module.exports.detectLocalIpV4Address = function(){
    return new Promise(resolve => {
        resolve(null);
    });;
};
