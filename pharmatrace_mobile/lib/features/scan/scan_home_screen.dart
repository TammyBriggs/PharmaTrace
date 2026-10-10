import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../core/theme.dart';
import '../verification/verification_result_screen.dart';

class ScanHomeScreen extends StatefulWidget {
  const ScanHomeScreen({Key? key}) : super(key: key);

  @override
  State<ScanHomeScreen> createState() => _ScanHomeScreenState();
}

class _ScanHomeScreenState extends State<ScanHomeScreen> {
  final MobileScannerController _cameraController =
      MobileScannerController();

  final TextEditingController _manualInputController =
      TextEditingController();

  bool _isProcessing = false;

  void _processBatch(String batchId) {
    if (_isProcessing || batchId.isEmpty) return;

    setState(() => _isProcessing = true);

    _cameraController.stop();

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) =>
            VerificationResultScreen(batchId: batchId),
      ),
    ).then((_) {
      if (!mounted) return;

      setState(() => _isProcessing = false);
      _cameraController.start();
    });
  }

  void _showManualEntrySheet() {
    _manualInputController.clear();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(24),
        ),
      ),
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
          left: 24,
          right: 24,
          top: 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Enter batch code manually',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _manualInputController,
                    decoration: InputDecoration(
                      hintText: 'e.g. RW-2024-0417',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      contentPadding:
                          const EdgeInsets.symmetric(horizontal: 16),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                ElevatedButton(
                  onPressed: () {
                    final batchId =
                        _manualInputController.text.trim();

                    if (batchId.isEmpty) return;

                    Navigator.pop(context);
                    _processBatch(batchId);
                  },
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size(100, 50),
                  ),
                  child: const Text('Verify'),
                ),
              ],
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _cameraController.dispose();
    _manualInputController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          MobileScanner(
            controller: _cameraController,
            onDetect: (capture) {
              final List<Barcode> barcodes = capture.barcodes;

              if (barcodes.isNotEmpty &&
                  barcodes.first.rawValue != null) {
                _processBatch(barcodes.first.rawValue!.trim());
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
                    horizontal: 16,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Row(
                    children: [
                      Icon(
                        Icons.verified_user_outlined,
                        color: AppTheme.primaryColor,
                        size: 20,
                      ),
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
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: IconButton(
                    icon: const Icon(
                      Icons.flash_off,
                      color: AppTheme.primaryColor,
                    ),
                    onPressed: () =>
                        _cameraController.toggleTorch(),
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
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Column(
                children: [
                  Text(
                    'Point at the QR code on the\nmedicine box',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: 8),
                  Text(
                    'Keep the code inside the frame.',
                    style: TextStyle(
                      color: AppTheme.textSecondary,
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
                                color: AppTheme.primaryColor.withOpacity(0.8),
                                width: 3,
                              ),
                              left: BorderSide(
                                color: AppTheme.primaryColor.withOpacity(0.8),
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
                                color: AppTheme.primaryColor.withOpacity(0.8),
                                width: 3,
                              ),
                              right: BorderSide(
                                color: AppTheme.primaryColor.withOpacity(0.8),
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
                                color: AppTheme.primaryColor.withOpacity(0.8),
                                width: 3,
                              ),
                              left: BorderSide(
                                color: AppTheme.primaryColor.withOpacity(0.8),
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
                                color: AppTheme.primaryColor.withOpacity(0.8),
                                width: 3,
                              ),
                              right: BorderSide(
                                color: AppTheme.primaryColor.withOpacity(0.8),
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
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.keyboard_outlined,
                          color: AppTheme.primaryColor,
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Enter batch code manually',
                          style: TextStyle(
                            color: AppTheme.primaryColor,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Scan the packaging, not a loose tablet.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppTheme.textSecondary,
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