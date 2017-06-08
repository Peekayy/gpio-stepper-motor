const mcp23017 = require("sysfs-gpio/pinMappings/mcp23017")(496);
const GpioStepperMotor = require("./motor.js")(mcp23017);

let steps;
const argv = process.argv;

if (!argv[2]) {
    console.error("Usage : node motorTest.js nbSteps [delay]");
} else {

    steps = argv[2].split(",").map(e => parseInt(e, 10));

    const delay = parseInt(argv[3], 10) || 50;
    const motor = new GpioStepperMotor(["GPB0", "GPB1", "GPB2", "GPB3"], "GPB4", delay, GpioStepperMotor.STEP_MODE.HALF);

    steps.reduce((c, e) => {
        return c.then(_ => motor.move(Math.abs(e), Math.sign(e)));
    }, motor.initialize()).catch(e => {
        console.trace(e);
    });
}
