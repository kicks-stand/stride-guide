#include <Arduino.h>
#include "config.h"

namespace {
uint16_t baseline[sg::CELL_COUNT] = {0};
uint16_t values[sg::CELL_COUNT] = {0};
bool streaming = true;
uint32_t sequenceNumber = 0;

void writeAddress(const uint8_t pins[4], uint8_t channel) {
  for (uint8_t bit = 0; bit < 4; ++bit) digitalWrite(pins[bit], (channel >> bit) & 0x01);
}

void disableBanks(const uint8_t pins[2]) {
  const uint8_t inactive = sg::ENABLE_ACTIVE_LOW ? HIGH : LOW;
  for (uint8_t i = 0; i < 2; ++i) digitalWrite(pins[i], inactive);
}

void selectChannel(const uint8_t addressPins[4], const uint8_t enablePins[2], uint8_t logicalChannel) {
  disableBanks(enablePins);
  const uint8_t bank = logicalChannel / 16;
  const uint8_t channel = logicalChannel % 16;
  writeAddress(addressPins, channel);
  digitalWrite(enablePins[bank], sg::ENABLE_ACTIVE_LOW ? LOW : HIGH);
}

uint16_t sampleAdc() {
  uint16_t samples[sg::SAMPLES_PER_CELL];
  for (uint8_t i = 0; i < sg::SAMPLES_PER_CELL; ++i) samples[i] = analogRead(sg::ADC_PIN);
  for (uint8_t i = 0; i < sg::SAMPLES_PER_CELL; ++i) {
    for (uint8_t j = i + 1; j < sg::SAMPLES_PER_CELL; ++j) {
      if (samples[j] < samples[i]) { const uint16_t t = samples[i]; samples[i] = samples[j]; samples[j] = t; }
    }
  }
  return samples[sg::SAMPLES_PER_CELL / 2];
}

uint16_t readCell(uint8_t row, uint8_t column) {
  selectChannel(sg::ROW_ADDR_PINS, sg::ROW_BANK_ENABLE_PINS, row);
  selectChannel(sg::COLUMN_ADDR_PINS, sg::COLUMN_BANK_ENABLE_PINS, column);
  delayMicroseconds(sg::MUX_SETTLE_US);
  const uint16_t raw = sampleAdc();
  disableBanks(sg::ROW_BANK_ENABLE_PINS);
  disableBanks(sg::COLUMN_BANK_ENABLE_PINS);
  return sg::SENSOR_INVERTED ? sg::ADC_MAX - raw : raw;
}

uint32_t scanMatrix(bool subtractBaseline) {
  const uint32_t started = micros();
  for (uint8_t row = 0; row < sg::ROWS; ++row) {
    for (uint8_t column = 0; column < sg::COLUMNS; ++column) {
      const uint16_t index = static_cast<uint16_t>(row) * sg::COLUMNS + column;
      const uint16_t raw = readCell(row, column);
      values[index] = subtractBaseline && raw > baseline[index] ? raw - baseline[index] : (subtractBaseline ? 0 : raw);
    }
  }
  return (micros() - started) / 1000;
}

void sendFrame(uint32_t scanDurationMs) {
  uint16_t minimum = sg::ADC_MAX;
  uint16_t maximum = 0;
  for (uint16_t i = 0; i < sg::CELL_COUNT; ++i) { minimum = min(minimum, values[i]); maximum = max(maximum, values[i]); }
  Serial.print(F("{\"protocolVersion\":1,\"type\":\"matrix_frame\",\"sequence\":"));
  Serial.print(sequenceNumber++);
  Serial.print(F(",\"deviceUptimeMs\":")); Serial.print(millis());
  Serial.print(F(",\"rows\":")); Serial.print(sg::ROWS);
  Serial.print(F(",\"columns\":")); Serial.print(sg::COLUMNS);
  Serial.print(F(",\"scanDurationMs\":")); Serial.print(scanDurationMs);
  Serial.print(F(",\"minimum\":")); Serial.print(minimum);
  Serial.print(F(",\"maximum\":")); Serial.print(maximum);
  Serial.print(F(",\"values\":["));
  for (uint16_t i = 0; i < sg::CELL_COUNT; ++i) { if (i) Serial.print(','); Serial.print(values[i]); }
  Serial.println(F("]}"));
}

void calibrateBaseline() {
  constexpr uint8_t frames = 20;
  uint32_t sums[sg::CELL_COUNT] = {0};
  for (uint8_t frame = 0; frame < frames; ++frame) {
    scanMatrix(false);
    for (uint16_t i = 0; i < sg::CELL_COUNT; ++i) sums[i] += values[i];
  }
  for (uint16_t i = 0; i < sg::CELL_COUNT; ++i) baseline[i] = sums[i] / frames;
  Serial.println(F("{\"protocolVersion\":1,\"type\":\"command_ack\",\"command\":\"CALIBRATE_BASELINE\",\"ok\":true}"));
}

void handleCommand(String command) {
  command.trim();
  if (command == "PING") Serial.println(F("{\"protocolVersion\":1,\"type\":\"pong\"}"));
  else if (command == "START_STREAM") streaming = true;
  else if (command == "STOP_STREAM") streaming = false;
  else if (command == "CALIBRATE_BASELINE") calibrateBaseline();
  else if (command == "GET_CONFIG") {
    Serial.print(F("{\"protocolVersion\":1,\"type\":\"config\",\"rows\":")); Serial.print(sg::ROWS);
    Serial.print(F(",\"columns\":")); Serial.print(sg::COLUMNS); Serial.println(F("}"));
  }
}
}

void setup() {
  Serial.begin(sg::SERIAL_BAUD);
  analogReadResolution(12);
  pinMode(sg::ADC_PIN, INPUT);
  for (uint8_t pin : sg::ROW_ADDR_PINS) pinMode(pin, OUTPUT);
  for (uint8_t pin : sg::COLUMN_ADDR_PINS) pinMode(pin, OUTPUT);
  for (uint8_t pin : sg::ROW_BANK_ENABLE_PINS) pinMode(pin, OUTPUT);
  for (uint8_t pin : sg::COLUMN_BANK_ENABLE_PINS) pinMode(pin, OUTPUT);
  disableBanks(sg::ROW_BANK_ENABLE_PINS);
  disableBanks(sg::COLUMN_BANK_ENABLE_PINS);
  Serial.println(F("{\"protocolVersion\":1,\"type\":\"status\",\"status\":\"ready\",\"rows\":25,\"columns\":25}"));
}

void loop() {
  if (Serial.available()) handleCommand(Serial.readStringUntil('\n'));
  static uint32_t lastFrame = 0;
  if (streaming && millis() - lastFrame >= sg::FRAME_INTERVAL_MS) {
    lastFrame = millis();
    sendFrame(scanMatrix(true));
  }
}
