import { HID, devices } from 'node-hid';

// Constants for Vendor ID and Product ID of the Finalmouse ULX
const VENDOR_ID = 0x361D;
const PRODUCT_ID = 0x0100;
const USAGE_PAGE = 0xFF00;

// Command to request battery data, extracted from xpanel
const COMMAND = [0x04, 0x02, 0xE0];

// Function to find the HID device
function findDevice() {
  const deviceList = devices();
  return deviceList.find(device => 
    device.vendorId === VENDOR_ID && 
    device.productId === PRODUCT_ID &&
    device.usagePage === USAGE_PAGE // There are 2 usage pages, we only care about this one
  );
}

// Function to get battery percentage from voltage
// Logic and values pulled from xpanel
function getBatteryPercentageFromVoltage(voltage) {
  const voltageLevels = [3, 3.62, 3.66, 3.74, 3.88, 4.17, 4.38];
  const batteryPercentages = [0, 5, 10, 25, 50, 75, 100];

  if (voltage >= 4.38) return 100;
  if (voltage < 3) return 0;

  let index = voltageLevels.findIndex((level, i) => 
    voltage >= level && voltage <= voltageLevels[i + 1]
  );

  if (index !== -1) {
    const lowerVoltage = voltageLevels[index];
    const upperVoltage = voltageLevels[index + 1];
    const lowerPercentage = batteryPercentages[index];
    const upperPercentage = batteryPercentages[index + 1];

    const interpolationFactor = (voltage - lowerVoltage) / (upperVoltage - lowerVoltage);
    return Math.round(lowerPercentage + (upperPercentage - lowerPercentage) * interpolationFactor);
  }

  return 100;
}

function interpretBuffer(buffer) {
  // Check if the buffer contains battery data
  // Second byte of the buffer determines if it is battery data
  if (buffer[1] === 5) {
    const rawLowByte = buffer[3];
    const rawHighByte = buffer[4];

    console.log('Raw Low Byte:', rawLowByte);
    console.log('Raw High Byte:', rawHighByte);

    const rawVoltageValue = (rawHighByte << 8) | rawLowByte;
    console.log('Combined Raw Voltage Value:', rawVoltageValue);

    const voltage = rawVoltageValue / 1000;
    console.log('Battery Voltage (V):', voltage);

    const batteryPercentage = getBatteryPercentageFromVoltage(voltage);
    console.log('Estimated Battery Percentage:', batteryPercentage);
  }
}

// Function to handle the device data event
function handleDeviceData (data) {
  // We can ignore the reportID, so we slice the data array
  // Battery data is in bytes 2-5
  const relevantData = data.slice(1, 6); 
  interpretBuffer(relevantData);
}

// Function to handle device errors
function handleError(error) {
  console.error('Device Error:', error);
}

// Function to send a command to the device
function sendCommand (device, command) {
  // Report requires a data array of 64 bytes
  const dataArray = new Uint8Array(64);
  dataArray.set(command, 0);
  console.log('Sending data:', dataArray);

  try {
    device.write(dataArray);
  } catch (error) {
    console.error('Error sending command:', error);
  }
}

async function main() {
  const deviceInfo = findDevice();
  if (!deviceInfo) {
    console.log('No device found');
    process.exit(0);
  }

  const device = new HID(deviceInfo.path);
  console.log('Connected to device:', deviceInfo);

  // Register event listeners
  device.on("data", handleDeviceData);
  device.on("error", handleError);

  // Send a command to the device
  sendCommand(device, COMMAND);
}

// Execute the main function
main();
