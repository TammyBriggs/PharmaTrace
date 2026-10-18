
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/theme.dart';
import '../../data/services/api_service.dart';

class ReportProductScreen extends StatefulWidget {
  const ReportProductScreen({Key? key}) : super(key: key);

  @override
  State<ReportProductScreen> createState() =>
      _ReportProductScreenState();
}

class _ReportProductScreenState extends State<ReportProductScreen> {
  final ImagePicker _picker = ImagePicker();

  // Controllers for the report form.
  final TextEditingController _locationController =
      TextEditingController(text: 'Remera');

  final TextEditingController _batchController =
      TextEditingController();

  final TextEditingController _notesController =
      TextEditingController();

  // Store the temporary path of the selected packaging photo.
  String? _imagePath;

  bool _isSubmitting = false;

  @override
  void dispose() {
    _locationController.dispose();
    _batchController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  // Let the user choose between taking a photo and selecting one
  // from the gallery.
  Future<void> _pickImage() async {
    final ImageSource? source =
        await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Wrap(
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Add packaging photo',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
            ),
            ListTile(
              leading: const Icon(
                Icons.camera_alt_outlined,
                color: AppTheme.primaryColor,
              ),
              title: const Text('Take a photo'),
              onTap: () => Navigator.pop(
                sheetContext,
                ImageSource.camera,
              ),
            ),
            ListTile(
              leading: const Icon(
                Icons.photo_library_outlined,
                color: AppTheme.primaryColor,
              ),
              title: const Text('Choose from gallery'),
              onTap: () => Navigator.pop(
                sheetContext,
                ImageSource.gallery,
              ),
            ),
          ],
        ),
      ),
    );

    if (source == null || !mounted) return;

    try {
      final XFile? image = await _picker.pickImage(
        source: source,
        imageQuality: 85,
      );

      if (image != null && mounted) {
        setState(() {
          _imagePath = image.path;
        });
      }
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Unable to select the photo. Please try again.',
          ),
        ),
      );
    }
  }

  // Submit the report and its optional packaging photo to the backend.
  Future<void> _submitReport() async {
    final batchId = _batchController.text.trim();
    final location = _locationController.text.trim();
    final notes = _notesController.text.trim();

    if (batchId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter the batch code.'),
        ),
      );
      return;
    }

    if (notes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please provide details about the report.'),
        ),
      );
      return;
    }

    if (location.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter the pharmacy location.'),
        ),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      // The current API accepts batch ID, reason and optional image.
      // Include the pharmacy location in the reason until the backend
      // supports a separate location field.
      final reason =
          'Pharmacy location: $location\n'
          'Notes: $notes';

      await ApiService.submitReport(
        batchId,
        reason,
        _imagePath,
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Report submitted successfully.'),
        ),
      );

      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;

      final errorMessage =
          e.toString().replaceFirst('Exception: ', '');

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to submit report: $errorMessage'),
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Report suspicious drug',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 22,
          ),
        ),
        centerTitle: false,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'PHARMACIST REPORT • SIGNED IN',
              style: TextStyle(
                color: AppTheme.primaryColor,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Help flag a product that needs review.',
              style: TextStyle(
                color: AppTheme.textSecondary,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 24),

            const Text(
              'Packaging photo',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 8),

            // Tap this container to take a photo or choose one
            // from the device gallery.
            InkWell(
              onTap: _pickImage,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  border: Border.all(
                    color: AppTheme.borderColor,
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.camera_alt_outlined,
                          color: AppTheme.primaryColor,
                        ),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment:
                                CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Add packaging photo',
                                style: TextStyle(
                                  color: AppTheme.primaryColor,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              Text(
                                'Show the QR code and batch label.',
                                style: TextStyle(
                                  color: AppTheme.textSecondary,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Icon(
                          _imagePath == null
                              ? Icons.add
                              : Icons.edit_outlined,
                          color: AppTheme.primaryColor,
                        ),
                      ],
                    ),

                    // Preview the selected packaging photo.
                    if (_imagePath != null) ...[
                      const SizedBox(height: 16),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.file(
                          File(_imagePath!),
                          width: double.infinity,
                          height: 200,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) {
                            return const SizedBox(
                              height: 100,
                              child: Center(
                                child: Text(
                                  'Unable to display this image. '
                                  'Tap to select another.',
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Tap to replace the selected photo.',
                        style: TextStyle(
                          color: AppTheme.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            const Text(
              'Pharmacy location — Gasabo sector',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _locationController,
              decoration: InputDecoration(
                prefixIcon: const Icon(
                  Icons.location_on_outlined,
                  color: AppTheme.primaryColor,
                ),
                hintText: 'Remera',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(
                    color: AppTheme.borderColor,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Gasabo District, Kigali\n'
              'Other sectors: Kacyiru, Kimironko',
              style: TextStyle(
                color: AppTheme.textSecondary,
                fontSize: 12,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24),

            const Text(
              'Batch code',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _batchController,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(
                prefixIcon: const Icon(
                  Icons.search,
                  color: AppTheme.primaryColor,
                ),
                hintText: 'RW-2026-0523',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(
                    color: AppTheme.borderColor,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Copy the code exactly as printed on the box.',
              style: TextStyle(
                color: AppTheme.textSecondary,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 24),

            const Text(
              'Notes',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _notesController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText:
                    'Batch flagged during scan.\n'
                    'Packaging held for review.',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(
                    color: AppTheme.borderColor,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Do not include patient names or medical details.',
              style: TextStyle(
                color: AppTheme.textSecondary,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 32),

            const Text(
              'Submitting shares these details with the review team. '
              'It does not confirm a counterfeit result.',
              style: TextStyle(
                color: AppTheme.textSecondary,
                fontSize: 12,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 16),

            // Submit the report only after the backend responds successfully.
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submitReport,
                child: _isSubmitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Text('Submit report'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
