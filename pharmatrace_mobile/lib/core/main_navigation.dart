import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'strings.dart';
import '../features/scan/scan_home_screen.dart';
import '../features/history/scan_history_screen.dart';
import '../features/profile/pharmacist_profile_screen.dart';

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _selectedIndex = 0;
  DateTime? _lastPressedAt;

  final List<Widget> _screens = [
    const ScanHomeScreen(),
    const ScanHistoryScreen(),
    const ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;

        final now = DateTime.now();
        final maxDuration = const Duration(seconds: 2);
        final isWarning = _lastPressedAt == null || now.difference(_lastPressedAt!) > maxDuration;

        if (isWarning) {
          _lastPressedAt = DateTime.now();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(context.tr('nav.backAgain')),
              duration: const Duration(seconds: 2),
            ),
          );
        } else {
          SystemNavigator.pop(); // Closes the app
        }
      },
      child: Scaffold(
        body: _screens[_selectedIndex],
        bottomNavigationBar: BottomNavigationBar(
          currentIndex: _selectedIndex,
          onTap: (index) => setState(() => _selectedIndex = index),
          items: [
            BottomNavigationBarItem(icon: const Icon(Icons.qr_code_scanner), label: context.tr('nav.scan')),
            BottomNavigationBarItem(icon: const Icon(Icons.history), label: context.tr('nav.history')),
            BottomNavigationBarItem(icon: const Icon(Icons.person_outline), label: context.tr('nav.profile')),
          ],
        ),
      ),
    );
  }
}