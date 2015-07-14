/*
 * Hulk Button - Interfaces with 'Dream Cheeky' USB buttons.
 *
 * Much inspiration was taken from these excellent USB reverse-engineering resources:
 *
 * A guide to reverse-engineering a USB car:
 * http://www.linuxvoice.com/drive-it-yourself-usb-car-6/
 *
 * USB Made Simple:
 * http://www.usbmadesimple.co.uk
 *
 * node-usb:
 * https://github.com/nonolith/node-usb
 *
 *
 * Usage: Use the -h flag.
 */
var usb = require('usb');
var spawn = require('child_process').spawn;
var yargs = require('yargs');

// In addition to node errors: https://github.com/joyent/node/blob/master/doc/api/process.markdown#exit-codes
var EXIT_CODE_BUTTON_NOT_FOUND = 30; // Device not present. Check pid/vid?
var EXIT_CODE_KERNEL_DRIVER_PRESENT = 31; // Driver attached, but -d used.
var EXIT_CODE_ACCESS_DENIED = 32;

// The button gives us this in the first
// data byte when the button is pressed
// (27 when not pressed, but we don't care).
var DATA_WHEN_PRESSED = 26;

var argv = yargs
  .usage('$0 [options] COMMAND [args..]')
  .epilog('When the button is pressed, PRESSED is printed to stdout and `COMMAND` is invoked with the given arguments, if present. When the button is released, RELEASED is printed to stdout.')

  .describe('v', 'Device VID, hex')
  .alias('v', 'vid')
  .nargs('v', 1)
  .string('v') // Otherwise yargs will try to parseInt base 10.
  .default('v', '0x1d34')
  .check(function(argv) {
    if (typeof argv.v !== 'number' && isNaN(parseInt(argv.v, 16))) {
      throw new Error('--vid must be a hexadecimal number (i.e., 0x11AA)');
    }
    return true;
  })

  .describe('p', 'Device PID, hex')
  .alias('p', 'pid')
  .nargs('p', 1)
  .string('p') // Otherwise yargs will try to parseInt base 10.
  .default('p', '0x0008')
  .check(function(argv) {
    if (typeof argv.p !== 'number' && isNaN(parseInt(argv.p, 16))) {
      throw new Error('--pid must be a hexadecimal number (i.e., 0x11AA)');
    }
    return true;
  })

  .describe('i', 'Polling interval in milliseconds')
  .alias('i', 'poll-interval')
  .default('i', 15)

  .describe('t', 'Protocol timeout for flaky devices in milliseconds (0 to disable)')
  .alias('t', 'timeout')
  .default('t', 300)

  .describe('d', 'Detach kernel driver first')
  .alias('d', 'detach-kernel-driver')
  .boolean('d')
  .default('d', true)


  .help('h')
  .argv;

var vid = parseInt(argv.v, 16);
var pid = parseInt(argv.p, 16);

var button = usb.findByIds(vid, pid);

if (button) {
  console.log('Found button at vid, pid: 0x' + vid.toString(16) + ', 0x' + pid.toString(16));

  try {
    button.open();
  } catch (e) {
    if (e.errnum === usb.LIBUSB_ERROR_ACCESS) {
      console.error('Access denied, you probably need to define a udev rule for your device. Check README for advice.');
      process.exit(EXIT_CODE_ACCESS_DENIED);
    }
  }

  if (button.interfaces.length !== 1) {
    // Maybe try to figure out which interface we care about?
    throw new Error('Expected a single USB interface, but found ' + button.interfaces.length);
  } else {
    var interface = button.interface(0);
    if (interface.endpoints.length !== 1) {
      // Maybe try to figure out which interface we care about?
      throw new Error('Expected a single USB interface, but found: ' + interface.endpoints.length);
    } else {
      if (interface.isKernelDriverActive()) {
        console.log('Kernel driver active.');
        if (argv.d) {
          console.log('Detaching kernel driver.');
          interface.detachKernelDriver();
        } else {
          console.log('Not continuing as -d flag used.');
          process.exit(EXIT_CODE_KERNEL_DRIVER_PRESENT);
        }
      }
      interface.claim();
      var endpointAddress = interface.endpoints[0].address;
      var endpoint = interface.endpoint(endpointAddress);

      endpoint.timeout = argv.t;

      if (endpoint.direction !== 'in') {
        throw new Error('Expected endpoint direction `in`, was `' + endpoint.direction + '`');
      } else if (endpoint.transferType !== usb.LIBUSB_TRANSFER_TYPE_INTERRUPT) {
        throw new Error('Expected endpoint transferType to be LIBUSB_TRANSFER_TYPE_INTERRUPT, was `' + endpoint.transferType + '`');
      } else {
        // The value in this buffer is still a mystery - it was pulled out of
        // a USB dump of the official driver polling for button presses.
        var pollCommandBuffer = new Buffer([0, 0, 0, 0, 0, 0, 0, 2]);

        // These values were similarly captured from a USB dump.
        var bmRequestType = 0x21;
        var bRequest = 0x9;
        var wValue = 0x0200;
        var wIndex = 0x0;
        var transferBytes = 8;

        var currentlyPressed = false;

        function poll() {

          // Cause the button to read its state.
          button.controlTransfer(
            bmRequestType,
            bRequest,
            wValue,
            wIndex,
            pollCommandBuffer,
            function(error, data) {
              if (error) {
                throw new Error(error);
              }

              endpoint.transfer(transferBytes, function(error, data) {
                if (error) {
                  if (error.errno === usb.LIBUSB_TRANSFER_TIMED_OUT) {
                    setTimeout(poll, argv.i);
                  } else {
                    throw new Error(error);
                  }
                } else {
                  var isPressedNow = data[0] === DATA_WHEN_PRESSED;
                  if (isPressedNow !== currentlyPressed) {
                    currentlyPressed = isPressedNow;
                    if (isPressedNow) {
                      console.log('PRESSED');
                      launchCommand();
                    } else {
                      console.log('RELEASED');
                    }
                  }
                  setTimeout(poll, argv.i);
                }
              });
            }
          );
        }

        poll();
      }
    }
  }
} else {
  console.log('Could not find button.');
  process.exit(EXIT_CODE_BUTTON_NOT_FOUND);
}

function launchCommand() {
  if (argv._.length > 0) {
    spawn(
      argv._[0],
      argv._.slice(1),
      {
        stdio: 'inherit'
      }
    );
  }
}
