import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/auth_manager.dart';
import '../../core/sectors.dart';
import '../../core/strings.dart';
import '../../core/theme.dart';
import '../../core/widgets/sector_dropdown.dart';
import '../../data/services/api_service.dart';

class ReportProductScreen extends StatefulWidget {
  /// Pre-fills the batch number when reporting straight from a scan result.
  final String? initialBatchNo;

  const ReportProductScreen({super.key, this.initialBatchNo});

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
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                sheetContext.tr('rp.addPhoto'),
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ),
            ListTile(
              leading: Icon(Icons.camera_alt_outlined, color: sheetContext.colors.accent),
              title: Text(sheetContext.tr('rp.take')),
              onTap: () => Navigator.pop(sheetContext, ImageSource.camera),
            ),
            ListTile(
              leading: Icon(Icons.photo_library_outlined, color: sheetContext.colors.accent),
              title: Text(sheetContext.tr('rp.gallery')),
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
      _toast(context.tr('rp.photoError'));
    }
  }

  // Submit the report and its optional packaging photo to the backend.
  Future<void> _submitReport() async {
    final batchId = _batchController.text.trim().toUpperCase();
    final notes = _notesController.text.trim();

    if (batchId.isEmpty) {
      _toast(context.tr('rp.needBatch'));
      return;
    }
    if (notes.isEmpty) {
      _toast(context.tr('rp.needNotes'));
      return;
    }
    if (_sector == null) {
      _toast(context.tr('rp.needSector'));
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      await ApiService.submitReport(batchId, _sector!, notes, _imagePath);

      if (!mounted) return;
      _toast(context.tr('rp.sent'));
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      final message = e is ApiException ? e.message : context.tr('rp.wrong');
      _toast(context.tr('rp.failed', {'message': message}));
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
        title: Text(
          context.tr('profile.reportDrug'),
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 22),
        ),
        centerTitle: false,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              context.tr('rp.eyebrow'),
              style: TextStyle(color: c.accent, fontWeight: FontWeight.bold, fontSize: 12),
            ),
            const SizedBox(height: 8),
            Text(
              context.tr('rp.intro'),
              style: TextStyle(color: c.textSecondary, fontSize: 14),
            ),
            const SizedBox(height: 24),

            _label(context.tr('rp.photo')),

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
                                context.tr('rp.addPhoto'),
                                style: TextStyle(color: c.accent, fontWeight: FontWeight.bold),
                              ),
                              Text(
                                context.tr('rp.photoHint'),
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
                            return SizedBox(
                              height: 100,
                              child: Center(
                                child: Text(context.tr('rp.imageError')),
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        context.tr('rp.replace'),
                        style: TextStyle(color: c.textSecondary, fontSize: 12),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            _label(context.tr('rp.location')),
            SectorDropdown(
              value: _sector,
              label: context.tr('rp.sector'),
              enabled: !_isSubmitting,
              onChanged: (value) => setState(() => _sector = value),
            ),
            _hint(
              context,
              _sector == null
                  ? context.tr('rp.sectorHint')
                  : context.tr('profile.district', {'district': districtOfSector(_sector) ?? ''}),
            ),
            const SizedBox(height: 24),

            _label(context.tr('rp.batch')),
            TextField(
              controller: _batchController,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(
                prefixIcon: Icon(Icons.search, color: c.accent),
                hintText: 'RW-2026-0523',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
            _hint(context, context.tr('rp.batchHint')),
            const SizedBox(height: 24),

            _label(context.tr('rp.notes')),
            TextField(
              controller: _notesController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: context.tr('rp.notesPlaceholder'),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
            _hint(context, context.tr('rp.notesHint')),
            const SizedBox(height: 32),

            Text(
              context.tr('rp.disclaimer'),
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
                    : Text(context.tr('rp.submit')),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
