import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/theme.dart';
import '../../core/theme_controller.dart';
import '../../core/auth_manager.dart';
import '../../core/sectors.dart';
import '../../core/widgets/sector_dropdown.dart';
import '../onboarding/onboarding_screen.dart';
import 'privacy_notice_screen.dart';
import 'report_product_screen.dart';
import '../auth/change_password_screen.dart';
import '../auth/login_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final bool isPharmacist = AuthManager().isPharmacist;

  void _showEditProfileDialog() {
    showDialog<void>(
      context: context,
      builder: (_) => _EditProfileDialog(
        onUpdated: () {
          if (mounted) {
            setState(() {});
          }
        },
      ),
    );
  }

  Widget _avatar(BuildContext context) {
    final c = context.colors;
    final pic = AuthManager().profilePicPath;
    final fallback = Icon(Icons.person_outline, color: c.accent);

    Widget child = fallback;
    if (pic.isNotEmpty) {
      child = pic.startsWith('http')
          ? Image.network(
              pic,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) => fallback,
            )
          : Image.file(
              File(pic),
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) => fallback,
            );
    }

    return Container(
      width: 50,
      height: 50,
      decoration: BoxDecoration(color: c.successBg, shape: BoxShape.circle),
      clipBehavior: Clip.antiAlias,
      child: child,
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final district = districtOfSector(AuthManager().pharmacistSector);

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Profile & settings',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 24,
          ),
        ),
        centerTitle: false,
      ),
      body: ListView(
        padding: const EdgeInsets.all(24.0),
        children: [
          // User Profile Card
          InkWell(
            onTap: _showEditProfileDialog,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: c.surface,
                border: Border.all(color: c.border),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  _avatar(context),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          AuthManager().userName,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 4),
                        if (isPharmacist) ...[
                          Text(
                            normalizeSector(AuthManager().pharmacistSector) != null
                                ? 'Signed in • ${normalizeSector(AuthManager().pharmacistSector)} sector'
                                : 'Signed in • sector not set',
                            style: TextStyle(color: c.textSecondary, fontSize: 13),
                          ),
                          if (district != null)
                            Text(
                              '$district District, Kigali',
                              style: TextStyle(color: c.textSecondary, fontSize: 13),
                            ),
                        ] else
                          Text(
                            'Anonymous User',
                            style: TextStyle(color: c.textSecondary, fontSize: 13),
                          ),
                      ],
                    ),
                  ),
                  Icon(Icons.edit_outlined, color: c.textSecondary),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Appearance
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            decoration: BoxDecoration(
              color: c.surface,
              border: Border.all(color: c.border),
              borderRadius: BorderRadius.circular(12),
            ),
            child: SwitchListTile(
              contentPadding: EdgeInsets.zero,
              secondary: Icon(
                ThemeController().isDark ? Icons.dark_mode_outlined : Icons.light_mode_outlined,
                color: c.accent,
              ),
              title: const Text(
                'Dark mode',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              subtitle: Text(
                'Easier on the eyes in low light.',
                style: TextStyle(color: c.textSecondary, fontSize: 13),
              ),
              value: ThemeController().isDark,
              onChanged: (value) async {
                await ThemeController().setDark(value);
                if (mounted) setState(() {});
              },
            ),
          ),
          const SizedBox(height: 24),

          // Privacy & Consent Card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: c.surface,
              border: Border.all(color: c.border),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.shield_outlined, color: c.accent),
                    const SizedBox(width: 8),
                    const Text(
                      'Privacy & consent',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  isPharmacist
                      ? 'Camera access is used to scan packaging. '
                          'Gallery access is used to change your profile photo and upload reporting evidence. '
                          'Reports share the photo, location, batch code and notes '
                          'you choose to submit.\n\n'
                          'Do not include patient information. Review the details '
                          'before submitting a report.'
                      : 'Camera access is used to scan packaging. '
                          'Gallery access is used to change or upload profile photos.',
                  style: TextStyle(
                    color: c.textSecondary,
                    height: 1.4,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          _buildMenuOption(
            context,
            icon: Icons.assignment_outlined,
            title: 'Read privacy notice',
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => const PrivacyNoticeScreen(),
              ),
            ),
          ),

          if (isPharmacist) ...[
            const SizedBox(height: 16),
            _buildMenuOption(
              context,
              icon: Icons.report_problem_outlined,
              title: 'Report suspicious drug',
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const ReportProductScreen(),
                ),
              ),
            ),
            const SizedBox(height: 16),
            _buildMenuOption(
              context,
              icon: Icons.lock_reset_outlined,
              title: 'Change password',
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const ChangePasswordScreen(),
                ),
              ),
            ),
          ],

          const SizedBox(height: 32),

          if (isPharmacist)
            OutlinedButton(
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 50),
                side: BorderSide(
                  color: c.accent,
                  width: 1.5,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              onPressed: () async {
                await AuthManager().logout();

                if (!context.mounted) return;

                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const OnboardingScreen(),
                  ),
                  (route) => false,
                );
              },
              child: Text(
                'Sign out',
                style: TextStyle(
                  color: c.accent,
                  fontWeight: FontWeight.bold,
                ),
              ),
            )
          else
            ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const LoginScreen(),
                  ),
                );
              },
              child: const Text('Sign in as pharmacist'),
            ),

          const SizedBox(height: 24),
          Center(
            child: Text(
              'PharmaTrace • Patient safety comes first.',
              style: TextStyle(
                color: c.textSecondary,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMenuOption(
    BuildContext context, {
    required IconData icon,
    required String title,
    String? subtitle,
    required VoidCallback? onTap,
  }) {
    final c = context.colors;
    final bool enabled = onTap != null;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      enabled: enabled,
      leading: Icon(icon, color: enabled ? c.accent : c.textSecondary),
      title: Text(
        title,
        style: TextStyle(
          color: enabled ? c.accent : c.textSecondary,
          fontWeight: FontWeight.w500,
        ),
      ),
      subtitle: subtitle == null
          ? null
          : Text(subtitle, style: TextStyle(color: c.textSecondary, fontSize: 12)),
      onTap: onTap,
    );
  }
}

class _EditProfileDialog extends StatefulWidget {
  final VoidCallback onUpdated;

  const _EditProfileDialog({
    required this.onUpdated,
  });

  @override
  State<_EditProfileDialog> createState() => _EditProfileDialogState();
}

class _EditProfileDialogState extends State<_EditProfileDialog> {
  late final TextEditingController _nameController;
  String? _sector;

  bool _isSaving = false;
  bool _isPickingImage = false;

  @override
  void initState() {
    super.initState();

    _nameController = TextEditingController(
      text: AuthManager().userName,
    );

    _sector = normalizeSector(AuthManager().pharmacistSector);
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _pickProfilePicture() async {
    if (_isSaving || _isPickingImage) return;

    setState(() => _isPickingImage = true);

    try {
      final image = await ImagePicker().pickImage(
        source: ImageSource.gallery,
      );

      if (image == null || !mounted) return;

      await AuthManager().updateProfile(
        picPath: image.path,
      );

      if (!mounted) return;

      widget.onUpdated();
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not select the profile picture.'),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isPickingImage = false);
      }
    }
  }

  Future<void> _saveProfile() async {
    if (_isSaving || _isPickingImage) return;

    if (AuthManager().isPharmacist && _sector == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please choose your sector.')),
      );
      return;
    }

    setState(() => _isSaving = true);

    try {
      await AuthManager().updateProfile(
        name: _nameController.text.trim(),
        sector: AuthManager().isPharmacist ? _sector : null,
      );

      if (!mounted) return;

      widget.onUpdated();
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;

      setState(() => _isSaving = false);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not save profile: $e'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Edit Profile'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _nameController,
              enabled: !_isSaving && !_isPickingImage,
              decoration: const InputDecoration(
                labelText: 'Name / Account Title',
              ),
            ),
            if (AuthManager().isPharmacist) ...[
              const SizedBox(height: 16),
              SectorDropdown(
                value: _sector,
                label: 'Pharmacy sector',
                enabled: !_isSaving && !_isPickingImage,
                onChanged: (value) => setState(() => _sector = value),
              ),
            ],
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: (_isSaving || _isPickingImage)
                  ? null
                  : _pickProfilePicture,
              icon: _isPickingImage
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.photo_library),
              label: Text(
                _isPickingImage
                    ? 'Selecting picture...'
                    : 'Choose Profile Picture',
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: (_isSaving || _isPickingImage)
              ? null
              : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(minimumSize: const Size(90, 44)),
          onPressed: (_isSaving || _isPickingImage)
              ? null
              : _saveProfile,
          child: _isSaving
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text('Save'),
        ),
      ],
    );
  }
}
