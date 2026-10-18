import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/theme.dart';
import '../../core/auth_manager.dart';
import '../onboarding/onboarding_screen.dart';
import 'report_product_screen.dart';
import '../auth/login_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({Key? key}) : super(key: key);

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

  @override
  Widget build(BuildContext context) {
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
                color: Colors.white,
                border: Border.all(color: AppTheme.borderColor),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Container(
                    width: 50,
                    height: 50,
                    decoration: const BoxDecoration(
                      color: Color(0xFFECFDF5),
                      shape: BoxShape.circle,
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: AuthManager().profilePicPath.isNotEmpty
                        ? Image.file(
                            File(AuthManager().profilePicPath),
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) {
                              return const Icon(
                                Icons.person_outline,
                                color: AppTheme.primaryColor,
                              );
                            },
                          )
                        : const Icon(
                            Icons.person_outline,
                            color: AppTheme.primaryColor,
                          ),
                  ),
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
                            'Signed in • ${AuthManager().pharmacistSector}',
                            style: const TextStyle(
                              color: AppTheme.textSecondary,
                              fontSize: 13,
                            ),
                          ),
                          const Text(
                            'Gasabo District, Kigali',
                            style: TextStyle(
                              color: AppTheme.textSecondary,
                              fontSize: 13,
                            ),
                          ),
                        ] else
                          const Text(
                            'Anonymous User',
                            style: TextStyle(
                              color: AppTheme.textSecondary,
                              fontSize: 13,
                            ),
                          ),
                      ],
                    ),
                  ),
                  const Icon(
                    Icons.edit_outlined,
                    color: AppTheme.textSecondary,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 32),

          // Privacy & Consent Card
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
                    Icon(
                      Icons.shield_outlined,
                      color: AppTheme.primaryColor,
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Privacy & consent',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const Text(
                  'Camera access is used to scan packaging. '
                  'Gallery access is used to upload reporting evidence. '
                  'Reports share the photo, location, batch code and notes '
                  'you choose to submit.\n\n'
                  'Do not include patient information. Review the details '
                  'before submitting a report.',
                  style: TextStyle(
                    color: AppTheme.textSecondary,
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
            onTap: () {},
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
              icon: Icons.settings_outlined,
              title: 'Account Settings (Password Reset)',
              onTap: () {},
            ),
          ],

          const SizedBox(height: 32),

          if (isPharmacist)
            OutlinedButton(
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 50),
                side: const BorderSide(
                  color: AppTheme.primaryColor,
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
              child: const Text(
                'Sign out',
                style: TextStyle(
                  color: AppTheme.primaryColor,
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
          const Center(
            child: Text(
              'PharmaTrace • Patient safety comes first.',
              style: TextStyle(
                color: AppTheme.textSecondary,
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
    required VoidCallback onTap,
  }) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon, color: AppTheme.primaryColor),
      title: Text(
        title,
        style: const TextStyle(
          color: AppTheme.primaryColor,
          fontWeight: FontWeight.w500,
        ),
      ),
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
  late final TextEditingController _sectorController;

  bool _isSaving = false;
  bool _isPickingImage = false;

  @override
  void initState() {
    super.initState();

    _nameController = TextEditingController(
      text: AuthManager().userName,
    );

    _sectorController = TextEditingController(
      text: AuthManager().pharmacistSector,
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _sectorController.dispose();
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

    setState(() => _isSaving = true);

    try {
      await AuthManager().updateProfile(
        name: _nameController.text.trim(),
        sector: _sectorController.text.trim(),
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
              TextField(
                controller: _sectorController,
                enabled: !_isSaving && !_isPickingImage,
                decoration: const InputDecoration(
                  labelText: 'Pharmacy Sector',
                ),
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
          onPressed: (_isSaving || _isPickingImage)
              ? null
              : _saveProfile,
          child: _isSaving
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                  ),
                )
              : const Text('Save'),
        ),
      ],
    );
  }
}