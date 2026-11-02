import 'package:flutter/material.dart';
import '../data/models/batch_model.dart';
import 'theme.dart';

/// How a verification result is drawn: chip colours, icon and label.
class StatusStyle {
  final Color fg;
  final Color bg;
  final IconData icon;
  final String label;

  const StatusStyle({
    required this.fg,
    required this.bg,
    required this.icon,
    required this.label,
  });
}

/// One place for the verdict look, shared by the result and history screens.
StatusStyle statusStyleFor(BuildContext context, BatchVerdict verdict) {
  final c = context.colors;
  switch (verdict) {
    case BatchVerdict.authentic:
      return StatusStyle(fg: c.successFg, bg: c.successBg, icon: Icons.check_circle, label: 'Authentic');
    case BatchVerdict.flagged:
      return StatusStyle(fg: c.dangerFg, bg: c.dangerBg, icon: Icons.warning_rounded, label: 'Flagged');
    case BatchVerdict.expired:
      return StatusStyle(fg: c.warningFg, bg: c.warningBg, icon: Icons.schedule, label: 'Expired');
    case BatchVerdict.pending:
      return StatusStyle(fg: c.warningFg, bg: c.warningBg, icon: Icons.schedule, label: 'Pending');
    case BatchVerdict.revoked:
      return StatusStyle(fg: c.dangerFg, bg: c.dangerBg, icon: Icons.block, label: 'Revoked');
    case BatchVerdict.duplicate:
      return StatusStyle(fg: c.dangerFg, bg: c.dangerBg, icon: Icons.content_copy, label: 'Already dispensed');
    case BatchVerdict.notFound:
      return StatusStyle(fg: c.neutralFg, bg: c.neutralBg, icon: Icons.help_outline, label: 'Not found');
  }
}
