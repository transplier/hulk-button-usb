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
 */
var usb = require('usb');

var button = usb.findByIds(0x1d34, 0x0008);

if (button) {
  console.log('Found button.');
  button.open();
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
        console.log('Kernel driver active, detaching it.');
        interface.detachKernelDriver();
      }
      interface.claim();
      var endpointAddress = interface.endpoints[0].address;
      var endpoint = interface.endpoint(endpointAddress);

      endpoint.timeout = 300;

      if (endpoint.direction !== 'in') {
        throw new Error('Expected endpoint direction `in`, was `' + endpoint.direction + '`');
      } else if (endpoint.transferType !== usb.LIBUSB_TRANSFER_TYPE_INTERRUPT) {
        throw new Error('Expected endpoint transferType to be LIBUSB_TRANSFER_TYPE_INTERRUPT, was `' + endpoint.transferType + '`');
      } else {
        function poll() {
          var buf = new Buffer([0, 0, 0, 0, 0, 0, 0, 2]);
          button.controlTransfer(0x21, 0x9, 0x0200, 0x0, buf, function(error, data) {
            if (error) {
              throw new Error(error);
            }

            endpoint.transfer(8, function(error, data) {
              if (error) {
                if (error.errno === usb.LIBUSB_TRANSFER_TIMED_OUT) {
                  process.stdout.write('!! ');
                  setTimeout(poll, 2);
                } else {
                  throw new Error(error);
                }
              } else {
                process.stdout.write(data[0] + ' ');
                setTimeout(poll, 2);
              }
            });
          });
        }

        poll();
      }
    }
  }
} else {
  console.log('Could not find button.');
  process.exit(1);
}
