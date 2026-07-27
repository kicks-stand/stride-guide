# Wiring Assumptions

## Matrix

The software acceptance target is 25 conductive rows crossing 25 conductive columns, producing 625 addressable intersections. Matrix dimensions remain compile-time configurable.

## Multiplexer banking

A CD74HC4067 provides 16 selectable channels. Addressing 25 rows and 25 columns therefore requires two row-side banks and two column-side banks. The firmware treats each pair as a logical 32-channel bank:

- Logical channels 0–15 select bank 0.
- Logical channels 16–24 select bank 1, physical channels 0–8.
- Channels 25–31 are unused.
- All banks are disabled before changing addresses.
- Only one row bank and one column bank are enabled during a sample.

The current code assumes active-low enable pins. Change `ENABLE_ACTIVE_LOW` if the hardware differs.

## Placeholder GPIO map

The assignments in `firmware/include/config.h` are placeholders, not verified Stride Guide wiring:

- Row address S0–S3: GPIO 16, 17, 18, 19.
- Column address S0–S3: GPIO 21, 22, 23, 25.
- Row bank enables: GPIO 26, 27.
- Column bank enables: GPIO 32, 33.
- ADC input: GPIO 34.

Do not wire the finished platform solely from this map. Confirm the specific ESP32 board, boot-strapping pins, input-only pins, and any conflicts with USB/UART peripherals.

## Electrical topology requiring confirmation

The firmware currently selects one logical row and one logical column and then samples a single ADC input. That abstraction is intentionally isolated because the final voltage-divider topology is not yet documented.

Before energizing the full matrix, confirm:

1. Which side is driven and at what voltage.
2. Which side feeds the ADC.
3. The value and location of the fixed resistor.
4. Whether inactive traces are high impedance.
5. Whether additional analog multiplexing or one ADC per bank is required.
6. That no selected row/column combination creates a direct short.
7. Whether diodes are included and how they affect polarity and ghosting.

The scanner disables all multiplexer banks immediately after every sample. This reduces unintended conductive paths but does not replace proper current limiting.

## First physical test

1. Test one row and one column with a current-limited bench supply or USB-powered prototype.
2. Confirm the unloaded ADC value.
3. Press one intersection and confirm a monotonic ADC change.
4. Test channels 0, 15, 16, and 24 on both axes to validate bank switching.
5. Run baseline calibration with no load.
6. Press one known intersection and verify the dashboard coordinate.
7. Only then connect and scan the complete 25×25 platform.
