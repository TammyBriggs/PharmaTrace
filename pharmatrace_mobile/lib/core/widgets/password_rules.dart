import 'package:flutter/material.dart';

import '../strings.dart';
import '../theme.dart';

/// The same rules the server enforces, so people see what is wrong before they submit.
class PasswordRule {
  /// Key in the string table (core/strings.dart), so the rule is shown in the chosen language.
  final String labelKey;
  final bool Function(String) ok;
  const PasswordRule(this.labelKey, this.ok);
}

final List<PasswordRule> passwordRules = [
  PasswordRule('pw.ruleLen', (p) => p.length >= 8),
  PasswordRule('pw.ruleLetter', (p) => RegExp(r'[A-Za-z]').hasMatch(p)),
  PasswordRule('pw.ruleDigit', (p) => RegExp(r'\d').hasMatch(p)),
  PasswordRule('pw.ruleSpace', (p) => p == p.trim()),
];

bool passwordMeetsRules(String p) => passwordRules.every((r) => r.ok(p));

/// A live checklist under a "new password" field.
class PasswordRulesList extends StatelessWidget {
  final String password;
  const PasswordRulesList({super.key, required this.password});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final r in passwordRules)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Row(
              children: [
                Icon(
                  r.ok(password) && password.isNotEmpty ? Icons.check_circle : Icons.radio_button_unchecked,
                  size: 16,
                  color: r.ok(password) && password.isNotEmpty ? c.successFg : c.textSecondary,
                ),
                const SizedBox(width: 8),
                Text(context.tr(r.labelKey), style: TextStyle(fontSize: 12, color: c.textSecondary)),
              ],
            ),
          ),
      ],
    );
  }
}
