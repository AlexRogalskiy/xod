#pragma XOD require "https://github.com/adafruit/Adafruit-PN532"

// clang-format off
{{#global}}
#include <Adafruit_PN532.h>
{{/global}}
// clang-format on

struct State {
    uint8_t mem[sizeof(Adafruit_PN532)];
};

using Type = Adafruit_PN532*;

// clang-format off
{{ GENERATED_CODE }}
// clang-format on

void evaluate(Context ctx) {
    if (!isSettingUp()) return;

    auto state = getState(ctx);
    auto irq = getValue<input_IRQ>(ctx);

    Type nfc = new (state->mem) Adafruit_PN532(irq, NOT_A_PORT);

    // Initialize the device
    nfc->begin();
    // Ensure the device is working
    uint32_t versiondata = nfc->getFirmwareVersion();
    if (!versiondata) {
      raiseError(ctx);
      return;
    }
    // Configure the device
    nfc->setPassiveActivationRetries(0x01);
    nfc->SAMConfig();

    emitValue<output_DEV>(ctx, nfc);
}
