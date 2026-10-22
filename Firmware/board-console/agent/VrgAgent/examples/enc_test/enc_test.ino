// enc_test - rotary encoder on the dev board's ENC-1 pins (CLK 39, DT 40, SW 41), with the
// Board Console agent: the Console shows "enc_test 1.1", the ENC-1 path, and the three pins live.
// board_pins.h comes from the Board Console (board_pins.h tab) for a setup with ENC-1 on.
#include "board_pins.h"
#include <VrgAgent.h>

volatile long steps = 0;
volatile uint8_t last = 0;

void IRAM_ATTR onTurn() {
  static const int8_t T[16] = { 0, -1, 1, 0, 1, 0, 0, -1, -1, 0, 0, 1, 0, 1, -1, 0 };
  uint8_t s = (digitalRead(PIN_ENC1_CLK) << 1) | digitalRead(PIN_ENC1_DT);
  steps += T[(last << 2) | s];
  last = s;
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_ENC1_CLK, INPUT_PULLUP);
  pinMode(PIN_ENC1_DT, INPUT_PULLUP);
  pinMode(PIN_ENC1_SW, INPUT_PULLUP);
  last = (digitalRead(PIN_ENC1_CLK) << 1) | digitalRead(PIN_ENC1_DT);
  attachInterrupt(PIN_ENC1_CLK, onTurn, CHANGE);
  attachInterrupt(PIN_ENC1_DT, onTurn, CHANGE);
  VRG_AGENT_BEGIN("enc_test", "1.1");
  Serial.println("enc_test ready: turn or press the knob");
}

void loop() {
  static long shown = 0;
  static bool pressed = false;
  long pos = steps / 4;   // an EC-11 gives 4 steps per click
  if (pos != shown) { shown = pos; Serial.printf("pos %ld\n", pos); }
  bool b = digitalRead(PIN_ENC1_SW) == LOW;
  if (b != pressed) { pressed = b; Serial.println(b ? "press" : "release"); delay(10); }
}
