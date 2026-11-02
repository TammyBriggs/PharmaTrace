import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../../core/widgets/brand_logo.dart';
import 'welcome_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({Key? key}) : super(key: key);

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    // Controls the speed of the pulse
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    // Gentle size variation (scale from 95% to 105%)
    _animation = Tween<double>(begin: 0.95, end: 1.05).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );

    // Route to Welcome screen after 3 seconds
    Future.delayed(const Duration(seconds: 3), () {
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const WelcomeScreen()),
      );
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Same logo as the web dashboard, matching the native splash screen.
            ScaleTransition(
              scale: _animation,
              child: const BrandLogo(width: 120),
            ),
            const SizedBox(height: 24),
            Text(
              'PharmaTrace',
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w600,
                color: context.colors.accent,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
