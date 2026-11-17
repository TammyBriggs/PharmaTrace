import 'package:flutter/material.dart';

import '../language_controller.dart';
import '../strings.dart';

/// English | Kinyarwanda switch. Used on the Settings screen and on the first onboarding page.
class LanguageSelector extends StatelessWidget {
  const LanguageSelector({super.key});

  @override
  Widget build(BuildContext context) {
    final current = LanguageController().language;
    return SegmentedButton<AppLanguage>(
      showSelectedIcon: false,
      segments: [
        ButtonSegment<AppLanguage>(value: AppLanguage.en, label: Text(context.tr('lang.english'))),
        ButtonSegment<AppLanguage>(value: AppLanguage.rw, label: Text(context.tr('lang.kinyarwanda'))),
      ],
      selected: {current},
      onSelectionChanged: (selection) => LanguageController().setLanguage(selection.first),
    );
  }
}
