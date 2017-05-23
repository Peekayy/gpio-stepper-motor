const mcp23017 = require("sysfs-gpio/pinMappings/mcp23017");
const GPIO = require("sysfs-gpio")(mcp23017);

var ledGpio = new GPIO("GPA6");
ledGpio.open(GPIO.DIRECTION.OUT, GPIO.VALUE.HIGH);