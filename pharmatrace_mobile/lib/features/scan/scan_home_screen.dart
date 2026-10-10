import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../core/theme.dart';
import '../verification/verification_result_screen.dart';
import '../profile/pharmacist_profile_screen.dart';

class ScanHomeScreen extends StatefulWidget {
  const ScanHomeScreen({Key? key}) : super(key: key);

  @override
  State<ScanHomeScreen> createState() => _ScanHomeScreenState();
}

class _ScanHomeScreenState extends State<ScanHomeScreen> {
  final MobileScannerController _cameraController = MobileScannerController();
  final TextEditingController _manualInputController = TextEditingController();
  bool _isProcessing = false;

  void _processBatch(String batchId) {
    if (_isProcessing) return;
    setState(() => _isProcessing = true);
    
    _cameraController.stop(); // Pause camera while awaiting verification
    
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => VerificationResultScreen(batchId: batchId),
      ),
    ).then((_) {
      // Resume scanning when user navigates back
      setState(() => _isProcessing = false);
      _cameraController.start();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan & Verify'),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on),
            onPressed: () => _cameraController.toggleTorch(),
          ),
          IconButton(
            icon: const Icon(Icons.account_circle, color: AppTheme.primaryColor, size: 28),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const PharmacistProfileScreen()),
              );
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      // Switch from Stack to Column to guarantee visibility
      body: Column(
        children: [
          // 1. Camera takes up the upper available space
          Expanded(
            child: MobileScanner(
              controller: _cameraController,
              onDetect: (capture) {
                final List<Barcode> barcodes = capture.barcodes;
                if (barcodes.isNotEmpty && barcodes.first.rawValue != null) {
                  _processBatch(barcodes.first.rawValue!);
                }
              },
            ),
          ),

          // 2. Manual entry card securely anchored at the bottom
          Container(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black12,
                  blurRadius: 10,
                  offset: Offset(0, -4)
                )
              ]
            ),
            child: SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Can\'t scan the QR code?',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _manualInputController,
                          decoration: InputDecoration(
                            hintText: 'Enter Batch ID',
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(color: AppTheme.borderColor),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(color: AppTheme.borderColor),
                            ),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      ElevatedButton(
                        // Add .trim() to prevent whitespace errors from manual typing
                        onPressed: () => _processBatch(_manualInputController.text.trim()),
                        style: ElevatedButton.styleFrom(
                          minimumSize: const Size(100, 50), // Ensure button matches input height
                        ),
                        child: const Text('Verify'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}