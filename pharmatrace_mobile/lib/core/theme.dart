import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Colours that differ between light and dark mode.
/// Read them with `context.colors.surface`, `context.colors.textSecondary`, ...
@immutable
class AppColors extends ThemeExtension<AppColors> {
  final Color background; // screen canvas
  final Color surface; // cards, app bar, bottom bar, sheets
  final Color border;
  final Color textPrimary;
  final Color textSecondary;
  final Color accent; // brand green used for icons, links and outlines

  // Status colours: foreground on its own tinted background.
  final Color successFg;
  final Color successBg;
  final Color dangerFg;
  final Color dangerBg;
  final Color warningFg;
  final Color warningBg;
  final Color neutralFg;
  final Color neutralBg;

  const AppColors({
    required this.background,
    required this.surface,
    required this.border,
    required this.textPrimary,
    required this.textSecondary,
    required this.accent,
    required this.successFg,
    required this.successBg,
    required this.dangerFg,
    required this.dangerBg,
    required this.warningFg,
    required this.warningBg,
    required this.neutralFg,
    required this.neutralBg,
  });

  /// Matches the original Figma-based palette.
  static const AppColors light = AppColors(
    background: Color(0xFFF8F9FA),
    surface: Colors.white,
    border: Color(0xFFE5E7EB),
    textPrimary: Color(0xFF1F2937),
    textSecondary: Color(0xFF6B7280),
    accent: Color(0xFF0F7A5F),
    successFg: Color(0xFF059669),
    successBg: Color(0xFFECFDF5),
    dangerFg: Color(0xFFDC2626),
    dangerBg: Color(0xFFFEF2F2),
    warningFg: Color(0xFFD97706),
    warningBg: Color(0xFFFFFBEB),
    neutralFg: Color(0xFF6B7280),
    neutralBg: Color(0xFFF3F4F6),
  );

  /// Not in the Figma file: derived from the same gray and green families.
  static const AppColors dark = AppColors(
    background: Color(0xFF111827),
    surface: Color(0xFF1F2937),
    border: Color(0xFF374151),
    textPrimary: Color(0xFFF9FAFB),
    textSecondary: Color(0xFF9CA3AF),
    accent: Color(0xFF34D399),
    successFg: Color(0xFF34D399),
    successBg: Color(0xFF064E3B),
    dangerFg: Color(0xFFF87171),
    dangerBg: Color(0xFF450A0A),
    warningFg: Color(0xFFFBBF24),
    warningBg: Color(0xFF451A03),
    neutralFg: Color(0xFF9CA3AF),
    neutralBg: Color(0xFF374151),
  );

  @override
  AppColors copyWith({
    Color? background,
    Color? surface,
    Color? border,
    Color? textPrimary,
    Color? textSecondary,
    Color? accent,
    Color? successFg,
    Color? successBg,
    Color? dangerFg,
    Color? dangerBg,
    Color? warningFg,
    Color? warningBg,
    Color? neutralFg,
    Color? neutralBg,
  }) {
    return AppColors(
      background: background ?? this.background,
      surface: surface ?? this.surface,
      border: border ?? this.border,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      accent: accent ?? this.accent,
      successFg: successFg ?? this.successFg,
      successBg: successBg ?? this.successBg,
      dangerFg: dangerFg ?? this.dangerFg,
      dangerBg: dangerBg ?? this.dangerBg,
      warningFg: warningFg ?? this.warningFg,
      warningBg: warningBg ?? this.warningBg,
      neutralFg: neutralFg ?? this.neutralFg,
      neutralBg: neutralBg ?? this.neutralBg,
    );
  }

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    Color mix(Color a, Color b) => Color.lerp(a, b, t)!;
    return AppColors(
      background: mix(background, other.background),
      surface: mix(surface, other.surface),
      border: mix(border, other.border),
      textPrimary: mix(textPrimary, other.textPrimary),
      textSecondary: mix(textSecondary, other.textSecondary),
      accent: mix(accent, other.accent),
      successFg: mix(successFg, other.successFg),
      successBg: mix(successBg, other.successBg),
      dangerFg: mix(dangerFg, other.dangerFg),
      dangerBg: mix(dangerBg, other.dangerBg),
      warningFg: mix(warningFg, other.warningFg),
      warningBg: mix(warningBg, other.warningBg),
      neutralFg: mix(neutralFg, other.neutralFg),
      neutralBg: mix(neutralBg, other.neutralBg),
    );
  }
}

extension AppColorsContext on BuildContext {
  AppColors get colors => Theme.of(this).extension<AppColors>()!;
}

/// Global theme configuration for PharmaTrace.
class AppTheme {
  // Brand colour. Buttons keep this fill in both modes.
  static const Color primaryColor = Color(0xFF0F7A5F); // Dark teal/green

  // Status colours that read well on both light and dark surfaces
  // (used for buttons and icons; tinted backgrounds come from AppColors).
  static const Color statusAuthentic = Color(0xFF059669);
  static const Color statusFlagged = Color(0xFFDC2626);
  static const Color statusPending = Color(0xFFD97706);
  static const Color statusExpired = Color(0xFFD97706);
  static const Color statusNotFound = Color(0xFF6B7280);

  static ThemeData get lightTheme => _build(Brightness.light, AppColors.light);
  static ThemeData get darkTheme => _build(Brightness.dark, AppColors.dark);

  static ThemeData _build(Brightness brightness, AppColors c) {
    final bool isDark = brightness == Brightness.dark;
    final Color primary = isDark ? c.accent : primaryColor;

    final ColorScheme scheme = ColorScheme.fromSeed(
      seedColor: primaryColor,
      brightness: brightness,
    ).copyWith(
      primary: primary,
      onPrimary: isDark ? const Color(0xFF052E22) : Colors.white,
      surface: c.surface,
      onSurface: c.textPrimary,
      onSurfaceVariant: c.textSecondary,
      outline: c.border,
      outlineVariant: c.border,
      surfaceContainerLowest: c.background,
      surfaceContainerLow: c.surface,
      surfaceContainer: c.surface,
      surfaceContainerHigh: c.surface,
      surfaceContainerHighest: c.border,
      error: c.dangerFg,
    );

    final ThemeData base = ThemeData(brightness: brightness, useMaterial3: true);

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      primaryColor: primary,
      scaffoldBackgroundColor: c.background,
      canvasColor: c.surface,
      dividerColor: c.border,
      extensions: <ThemeExtension<dynamic>>[c],
      // Apply the 'Inter' font family globally
      textTheme: GoogleFonts.interTextTheme(base.textTheme).apply(
        bodyColor: c.textPrimary,
        displayColor: c.textPrimary,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: c.surface,
        foregroundColor: c.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        iconTheme: IconThemeData(color: c.textPrimary),
        titleTextStyle: TextStyle(
          color: c.textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: c.surface,
        selectedItemColor: c.accent,
        unselectedItemColor: c.textSecondary,
        type: BottomNavigationBarType.fixed,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: isDark ? const Color(0xFFF9FAFB) : const Color(0xFF1F2937),
        contentTextStyle: TextStyle(
          color: isDark ? const Color(0xFF111827) : Colors.white,
        ),
      ),
      // Standardized button styling for the 'Primary / default'
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 50), // Full width, 50px height
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8), // 8px border radius
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
