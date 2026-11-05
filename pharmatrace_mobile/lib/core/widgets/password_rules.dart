import 'package:flutter/material.dart';

import '../theme.dart';

/// The same rules the server enforces, so people see what is wrong before they submit.
class PasswordRule {
  final String label;
  final bool Function(String) ok;
  const PasswordRule(this.label, this.ok);
}

final List<PasswordRule> passwordRules = [
  PasswordRule('At least 8 characters', (p) => p.length >= 8),
  PasswordRule('At least one letter', (p) => RegExp(r'[A-Za-z]').hasMatch(p)),
  PasswordRule('At least one number', (p) => RegExp(r'\d').hasMatch(p)),
  PasswordRule('No space at the start or end', (p) => p == p.trim()),
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
                Text(r.label, style: TextStyle(fontSize: 12, color: c.textSecondary)),
              ],
            ),
          ),
      ],
    );
  }
}
