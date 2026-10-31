/**
 * FingerGate - Universal Biometric Box Firmware
 * 
 * Hardware Requirements:
 * - Arduino Uno / Nano / ESP32
 * - Optical Fingerprint Sensor (AS608, R307, R503, FPM10A)
 * - Green LED (Pin 4), Red LED (Pin 5), Buzzer (Pin 6)
 * - RX (Pin 2 to Sensor TX), TX (Pin 3 to Sensor RX via 1k resistor or direct)
 * 
 * Communication:
 * - Direct Web Serial API with FingerGate browser client (Chrome / Edge)
 * - Baud Rate: 57600
 */

#include <SoftwareSerial.h>
#include <Adafruit_Fingerprint.h>

// Sensor Serial Pins
SoftwareSerial mySerial(2, 3); // RX, TX
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

const int LED_GREEN = 4;
const int LED_RED = 5;
const int BUZZER = 6;

void setup() {
  Serial.begin(57600);
  while (!Serial);
  delay(100);

  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUZZER, OUTPUT);

  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED, LOW);

  finger.begin(57600);
  
  if (finger.verifyPassword()) {
    Serial.println("FINGERPRINT_BOX_READY");
    beep(1, 100);
  } else {
    Serial.println("SENSOR_NOT_FOUND");
    beep(3, 200);
  }
}

void loop() {
  // Check for commands from FingerGate browser client
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd == "CAPTURE" || cmd == "SCAN") {
      captureFingerprint();
    } else if (cmd == "STATUS" || cmd == "PING") {
      Serial.println("ONLINE:R307_OPTICAL_SENSOR");
    } else if (cmd.startsWith("ACCESS_GRANTED")) {
      accessGranted();
    } else if (cmd.startsWith("ACCESS_DENIED")) {
      accessDenied();
    }
  }

  // Also auto-detect if finger is pressed onto sensor
  int p = finger.getImage();
  if (p == FINGERPRINT_OK) {
    processFingerprint();
  }
}

void captureFingerprint() {
  Serial.println("WAITING_FOR_FINGER");
  unsigned long start = millis();
  int p = -1;

  while (millis() - start < 10000) { // 10 second timeout
    p = finger.getImage();
    if (p == FINGERPRINT_OK) break;
    delay(50);
  }

  if (p != FINGERPRINT_OK) {
    Serial.println("ERROR:TIMEOUT_OR_NO_FINGER");
    return;
  }

  processFingerprint();
}

void processFingerprint() {
  int p = finger.image2Tz();
  if (p != FINGERPRINT_OK) {
    Serial.println("ERROR:IMAGE_MESSY");
    beep(2, 100);
    return;
  }

  // Search local database if present
  p = finger.fingerFastSearch();
  if (p == FINGERPRINT_OK) {
    // Found ID
    Serial.print("MATCH:ID=");
    Serial.print(finger.fingerID);
    Serial.print(":CONFIDENCE=");
    Serial.println(finger.confidence);
    beep(1, 150);
  } else {
    // Return template token based on sensor capture
    Serial.print("TEMPLATE:BOX_R307_");
    Serial.print(millis());
    Serial.print("_SIG=");
    Serial.println(finger.confidence);
    beep(1, 100);
  }
}

void accessGranted() {
  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(BUZZER, HIGH);
  delay(200);
  digitalWrite(BUZZER, LOW);
  delay(800);
  digitalWrite(LED_GREEN, LOW);
}

void accessDenied() {
  digitalWrite(LED_RED, HIGH);
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER, HIGH);
    delay(100);
    digitalWrite(BUZZER, LOW);
    delay(100);
  }
  digitalWrite(LED_RED, LOW);
}

void beep(int count, int ms) {
  for (int i = 0; i < count; i++) {
    digitalWrite(BUZZER, HIGH);
    delay(ms);
    digitalWrite(BUZZER, LOW);
    if (i < count - 1) delay(ms);
  }
}
