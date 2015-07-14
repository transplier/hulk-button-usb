# Hulk Button
Linux driver script for Dream Cheeky's USB Hulk Button. Could also work for the Iron Man and Spider-Man variants (let me know!).

## Usage
See -h flag.

## Setting up permissions
By default raw USB devices are read-only for normal users. You could in theory run this script as root, but do you _really_ want to run some random script from the internet as root?

### The hack way
You can manually chmod the device node for testing purposes. This won't persist across device unplugs or machine reboots.
1. Find the device bus and device ID with `lsusb`:
  ```
  $ lsusb
    ...snip...
    Bus 002 Device 010: ID 1d34:0008 Dream Cheeky Dream Cheeky button
    ...snip...
  ```
  In this example, the bus is 002, and the device ID is 010. The leading zeroes are significant.
2. Hack the permissions to /dev/bus/usb/<bus>/<device ID>
  ```
  $ sudo chown 777 /dev/bus/usb/002/010
  ```

### The proper way
Create a udev rule that automatically assigns permissions. This will persist across unplugs, reboots, etc.

1. Find the device vid and pid with `lsusb`.
  For my Hulk button, these are 0x1d34 and 0x0008, respectively
  ```
  $ lsusb
    ...snip...
    Bus 002 Device 010: ID 1d34:0008 Dream Cheeky Dream Cheeky button
    ...snip...
  ```
  In this example, the vid is 0x1d34 and the pid is 0x0008.
2. Decide which UNIX group should get access.
  You can create a special hulk group with `sudo groupadd hulk`, and add yourself to it via `sudo gpasswd -a YOUR_USERNAME hulk`. If you're not willing to go that far, just choose a group your user is already a part of (see `groups`).
3. Create a udev rule file under `/usr/lib/udev/`
  I used `70-hulk-button.rules`, but you can name it anything as long as it ends with `.rules`.
  ```
  $ sudo vim /lib/udev/rules.d/70-hulk-button.rules
  ```
  Enter the following, replacing VID, PID, and YOUR_GROUP for the appropriate values. Do not prepend an 0x for any of the values:
  ```
  SUBSYSTEM=="usb", ATTRS{idVendor}=="VID", ATTRS{idProduct}=="PID", GROUP="YOUR_GROUP", MODE="0660"
  ```
  There is a sample in `70-hulk-button.rules.sample`.
4. Re-plug the Hulk, re-login (if you modified your groups).
5. Gamma rays?
6. PROFIT