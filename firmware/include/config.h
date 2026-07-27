#pragma once
#include <Arduino.h>

namespace sg {
constexpr uint8_t ROWS = 25;
constexpr uint8_t COLUMNS = 25;
constexpr uint16_t CELL_COUNT = ROWS * COLUMNS;
constexpr uint32_t SERIAL_BAUD = 921600;
constexpr uint8_t ADC_PIN = 34;
constexpr uint16_t ADC_MAX = 4095;
constexpr uint8_t SAMPLES_PER_CELL = 3;
constexpr uint16_t MUX_SETTLE_US = 8;
constexpr uint16_t FRAME_INTERVAL_MS = 100;

// Address pins are placeholders until the exact PCB/wiring harness is confirmed.
constexpr uint8_t ROW_ADDR_PINS[4] = {16, 17, 18, 19};
constexpr uint8_t COLUMN_ADDR_PINS[4] = {21, 22, 23, 25};
constexpr uint8_t ROW_BANK_ENABLE_PINS[2] = {26, 27};
constexpr uint8_t COLUMN_BANK_ENABLE_PINS[2] = {32, 33};
constexpr bool ENABLE_ACTIVE_LOW = true;
constexpr bool SENSOR_INVERTED = false;
}
