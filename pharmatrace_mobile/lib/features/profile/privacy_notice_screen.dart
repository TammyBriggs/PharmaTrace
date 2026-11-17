import 'package:flutter/material.dart';
import '../../core/auth_manager.dart';
import '../../core/strings.dart';
import '../../core/theme.dart';

/// Plain-language summary of what the app collects and why.
class PrivacyNoticeScreen extends StatelessWidget {
  const PrivacyNoticeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    // Reporting a product and recording a sale are pharmacist-only, so patients do not see those parts.
    final isPharmacist = AuthManager().isPharmacist;

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
      appBar: AppBar(title: Text(context.tr('pn.title'))),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          section(context.tr('pn.scan.title'), [
            context.tr('pn.scan.1'),
            context.tr('pn.scan.2'),
            context.tr('pn.scan.3'),
            context.tr('pn.scan.4'),
          ]),
          if (isPharmacist)
            section(context.tr('pn.report.title'), [
              context.tr('pn.report.1'),
              context.tr('pn.report.2'),
              context.tr('pn.report.3'),
            ]),
          if (isPharmacist)
            section(context.tr('pn.sale.title'), [
              context.tr('pn.sale.1'),
            ]),
          section(context.tr('pn.phone.title'), [
            context.tr('pn.phone.1'),
            context.tr(isPharmacist ? 'pn.phone.2.pharmacist' : 'pn.phone.2.patient'),
          ]),
        ],
      ),
    );
  }
}
