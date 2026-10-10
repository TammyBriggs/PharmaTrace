import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../scan/scan_home_screen.dart';
import '../../core/main_navigation.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({Key? key}) : super(key: key);

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  final List<Map<String, String>> _onboardingData = [
    {
      "title": "Scan & Verify",
      "text":
          "Use your camera to scan the QR code on any supported medicine pack.",
      "image": "assets/images/onboarding_verify.png",
    },
    {
      "title": "Stay Safe",
      "text":
          "Instantly know if a drug is authentic, flagged, or expired before you consume it.",
      "image": "assets/images/onboarding_stay_safe.png",
    },
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                onPageChanged: (value) {
                  setState(() => _currentPage = value);
                },
                itemCount: _onboardingData.length,
                itemBuilder: (context, index) => Padding(
                  padding: const EdgeInsets.all(40.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Image.asset(
                        _onboardingData[index]["image"]!,
                        height: 250,
                        fit: BoxFit.contain,
                        errorBuilder: (context, error, stackTrace) =>
                            Container(
                          height: 250,
                          decoration: BoxDecoration(
                            color: Colors.grey[200],
                            shape: BoxShape.circle,
                          ),
                          child: const Center(
                            child: Icon(
                              Icons.image_not_supported,
                              size: 50,
                              color: Colors.grey,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 48),
                      Text(
                        _onboardingData[index]["title"]!,
                        style:
                            Theme.of(context).textTheme.headlineSmall?.copyWith(
                                  fontWeight: FontWeight.bold,
                                ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        _onboardingData[index]["text"]!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: AppTheme.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(24.0),
              child: _currentPage == _onboardingData.length - 1
                  ? Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: ElevatedButton(
                            onPressed: () {
                              Navigator.pushReplacement(
                                context,
                                MaterialPageRoute(
                                  builder: (context) =>
                                      MainNavigationScreen(),
                                ),
                              );
                            },
                            child: const Text('Get started'),
                          ),
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              side: const BorderSide(
                                color: AppTheme.primaryColor,
                                width: 1.5,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                            onPressed: () {
                              // TODO: Replace with the pharmacist login screen.
                              Navigator.pushReplacement(
                                context,
                                MaterialPageRoute(
                                  builder: (context) =>
                                      MainNavigationScreen(),
                                ),
                              );
                            },
                            child: const Text(
                              "I'm a pharmacist - sign in",
                              style: TextStyle(
                                color: AppTheme.primaryColor,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          'Patients can scan without signing in.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: AppTheme.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: List.generate(
                            _onboardingData.length,
                            (index) => Container(
                              margin: const EdgeInsets.only(right: 8),
                              height: 8,
                              width: _currentPage == index ? 24 : 8,
                              decoration: BoxDecoration(
                                color: _currentPage == index
                                    ? AppTheme.primaryColor
                                    : AppTheme.borderColor,
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                          ),
                        ),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            minimumSize: const Size(120, 50),
                          ),
                          onPressed: () {
                            _pageController.nextPage(
                              duration:
                                  const Duration(milliseconds: 300),
                              curve: Curves.ease,
                            );
                          },
                          child: const Text('Next'),
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}