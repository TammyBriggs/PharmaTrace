import 'package:flutter/material.dart';
import '../../core/theme.dart';

/// Plain-language summary of what the app collects and why.
class PrivacyNoticeScreen extends StatelessWidget {
  const PrivacyNoticeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;

    Widget section(String title, List<String> points) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 8),
            for (final point in points)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('•  ', style: TextStyle(color: c.textSecondary)),
                    Expanded(
                      child: Text(point, style: TextStyle(color: c.textSecondary, height: 1.4, fontSize: 14)),
                    ),
                  ],
                ),
              ),
          ],
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Privacy notice')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          section('When you scan a medicine', [
            'The code you scan is sent to PharmaTrace to check it against the register of approved batches.',
            'The server keeps the result (for example authentic or flagged), the batch and pack checked, and the time.',
            'If you are signed in as a pharmacist, the scan is also linked to your account and your sector. Patients who scan without signing in are not identified.',
            'The camera is only used to read QR codes. Photos of what the camera sees are not stored.',
          ]),
          section('When you report a product', [
            'A report shares the batch number, your sector, your notes and the photo you choose to add.',
            'Reports are seen by the Rwanda FDA review team. Do not include patient names or medical details.',
            'A report does not confirm that a product is counterfeit. It asks the team to review it.',
          ]),
          section('When you record a sale', [
            'Marking a pack as dispensed records the pack, the time and your account. It is used to spot copies of a pack that was already sold.',
          ]),
          section('On your phone', [
            'Your scan history, display settings and profile are saved on this device. Clearing the scan history in the History tab removes it from the phone.',
            'Gallery access is only used when you choose a profile picture or a report photo.',
          ]),
        ],
      ),
    );
  }
}
