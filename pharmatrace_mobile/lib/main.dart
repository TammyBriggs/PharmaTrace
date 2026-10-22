import 'package:flutter/material.dart';
import 'core/theme.dart';
import 'core/auth_manager.dart';
import 'core/main_navigation.dart';
import 'features/onboarding/splash_screen.dart';
import 'data/services/scan_history_manager.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await AuthManager().init();
  await ScanHistoryManager().init();

  runApp(const PharmaTraceApp());
}

/// Root widget of the PharmaTrace application.
class PharmaTraceApp extends StatelessWidget {
  const PharmaTraceApp({super.key});

  @override
  Widget build(BuildContext context) {
    final bool startAtMain =
        AuthManager().hasCompletedOnboarding;

    return MaterialApp(
      title: 'PharmaTrace',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,

      // Returning users skip the splash/onboarding flow.
      // New users start at the splash screen.
      home: startAtMain
          ? const MainNavigationScreen()
          : const SplashScreen(),
    );
  }
}