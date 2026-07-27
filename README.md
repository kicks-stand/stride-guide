# Stride Guide — Stage 1 Pressure Diagnostics

This repository contains the first Stride Guide hardware-validation build: an ESP32 scanner for a configurable resistive pressure matrix and a branded local dashboard that renders the complete matrix as a real-time heatmap.

The current acceptance configuration is **25 rows × 25 columns = 625 sensing intersections**.

## What is implemented

- ESP32 firmware using PlatformIO and the Arduino framework.
- Two-bank CD74HC4067 addressing for 25 row channels and 25 column channels.
- Configurable ADC sampling, multiplexer settling, baseline correction, scan cadence, and inversion.
- Versioned newline-delimited JSON frames using row-major cell ordering.
- React/TypeScript/Vite diagnostic dashboard.
- Web Serial USB connection at 921600 baud.
- Deterministic simulation scenarios for two feet, one foot, moving contact, noise, dead rows, dead columns, and saturation.
- Heatmap threshold, scale, rotation, horizontal mirroring, vertical mirroring, cell inspection, and fault metrics.
- Unit tests for the 625-cell contract, row-major indexing, frame validation, and orientation transforms.

## Repository layout

```text
firmware/                 ESP32 PlatformIO project
dashboard/                React diagnostic dashboard
dashboard/src/protocol.ts Shared frame schema and coordinate transforms
dashboard/src/simulator.ts Hardware-independent test scenarios
docs/                     Hardware assumptions and serial protocol
```

## Run the dashboard

Requirements: Node.js 20 or newer and a Chromium-based desktop browser for Web Serial.

```bash
npm install
npm run dev
```

Open the URL printed by Vite. The dashboard starts in simulation mode and displays a 25×25 two-foot pressure pattern.

Production build and validation:

```bash
npm run typecheck
npm test
npm run build
```

## Build and flash the firmware

Requirements: PlatformIO and an ESP32 development board.

```bash
cd firmware
pio run
pio run --target upload
pio device monitor
```

Before connecting the sensor platform, review `firmware/include/config.h` and `docs/WIRING_ASSUMPTIONS.md`. The current GPIO assignments are explicit placeholders and must be matched to the physical wiring harness.

## Device commands

Send each command as a newline-terminated ASCII line:

```text
PING
START_STREAM
STOP_STREAM
CALIBRATE_BASELINE
GET_CONFIG
```

Keep the platform completely unloaded during baseline calibration.

## Frame contract

The firmware emits one JSON object per line. A valid 25×25 frame contains exactly 625 integer values in row-major order:

```text
index = row * 25 + column
```

The dashboard rejects frames whose dimensions do not match the value count.

## Current limitation

The software path is implemented, but physical validation still requires the final electrical topology, ESP32 model, CD74HC4067 enable/address wiring, and voltage-divider arrangement. Relative ADC readings must not be represented as PSI, kPa, force, or a medical measurement.
