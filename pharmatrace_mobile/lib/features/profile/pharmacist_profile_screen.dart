import 'package:flutter/material.dart';
import '../../core/theme.dart';
import 'report_product_screen.dart';

class PharmacistProfileScreen extends StatelessWidget {
  const PharmacistProfileScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profile & Settings')),
      body: ListView(
        padding: const EdgeInsets.all(24.0),
        children: [
          const CircleAvatar(
            radius: 40,
            backgroundColor: AppTheme.primaryColor,
            child: Icon(Icons.person, size: 40, color: Colors.white),
          ),
          const SizedBox(height: 16),
          const Text(
            'Dr. Aline Mutoni', // Placeholder for authenticated user
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          const Text(
            'Kigali Central Pharmacy',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppTheme.textSecondary),
          ),
          const SizedBox(height: 40),
          _buildMenuOption(
            context,
            icon: Icons.report_problem_outlined,
            title: 'Report a Product',
            subtitle: 'Flag a suspicious or falsified batch',
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const ReportProductScreen()),
              );
            },
          ),
          const Divider(height: 32),
          _buildMenuOption(
            context,
            icon: Icons.settings_outlined,
            title: 'Account Settings',
            onTap: () {},
          ),
          const Divider(height: 32),
          _buildMenuOption(
            context,
            icon: Icons.logout,
            title: 'Log Out',
            textColor: AppTheme.statusFlagged,
            onTap: () {
              // Sign out logic goes here
            },
          ),
        ],
      ),
    );
  }

  Widget _buildMenuOption(BuildContext context, {required IconData icon, required String title, String? subtitle, Color? textColor, required VoidCallback onTap}) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon, color: textColor ?? AppTheme.primaryColor),
      title: Text(title, style: TextStyle(fontWeight: FontWeight.w600, color: textColor ?? AppTheme.textPrimary)),
      subtitle: subtitle != null ? Text(subtitle, style: const TextStyle(color: AppTheme.textSecondary)) : null,
      trailing: const Icon(Icons.chevron_right, color: AppTheme.borderColor),
      onTap: onTap,
    );
  }
}