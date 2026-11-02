import 'package:flutter/material.dart';
import '../theme.dart';

/// The PharmaTrace mark from the web dashboard (shield with a plus on a tinted tile).
/// Picks the light or dark artwork to match the current theme.
class BrandLogo extends StatelessWidget {
  final double width;

  const BrandLogo({super.key, this.width = 32});

  @override
  Widget build(BuildContext context) {
    final bool isDark = Theme.of(context).brightness == Brightness.dark;
    return Image.asset(
      isDark ? 'assets/images/logo_mark_dark.png' : 'assets/images/logo_mark.png',
      width: width,
      height: width * 9 / 8,
      filterQuality: FilterQuality.high,
      semanticLabel: 'PharmaTrace',
      // If the artwork is ever missing, show a plain shield instead of a red error box.
      errorBuilder: (context, error, stackTrace) => Container(
        width: width,
        height: width * 9 / 8,
        decoration: BoxDecoration(
          color: context.colors.accent.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(width * 0.22),
        ),
        child: Icon(Icons.verified_user, color: context.colors.accent, size: width * 0.55),
      ),
    );
  }
}
