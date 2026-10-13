import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../../core/auth_manager.dart';
import '../onboarding/onboarding_screen.dart';
import 'report_product_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({Key? key}) : super(key: key);

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final bool isPharmacist = AuthManager().isPharmacist;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile & settings', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 24)),
        centerTitle: false,
      ),
      body: ListView(
        padding: const EdgeInsets.all(24.0),
        children: [
          // User Card[cite: 18]
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: AppTheme.borderColor),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(color: const Color(0xFFECFDF5), shape: BoxShape.circle),
                  child: const Icon(Icons.person_outline, color: AppTheme.primaryColor),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        AuthManager().userName,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)
                      ),
                      const SizedBox(height: 4),
                      if (isPharmacist) ...[
                        const Text('Signed in • Remera sector', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                        const Text('Gasabo District, Kigali', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                      ] else
                        const Text('Anonymous User', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                    ],
                  ),
                )
              ],
            ),
          ),
          const SizedBox(height: 32),

          // Privacy & Consent Card[cite: 18]
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: AppTheme.borderColor),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.shield_outlined, color: AppTheme.primaryColor),
                    SizedBox(width: 8),
                    Text('Privacy & consent', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  ],
                ),
                const SizedBox(height: 12),
                const Text(
                  'Camera access is used to scan packaging. Gallery access is used to upload reporting evidence. Reports share the photo, location, batch code and notes you choose to submit.\n\nDo not include patient information. Review the details before submitting a report.',
                  style: TextStyle(color: AppTheme.textSecondary, height: 1.4, fontSize: 13),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _buildMenuOption(context, icon: Icons.assignment_outlined, title: 'Read privacy notice', onTap: () {}),

          if (isPharmacist) ...[
            const SizedBox(height: 16),
            _buildMenuOption(
              context,
              icon: Icons.report_problem_outlined,
              title: 'Report suspicious drug',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (context) => const ReportProductScreen())),
            ),
            const SizedBox(height: 16),
            _buildMenuOption(context, icon: Icons.settings_outlined, title: 'Account Settings (Password Reset)', onTap: () {}),
          ],

          const SizedBox(height: 32),

          if (isPharmacist)
            OutlinedButton(
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 50),
                side: const BorderSide(color: AppTheme.primaryColor, width: 1.5),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: () async {
                await AuthManager().logout();
                Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (context) => const OnboardingScreen()), (route) => false);
              },
              child: const Text('Sign out', style: TextStyle(color: AppTheme.primaryColor, fontWeight: FontWeight.bold)),
            )
          else
            ElevatedButton(
              onPressed: () async {
                // Mock login flow for prototype testing
                await AuthManager().loginAsPharmacist();
                setState(() {}); // Refresh to show pharmacist UI
              },
              child: const Text('Sign in as pharmacist'),
            ),

          const SizedBox(height: 24),
          const Center(
            child: Text('PharmaTrace • Patient safety comes first.', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
          )
        ],
      ),
    );
  }

  Widget _buildMenuOption(BuildContext context, {required IconData icon, required String title, required VoidCallback onTap}) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon, color: AppTheme.primaryColor),
      title: Text(title, style: const TextStyle(color: AppTheme.primaryColor, fontWeight: FontWeight.w500)),
      onTap: onTap,
    );
  }
}