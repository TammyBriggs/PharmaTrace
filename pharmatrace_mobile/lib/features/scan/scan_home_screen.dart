import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../core/theme.dart';
import '../../core/widgets/brand_logo.dart';
import '../verification/verification_result_screen.dart';

class ScanHomeScreen extends StatefulWidget {
  const ScanHomeScreen({super.key});

  @override
  State<ScanHomeScreen> createState() => _ScanHomeScreenState();
}

class _ScanHomeScreenState extends State<ScanHomeScreen> {
  final MobileScannerController _cameraController = MobileScannerController();

  bool _isProcessing = false;

  void _processCode(String code) {
    if (_isProcessing || code.isEmpty) return;

    setState(() => _isProcessing = true);

    _cameraController.stop();

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => VerificationResultScreen(code: code),
      ),
    ).then((_) {
      if (!mounted) return; // Safely handles widget disposal!

      setState(() => _isProcessing = false);
      _cameraController.start();
    });
  }

  Future<void> _showManualEntrySheet() async {
    final String? code = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(24),
        ),
      ),
      builder: (sheetContext) => const _ManualEntrySheet(),
    );

    if (code != null && mounted) {
      _processCode(code);
    }
  }

  @override
  void dispose() {
    _cameraController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      body: Stack(
        children: [
          MobileScanner(
            controller: _cameraController,
            onDetect: (capture) {
              final List<Barcode> barcodes = capture.barcodes;

              if (barcodes.isNotEmpty && barcodes.first.rawValue != null) {
                _processCode(barcodes.first.rawValue!.trim());
              }
            },
          ),

          // Top controls: Logo and flash toggle
          Positioned(
            top: 50,
            left: 24,
            right: 24,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: c.surface,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Row(
                    children: [
                      BrandLogo(width: 24),
                      SizedBox(width: 8),
                      Text(
                        'PharmaTrace',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(8)),
                  child: ValueListenableBuilder<MobileScannerState>(
                    valueListenable: _cameraController, // Listen to the controller directly
                    builder: (context, state, child) {
                      final isOn = state.torchState == TorchState.on;
                      return IconButton(
                        icon: Icon(isOn ? Icons.flash_on : Icons.flash_off, color: c.accent),
                        onPressed: () => _cameraController.toggleTorch(),
                      );
                    },
                  ),
                ),
              ], 
            ),
          ),

          // Instruction card
          Positioned(
            top: 130,
            left: 24,
            right: 24,
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: c.surface,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  const Text(
                    'Point at the QR code on the\nmedicine box',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Keep the code inside the frame.',
                    style: TextStyle(
                      color: c.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Scanner Corner Brackets
          Positioned(
            top: 280,
            left: 0,
            right: 0,
            child: Center(
              child: SizedBox(
                width: 270,
                height: 270,
                child: Stack(
                  children: [
                    // Top-left corner
                    Positioned(
                      top: 0,
                      left: 0,
                      child: Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          border: Border(
                            top: BorderSide(
                              color: AppTheme.primaryColor.withValues(alpha: 0.8),
                              width: 3,
                            ),
                            left: BorderSide(
                              color: AppTheme.primaryColor.withValues(alpha: 0.8),
                              width: 3,
                            ),
                          ),
                        ),
                      ),
                    ),

                    // Top-right corner
                    Positioned(
                      top: 0,
                      right: 0,
                      child: Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          border: Border(
                            top: BorderSide(
                              color: AppTheme.primaryColor.withValues(alpha: 0.8),
                              width: 3,
                            ),
                            right: BorderSide(
                              color: AppTheme.primaryColor.withValues(alpha: 0.8),
                              width: 3,
                            ),
                          ),
                        ),
                      ),
                    ),

                    // Bottom-left corner
                    Positioned(
                      bottom: 0,
                      left: 0,
                      child: Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          border: Border(
                            bottom: BorderSide(
                              color: AppTheme.primaryColor.withValues(alpha: 0.8),
                              width: 3,
                            ),
                            left: BorderSide(
                              color: AppTheme.primaryColor.withValues(alpha: 0.8),
                              width: 3,
                            ),
                          ),
                        ),
                      ),
                    ),

                    // Bottom-right corner
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          border: Border(
                            bottom: BorderSide(
                              color: AppTheme.primaryColor.withValues(alpha: 0.8),
                              width: 3,
                            ),
                            right: BorderSide(
                              color: AppTheme.primaryColor.withValues(alpha: 0.8),
                              width: 3,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Bottom manual entry card
          Positioned(
            bottom: 24,
            left: 24,
            right: 24,
            child: GestureDetector(
              onTap: _showManualEntrySheet,
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: c.surface,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.keyboard_outlined,
                          color: c.accent,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Enter code manually',
                          style: TextStyle(
                            color: c.accent,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Scan the packaging, not a loose tablet.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: c.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Typed fallback for when a QR code will not scan: GTIN + batch (+ pack serial).
class _ManualEntrySheet extends StatefulWidget {
  const _ManualEntrySheet();

  @override
  State<_ManualEntrySheet> createState() => _ManualEntrySheetState();
}

class _ManualEntrySheetState extends State<_ManualEntrySheet> {
  final TextEditingController _batch = TextEditingController();
  final TextEditingController _gtin = TextEditingController();
  final TextEditingController _serial = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _batch.dispose();
    _gtin.dispose();
    _serial.dispose();
    super.dispose();
  }

  void _submit() {
    final batch = _batch.text.trim().toUpperCase();
    final gtin = _gtin.text.trim();
    final serial = _serial.text.trim().toUpperCase();

    if (batch.isEmpty) {
      setState(() => _error = 'Enter the batch number printed on the pack.');
      return;
    }
    if (!RegExp(r'^[A-Z0-9][A-Z0-9\-/]{2,39}$').hasMatch(batch)) {
      setState(() => _error = 'The batch number uses letters, numbers and dashes only.');
      return;
    }
    if (gtin.isNotEmpty && !RegExp(r'^\d{14}$').hasMatch(gtin)) {
      setState(() => _error = 'The GTIN is 14 digits. Leave it empty if you are not sure.');
      return;
    }
    if (serial.isNotEmpty && !RegExp(r'^[A-Z0-9]{1,20}$').hasMatch(serial)) {
      setState(() => _error = 'The pack serial uses letters and numbers only.');
      return;
    }

    final tail = '/10/${Uri.encodeComponent(batch)}${serial.isEmpty ? '' : '/21/$serial'}';
    Navigator.pop(context, gtin.isEmpty ? tail : '/01/$gtin$tail');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 24,
        right: 24,
        top: 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Enter code manually',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
            const SizedBox(height: 4),
            Text(
              'The batch number printed on the pack is enough.',
              style: TextStyle(color: c.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _batch,
              textCapitalization: TextCapitalization.characters,
              textInputAction: TextInputAction.next,
              decoration: InputDecoration(
                labelText: 'Batch number',
                hintText: 'e.g. RW-2026-0523',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _gtin,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.next,
              maxLength: 14,
              decoration: InputDecoration(
                labelText: 'GTIN (optional)',
                helperText: '14 digits. Helps if two products share a batch number.',
                counterText: '',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _serial,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(
                labelText: 'Pack serial (optional)',
                helperText: 'Add it to check this exact pack. Leave empty to check the whole batch.',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: TextStyle(color: c.dangerFg, fontSize: 13)),
            ],
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _submit, child: const Text('Verify')),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
