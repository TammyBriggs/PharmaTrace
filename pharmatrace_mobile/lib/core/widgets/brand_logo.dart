import 'package:flutter/material.dart';

/// The PharmaTrace mark from the web dashboard (shield with a plus on a tinted tile).
/// Picks the light or dark artwork to match the current theme.
class BrandLogo extends StatelessWidget {
  final double width;

  const BrandLogo({Key? key, this.width = 32}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final bool isDark = Theme.of(context).brightness == Brightness.dark;
    return Image.asset(
      isDark ? 'assets/images/logo_mark_dark.png' : 'assets/images/logo_mark.png',
      width: width,
      height: width * 9 / 8,
      filterQuality: FilterQuality.high,
      semanticLabel: 'PharmaTrace',
    );
  }
}
