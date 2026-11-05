import 'package:flutter/material.dart';
import 'core/theme.dart';
import 'core/theme_controller.dart';
import 'core/auth_manager.dart';
import 'core/main_navigation.dart';
import 'features/auth/change_password_screen.dart';
import 'features/onboarding/splash_screen.dart';
import 'data/services/scan_history_manager.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await AuthManager().init();
  await ScanHistoryManager().init();
  await ThemeController().init();

  runApp(const PharmaTraceApp());
}

/// Root widget of the PharmaTrace application.
class PharmaTraceApp extends StatelessWidget {
  const PharmaTraceApp({super.key});

  @override
  Widget build(BuildContext context) {
    final bool startAtMain =
        AuthManager().hasCompletedOnboarding;

    // Rebuilds the whole app when the light/dark switch in Settings changes.
    return ListenableBuilder(
      listenable: ThemeController(),
      builder: (context, _) => MaterialApp(
        title: 'PharmaTrace',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: ThemeController().mode,

        // Returning users skip the splash/onboarding flow.
        // New users start at the splash screen.
        // A pharmacist who closed the app before replacing a temporary password lands back on that step.
        home: startAtMain
            ? (AuthManager().mustChangePassword
                ? const ChangePasswordScreen(forced: true)
                : const MainNavigationScreen())
            : const SplashScreen(),
      ),
    );
  }
}
