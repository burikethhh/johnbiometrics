# JohnBiometrics (FingerGate)

Web-Based Fingerprint Recognition Access Control System.

## Project Structure
- `frontend/`: React web application with Universal Biometric scanner support (WebAuthn, USB Serial, DigitalPersona, SecuGen, Mantra, ZKTeco)
- `backend/`: Node.js / Express.js REST API with MySQL database integration
- `bridge/`: Universal biometric bridge service for Windows hardware
- `hardware/`: Arduino firmware for USB optical sensor biometric boxes
- `seed-data.js`: Database initialization and seeding script

## Setup & Running

### Backend
```bash
cd backend
npm install
npm start
```

### Frontend
```bash
cd frontend
npm install
npm start
```
