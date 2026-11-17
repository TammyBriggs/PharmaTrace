import 'package:flutter/material.dart';
import '../../core/strings.dart';
import '../../core/theme.dart';
import '../../core/widgets/language_selector.dart';
import 'onboarding_screen.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // First screen a new user sees: the language can be chosen before anything else is read.
              const Align(alignment: Alignment.centerRight, child: LanguageSelector()),
              const Spacer(),
              // Placeholder for the main welcome illustration (01-welcome.png)
              Image.asset(
                'assets/images/welcome_illustration.png',
                height: 250,
                errorBuilder: (context, error, stackTrace) => 
                    const Icon(Icons.security, size: 120, color: AppTheme.primaryColor),
              ),
              const SizedBox(height: 48),
              Text(
                context.tr('welcome.title'),
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: context.colors.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Text(
                context.tr('welcome.body'),
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: context.colors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              ElevatedButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const OnboardingScreen()),
                  );
                },
                child: Text(context.tr('welcome.start')),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
