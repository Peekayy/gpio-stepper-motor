module.exports = function(gpioConfig) {

    const debug = require("debug")("GpioStepperMotor");
    const GPIO = require("sysfs-gpio")(gpioConfig);

    if (!Promise.prototype.delay) {
        Promise.prototype.delay = function(delay) {
            return this.then(value => Promise.delay(delay, value));
        }
    }

    if (!Promise.delay) {
        Promise.delay = (delay, value) => {
            return new Promise(resolve => {
                setTimeout(resolve.bind(null, value), delay);
            });
        }
    }

    /**
     * @enum {number}
     */
    const MotorDirection = {
        FORWARD: 1,
        BACKWARD: -1
    };

    /**
     * @enum {number}
     */
    const StepMode = {
        FULL: 0,
        HALF: 1
    };

    const actionTables = [
        // 1010, 0110, 0101, 1001
        [
            [GPIO.VALUE.HIGH, GPIO.VALUE.LOW, GPIO.VALUE.HIGH, GPIO.VALUE.LOW],
            [GPIO.VALUE.LOW, GPIO.VALUE.HIGH, GPIO.VALUE.HIGH, GPIO.VALUE.LOW],
            [GPIO.VALUE.LOW, GPIO.VALUE.HIGH, GPIO.VALUE.LOW, GPIO.VALUE.HIGH],
            [GPIO.VALUE.HIGH, GPIO.VALUE.LOW, GPIO.VALUE.LOW, GPIO.VALUE.HIGH]
        ],
        // 1000, 1010, 0010, 0110, 0100, 0101, 0001, 1001
        [
            [GPIO.VALUE.HIGH, GPIO.VALUE.LOW, GPIO.VALUE.LOW, GPIO.VALUE.LOW],
            [GPIO.VALUE.HIGH, GPIO.VALUE.LOW, GPIO.VALUE.HIGH, GPIO.VALUE.LOW],
            [GPIO.VALUE.LOW, GPIO.VALUE.LOW, GPIO.VALUE.HIGH, GPIO.VALUE.LOW],
            [GPIO.VALUE.LOW, GPIO.VALUE.HIGH, GPIO.VALUE.HIGH, GPIO.VALUE.LOW],
            [GPIO.VALUE.LOW, GPIO.VALUE.HIGH, GPIO.VALUE.LOW, GPIO.VALUE.LOW],
            [GPIO.VALUE.LOW, GPIO.VALUE.HIGH, GPIO.VALUE.LOW, GPIO.VALUE.HIGH],
            [GPIO.VALUE.LOW, GPIO.VALUE.LOW, GPIO.VALUE.LOW, GPIO.VALUE.HIGH],
            [GPIO.VALUE.HIGH, GPIO.VALUE.LOW, GPIO.VALUE.LOW, GPIO.VALUE.HIGH],
        ]];

    class GpioStepperMotor{
        /**
         *
         * @param {Array.<String|number>} coilPins Array of 5 GPIO pins.
         * @param {String|number} [enablePin] Required when driving motor with LM293 chip.
         * @param {number} [stepDelay] Time between steps (defaults to 100ms)
         * @param {StepMode} [stepMode] select full (4) step mode or half (8) step mode.
         */
        constructor(coilPins, enablePin, stepDelay, stepMode) {
            if (!coilPins || coilPins.length !== 4) {
                throw new Error("Invalid GPIO array");
            }

            this.enablePin = new GPIO(enablePin) || null;
            this.pins = coilPins.map(pin => new GPIO(pin));
            this.stepDelay = stepDelay || 100;
            this.stepMode = stepMode || 0;
            this.actionTable = actionTables[this.stepMode];
            this._currentStep = null;
        }

        initialize() {
            const allPins = this.pins.concat(this.enablePin);
            debug("motor init");
            this._currentStep = 0;
            return Promise.all(allPins.map(pin => pin.open(GPIO.DIRECTION.OUT, GPIO.VALUE.LOW)))
                .then(_ => this._beforeMove())
                .then(_ => this._step(0))
                .then(_ => this._afterMove())
                .catch(e => {
                    debug("Caught failure during initialization");
                    return this.reset().then(_ => {
                        return Promise.reject(e);
                    });
                });
        }

        reset() {
            let promise;
            if (this.enablePin) {
                debug("Set enable pin to low");
                promise = this.enablePin.setValue(GPIO.VALUE.LOW);
            }
            return (promise || Promise.resolve())
                .then(_ => this._coilSetup([GPIO.VALUE.LOW, GPIO.VALUE.LOW, GPIO.VALUE.LOW, GPIO.VALUE.LOW]));
        }

        /**
         * @param {MotorDirection} [direction] Step direction
         * @returns {Promise}
         */
        singleStep(direction) {
            return this.move(1, direction);
        }

        move(steps, direction) {
            debug(`Moving ${steps} steps ${direction === 1 ? "forwards" : "backwards"} (${this.stepDelay * steps}ms)`);
            return this._beforeMove()
                .then(_ => {
                    let promise = Promise.resolve();
                    for (let i = 0; i < steps; i++) {
                        promise = promise.then(_ => {
                            return Promise.all([this._step(direction), Promise.delay(this.stepDelay)]);
                        });
                    }
                    return promise;
                })
                .then(_ => this._afterMove())
                .catch(e => {
                    debug("Caught failure during move");
                    return this.reset().then(_ => {
                        return Promise.reject(e);
                    });
                });
        }

        _step(direction) {
            const actionTableSize = this.actionTable.length;
            const nextStep = (((this._currentStep + direction) % actionTableSize) + actionTableSize) % actionTableSize;
            debug(`coilSetup #${nextStep} => ${direction}`);
            return this._coilSetup(this.actionTable[nextStep]).then(_ => {
                this._currentStep = nextStep;
            });
        }

        _beforeMove() {
            if (this.enablePin) {
                debug("Set enable pin to high");
                return this.enablePin.setValue(GPIO.VALUE.HIGH);
            } else {
                return Promise.resolve();
            }
        }

        _afterMove() {
            return this.reset();
        }

        /**
         *
         * @param {Array.<GPIO.VALUE>} values
         * @returns {Promise}
         * @private
         */
        _coilSetup(values) {
            return Promise.all(values.map((v, i) => this.pins[i].setValue(v)));
        }
    }

    /**
     * @type MotorDirection
     */
    GpioStepperMotor.DIRECTION = MotorDirection;

    /**
     * @type StepMode
     */
    GpioStepperMotor.STEP_MODE = StepMode;

    return GpioStepperMotor;
};