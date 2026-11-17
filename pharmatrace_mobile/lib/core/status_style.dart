import 'package:flutter/material.dart';
import '../data/models/batch_model.dart';
import 'auth_manager.dart';
import 'strings.dart';
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
      return StatusStyle(fg: c.successFg, bg: c.successBg, icon: Icons.check_circle, label: context.tr('verdict.authentic'));
    case BatchVerdict.flagged:
      return StatusStyle(fg: c.dangerFg, bg: c.dangerBg, icon: Icons.warning_rounded, label: context.tr('verdict.flagged'));
    case BatchVerdict.expired:
      return StatusStyle(fg: c.warningFg, bg: c.warningBg, icon: Icons.schedule, label: context.tr('verdict.expired'));
    case BatchVerdict.pending:
      return StatusStyle(fg: c.warningFg, bg: c.warningBg, icon: Icons.schedule, label: context.tr('verdict.pending'));
    case BatchVerdict.revoked:
      return StatusStyle(fg: c.dangerFg, bg: c.dangerBg, icon: Icons.block, label: context.tr('verdict.revoked'));
    case BatchVerdict.duplicate:
      // A pharmacist must not sell this pack again, so it stays a firm red stop.
      if (AuthManager().isPharmacist) {
        return StatusStyle(fg: c.dangerFg, bg: c.dangerBg, icon: Icons.content_copy, label: context.tr('verdict.alreadyDispensed'));
      }
      // A patient who just bought the pack gets this result too. The product is registered and its
      // batch is approved, so it is shown calmly instead of looking like a fake-drug warning.
      return StatusStyle(fg: c.warningFg, bg: c.warningBg, icon: Icons.verified_outlined, label: context.tr('verdict.alreadySold'));
    case BatchVerdict.notFound:
      return StatusStyle(fg: c.neutralFg, bg: c.neutralBg, icon: Icons.help_outline, label: context.tr('verdict.notFound'));
  }
}
