import 'package:flutter/material.dart';
import 'core/theme.dart';
import 'features/onboarding/splash_screen.dart';

void main() {
  runApp(const PharmaTraceApp());
}

/// Root widget of the PharmaTrace application.
class PharmaTraceApp extends StatelessWidget {
  const PharmaTraceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PharmaTrace',
      // Removes the debug banner in the top right corner for a cleaner UI
      debugShowCheckedModeBanner: false, 
      // Applies the global Figma theme we created in Phase 1
      theme: AppTheme.lightTheme, 
      // Sets the Welcome Screen as the initial starting point
      home: const SplashScreen(), 
    );
  }
}
