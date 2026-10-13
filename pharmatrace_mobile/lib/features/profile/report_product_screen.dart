import 'package:flutter/material.dart';
import '../../core/theme.dart';

class ReportProductScreen extends StatelessWidget {
  const ReportProductScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Report suspicious drug', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 22)),
        centerTitle: false,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('PHARMACIST REPORT • SIGNED IN', style: TextStyle(color: AppTheme.primaryColor, fontWeight: FontWeight.bold, fontSize: 12)),
            const SizedBox(height: 8),
            const Text('Help flag a product that needs review.', style: TextStyle(color: AppTheme.textSecondary, fontSize: 14)),
            const SizedBox(height: 24),

            const Text('Packaging photo', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                border: Border.all(color: AppTheme.borderColor),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Row(
                children: [
                  Icon(Icons.camera_alt_outlined, color: AppTheme.primaryColor),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Add packaging photo', style: TextStyle(color: AppTheme.primaryColor, fontWeight: FontWeight.bold)),
                        Text('Show the QR code and batch label.', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                      ],
                    ),
                  ),
                  Icon(Icons.add, color: AppTheme.primaryColor),
                ],
              ),
            ),
            const SizedBox(height: 24),

            const Text('Pharmacy location — Gasabo sector', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 8),
            TextField(
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search, color: AppTheme.primaryColor),
                hintText: 'Remera ▾',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.borderColor)),
              ),
            ),
            const SizedBox(height: 8),
            const Text('Gasabo District, Kigali\nOther sectors: Kacyiru, Kimironko', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12, height: 1.4)),
            const SizedBox(height: 24),

            const Text('Batch code', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 8),
            TextField(
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search, color: AppTheme.primaryColor),
                hintText: 'RW-2026-0523',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.borderColor)),
              ),
            ),
            const SizedBox(height: 8),
            const Text('Copy the code exactly as printed on the box.', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
            const SizedBox(height: 24),

            const Text('Notes', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 8),
            TextField(
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Batch flagged during scan.\nPackaging held for review.',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.borderColor)),
              ),
            ),
            const SizedBox(height: 8),
            const Text('Do not include patient names or medical details.', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
            const SizedBox(height: 32),

            const Text('Submitting shares these details with the review team. It does not confirm a counterfeit result.', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12, height: 1.4)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Report submitted.')));
              },
              child: const Text('Submit report'),
            ),
          ],
        ),
      ),
    );
  }
}