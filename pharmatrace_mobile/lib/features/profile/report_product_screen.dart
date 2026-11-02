import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/auth_manager.dart';
import '../../core/sectors.dart';
import '../../core/theme.dart';
import '../../core/widgets/sector_dropdown.dart';
import '../../data/services/api_service.dart';

class ReportProductScreen extends StatefulWidget {
  /// Pre-fills the batch number when reporting straight from a scan result.
  final String? initialBatchNo;

  const ReportProductScreen({Key? key, this.initialBatchNo}) : super(key: key);

  @override
  State<ReportProductScreen> createState() => _ReportProductScreenState();
}

class _ReportProductScreenState extends State<ReportProductScreen> {
  final ImagePicker _picker = ImagePicker();

  late final TextEditingController _batchController;
  final TextEditingController _notesController = TextEditingController();

  // The pharmacy's sector, starting from the one on the pharmacist's profile.
  String? _sector;

  // Store the temporary path of the selected packaging photo.
  String? _imagePath;

  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _batchController = TextEditingController(text: widget.initialBatchNo ?? '');
    _sector = normalizeSector(AuthManager().pharmacistSector);
  }

  @override
  void dispose() {
    _batchController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _toast(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  // Let the user choose between taking a photo and selecting one
  // from the gallery.
  Future<void> _pickImage() async {
    final ImageSource? source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Wrap(
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Add packaging photo',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ),
            ListTile(
              leading: Icon(Icons.camera_alt_outlined, color: sheetContext.colors.accent),
              title: const Text('Take a photo'),
              onTap: () => Navigator.pop(sheetContext, ImageSource.camera),
            ),
            ListTile(
              leading: Icon(Icons.photo_library_outlined, color: sheetContext.colors.accent),
              title: const Text('Choose from gallery'),
              onTap: () => Navigator.pop(sheetContext, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );

    if (source == null || !mounted) return;

    try {
      final XFile? image = await _picker.pickImage(source: source, imageQuality: 85);

      if (image != null && mounted) {
        setState(() => _imagePath = image.path);
      }
    } catch (e) {
      if (!mounted) return;
      _toast('Unable to select the photo. Please try again.');
    }
  }

  // Submit the report and its optional packaging photo to the backend.
  Future<void> _submitReport() async {
    final batchId = _batchController.text.trim().toUpperCase();
    final notes = _notesController.text.trim();

    if (batchId.isEmpty) {
      _toast('Please enter the batch number.');
      return;
    }
    if (notes.isEmpty) {
      _toast('Please provide details about the report.');
      return;
    }
    if (_sector == null) {
      _toast('Please choose the pharmacy sector.');
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      await ApiService.submitReport(batchId, _sector!, notes, _imagePath);

      if (!mounted) return;
      _toast('Report submitted successfully.');
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      final message = e is ApiException ? e.message : 'Something went wrong. Please try again.';
      _toast('Failed to submit report: $message');
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Widget _label(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
    );
  }

  Widget _hint(BuildContext context, String text) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Text(
        text,
        style: TextStyle(color: context.colors.textSecondary, fontSize: 12, height: 1.4),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Report suspicious drug',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 22),
        ),
        centerTitle: false,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'PHARMACIST REPORT • SIGNED IN',
              style: TextStyle(color: c.accent, fontWeight: FontWeight.bold, fontSize: 12),
            ),
            const SizedBox(height: 8),
            Text(
              'Help flag a product that needs review.',
              style: TextStyle(color: c.textSecondary, fontSize: 14),
            ),
            const SizedBox(height: 24),

            _label('Packaging photo'),

            // Tap this container to take a photo or choose one
            // from the device gallery.
            InkWell(
              onTap: _pickImage,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: c.surface,
                  border: Border.all(color: c.border),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.camera_alt_outlined, color: c.accent),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Add packaging photo',
                                style: TextStyle(color: c.accent, fontWeight: FontWeight.bold),
                              ),
                              Text(
                                'Show the QR code and batch label.',
                                style: TextStyle(color: c.textSecondary, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                        Icon(
                          _imagePath == null ? Icons.add : Icons.edit_outlined,
                          color: c.accent,
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
                                child: Text('Unable to display this image. Tap to select another.'),
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Tap to replace the selected photo.',
                        style: TextStyle(color: c.textSecondary, fontSize: 12),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            _label('Pharmacy location'),
            SectorDropdown(
              value: _sector,
              label: 'Sector',
              enabled: !_isSubmitting,
              onChanged: (value) => setState(() => _sector = value),
            ),
            _hint(
              context,
              _sector == null
                  ? 'Choose the sector where the pharmacy is.'
                  : '${districtOfSector(_sector)} District, Kigali',
            ),
            const SizedBox(height: 24),

            _label('Batch number'),
            TextField(
              controller: _batchController,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(
                prefixIcon: Icon(Icons.search, color: c.accent),
                hintText: 'RW-2026-0523',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
            _hint(context, 'Copy the batch number exactly as printed on the box.'),
            const SizedBox(height: 24),

            _label('Notes'),
            TextField(
              controller: _notesController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Batch flagged during scan.\nPackaging held for review.',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
            _hint(context, 'Do not include patient names or medical details.'),
            const SizedBox(height: 32),

            Text(
              'Submitting shares these details with the review team. '
              'It does not confirm a counterfeit result.',
              style: TextStyle(color: c.textSecondary, fontSize: 12, height: 1.4),
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
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
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
