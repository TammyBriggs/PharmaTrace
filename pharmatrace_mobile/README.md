# PharmaTrace mobile app

Flutter app for patients and pharmacists. Patients scan a pack without signing in. Pharmacists sign in to record sales and report suspicious products. The full setup is in the [main README](../README.md).

```bash
flutter pub get
dart run flutter_native_splash:create
flutter run --dart-define=API_BASE_URL=https://<your-ngrok-address>
```

```
lib/
├── core/        theme (light and dark), sectors, config, formatting, shared widgets
├── data/        models (batch, batch history) and the API service
└── features/    scan, verification, history, profile, auth, onboarding
```
