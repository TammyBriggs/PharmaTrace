import 'package:flutter/material.dart';

import '../language_controller.dart';
import '../strings.dart';
import '../theme.dart';

/// English | Kinyarwanda switch. Used on the Settings screen and on the first onboarding page.
/// Built by hand rather than with SegmentedButton so that the labels always stay on one line.
class LanguageSelector extends StatelessWidget {
  const LanguageSelector({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final selectedBg = Theme.of(context).colorScheme.secondaryContainer;
    final current = LanguageController().language;

    Widget option(AppLanguage language, String label) {
      final selected = current == language;
      return Semantics(
        button: true,
        selected: selected,
        label: label,
        excludeSemantics: true,
        child: InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: () => LanguageController().setLanguage(language),
          child: Container(
            constraints: const BoxConstraints(minHeight: 44),
            padding: const EdgeInsets.symmetric(horizontal: 18),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: selected ? selectedBg : Colors.transparent,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              label,
              maxLines: 1,
              softWrap: false,
              style: TextStyle(
                fontSize: 14,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                color: c.textPrimary,
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          option(AppLanguage.en, context.tr('lang.english')),
          option(AppLanguage.rw, context.tr('lang.kinyarwanda')),
        ],
      ),
    );
  }
}
