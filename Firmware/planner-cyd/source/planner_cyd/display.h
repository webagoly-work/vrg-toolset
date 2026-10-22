// Board + display configuration for the CYD (LovyanGFX), and the colour palette.
#pragma once

#define CYD_24R 1   // ESP32-2432S024R  2.4" resistive
#define CYD_24C 2   // ESP32-2432S024C  2.4" capacitive
#define CYD_28R 3   // ESP32-2432S028R  2.8" classic
#ifndef CYD_BOARD
#define CYD_BOARD CYD_24R
#endif

// Display controller. The tested 2.4" board reports ID 81 81 B3 (Sitronix ST7789
// family); most 2.8" boards are ILI9341. Run ../panel_probe if unsure.
#ifndef PANEL_ST7789
#define PANEL_ST7789 (CYD_BOARD != CYD_28R)
#endif
#define PANEL_BGR false  // true if red and blue are swapped

#define LGFX_USE_V1
#include <LovyanGFX.hpp>

class LGFX : public lgfx::LGFX_Device {
#if PANEL_ST7789
  lgfx::Panel_ST7789 _panel;
#else
  lgfx::Panel_ILI9341 _panel;
#endif
  lgfx::Bus_SPI _bus;
  lgfx::Light_PWM _light;
#if CYD_BOARD == CYD_24C
  lgfx::Touch_CST816S _touch;
#else
  lgfx::Touch_XPT2046 _touch;
#endif

public:
  LGFX() {
    {
      auto c = _bus.config();
      c.spi_host = SPI2_HOST;
      c.spi_mode = 0;
      c.freq_write = 40000000;
      c.freq_read = 16000000;
      c.spi_3wire = false;
      c.use_lock = true;
      c.dma_channel = SPI_DMA_CH_AUTO;
      c.pin_sclk = 14;
      c.pin_mosi = 13;
      c.pin_miso = 12;
      c.pin_dc = 2;
      _bus.config(c);
      _panel.setBus(&_bus);
    }
    {
      auto c = _panel.config();
      c.pin_cs = 15;
      c.pin_rst = -1;
      c.pin_busy = -1;
      c.panel_width = 240;
      c.panel_height = 320;
      c.readable = true;
      c.invert = false;  // applied at runtime from settings
      c.rgb_order = PANEL_BGR;
      c.bus_shared = true;
      _panel.config(c);
    }
    {
      auto c = _light.config();
      c.pin_bl = (CYD_BOARD == CYD_28R) ? 21 : 27;
      c.invert = false;
      c.freq = 12000;
      c.pwm_channel = 7;
      _light.config(c);
      _panel.setLight(&_light);
    }
    {
      auto c = _touch.config();
#if CYD_BOARD == CYD_24C
      c.x_min = 0; c.x_max = 239; c.y_min = 0; c.y_max = 319;
      c.i2c_port = 0; c.i2c_addr = 0x15; c.freq = 400000;
      c.pin_sda = 33; c.pin_scl = 32; c.pin_int = 21; c.pin_rst = 25;
      c.bus_shared = false;
#elif CYD_BOARD == CYD_28R
      c.x_min = 300; c.x_max = 3900; c.y_min = 200; c.y_max = 3700;
      c.spi_host = SPI3_HOST; c.freq = 1000000;
      c.pin_sclk = 25; c.pin_mosi = 32; c.pin_miso = 39; c.pin_cs = 33; c.pin_int = 36;
      c.bus_shared = false;
#else
      c.x_min = 300; c.x_max = 3900; c.y_min = 200; c.y_max = 3700;
      c.spi_host = SPI2_HOST; c.freq = 1000000;
      c.pin_sclk = 14; c.pin_mosi = 13; c.pin_miso = 12; c.pin_cs = 33; c.pin_int = 36;
      c.bus_shared = true;
#endif
      c.offset_rotation = 0;
      _touch.config(c);
      _panel.setTouch(&_touch);
    }
    setPanel(&_panel);
  }
};

static constexpr uint16_t rgb(uint8_t r, uint8_t g, uint8_t b) {
  return (uint16_t)(((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3));
}

static const uint16_t C_BG = rgb(8, 11, 18);
static const uint16_t C_PANEL = rgb(22, 28, 40);
static const uint16_t C_TRACK = rgb(34, 40, 54);
static const uint16_t C_TEXT = rgb(240, 244, 250);
static const uint16_t C_SOFT = rgb(205, 212, 225);
static const uint16_t C_MUTED = rgb(130, 140, 160);
static const uint16_t C_NEUTRAL = rgb(70, 78, 98);
static const uint16_t C_OK = rgb(60, 210, 110);
static const uint16_t C_BAD = rgb(230, 70, 70);
static const uint16_t C_GOLD = rgb(255, 205, 60);
static const uint16_t C_BLUE = rgb(24, 115, 255);
static const uint16_t C_ORANGE = rgb(255, 138, 21);

// One colour per data link, used for the header chip and the Devices page.
static const uint16_t C_SRC_USB = rgb(150, 120, 230);
static const uint16_t C_SRC_WIFI = rgb(40, 190, 170);
static const uint16_t C_SRC_BT = rgb(90, 120, 255);
