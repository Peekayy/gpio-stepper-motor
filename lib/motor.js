const mcp23017 = require("sysfs-gpio/pinMappings/mcp23017")(496);
console.log(mcp23017);
const GPIO = require("sysfs-gpio")(mcp23017);

var ledGpio = new GPIO("GPA6");
ledGpio.open(GPIO.DIRECTION.OUT, GPIO.VALUE.HIGH).then(function(){
	console.log("ronron");
}).catch(function(e){
	console.error(e);
	console.error(e.stack);
});
