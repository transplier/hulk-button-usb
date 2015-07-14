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
      throw new Error('Expected a single USB interface, but foun: ' + interface.endpoints.length);
    } else {
      if (interface.isKernelDriverActive()) {
        console.log('Kernel driver active, detaching it.');
        interface.detachKernelDriver();
      }
      interface.claim();
      var endpointAddress = interface.endpoints[0].address;
      var endpoint = interface.endpoint(endpointAddress);

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
                throw new Error(error);
              }
              process.stdout.write(data[0] + ' ');
              setTimeout(poll, 200);
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
